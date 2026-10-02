// Co-op — a sala do host. O PC do host guarda a campanha e fala com o mestre; os convidados (até 2)
// se conectam pela rede local por HTTP: pedidos em POST com JSON e um fluxo de eventos (SSE) em /eventos.
//
// Rodada: cada herói manda uma ação; quando todos os jogadores online mandaram (ou o host clica em
// "Resolver agora", ou o prazo acaba), o mestre responde UMA vez para o grupo inteiro e cada jogador
// recebe o resultado visto pelo seu herói (ficha e inventário são os dele; a história é de todos).
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const catalogo = require('../catalogo');
const { HEROI_PRINCIPAL } = require('../campaign-store');
const { log } = require('./log');

const PORTA_PADRAO = 47800;
const MAX_CONVIDADOS = 2;
const PRAZO_RODADA = 90_000;
const MAX_MENSAGENS = 120; // os convidados recebem só o fim do histórico
const MAX_CORPO = 256 * 1024;
const TIPOS = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml' };

const gerarCodigo = () => Array.from(crypto.randomBytes(6), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

/** IPs da rede local deste PC (o que os convidados digitam). */
function enderecosLocais(porta) {
  const out = [];
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista || []) if (i.family === 'IPv4' && !i.internal) out.push(`${i.address}:${porta}`);
  }
  return out.length ? out : [`127.0.0.1:${porta}`];
}

class Sala {
  /**
   * @param {{store: any, engine: any, slug: string, nomeHost?: string, avisarHost: (ev: object) => void, prazo?: number}} op
   */
  constructor({ store, engine, slug, nomeHost, avisarHost, prazo }) {
    this.store = store;
    this.engine = engine;
    this.slug = slug;
    this.codigo = gerarCodigo();
    this.prazoMs = prazo || PRAZO_RODADA;
    /** @type {Map<string, {token: string, nome: string, heroi: string|null, online: boolean, res: http.ServerResponse|null}>} */
    this.convidados = new Map();
    this.host = { nome: nomeHost || 'Host', heroi: HEROI_PRINCIPAL, online: true, avisar: avisarHost };
    /** @type {Map<string, {texto: string, papel: string}>} ação de cada herói nesta rodada */
    this.acoes = new Map();
    this.prazo = null;
    this.timer = null;
    this.resolvendo = false;
    this.servidor = null;
    this.porta = null;
  }

  // ─────────────────────────── rede ───────────────────────────
  async abrir(porta = PORTA_PADRAO) {
    for (let p = porta; p < porta + 10; p++) {
      try {
        await new Promise((ok, falha) => {
          const s = http.createServer((req, res) => this.atender(req, res));
          s.once('error', falha);
          s.listen(p, '0.0.0.0', () => { this.servidor = s; ok(); });
        });
        this.porta = p;
        log(`host: sala aberta em ${enderecosLocais(p).join(', ')} código ${this.codigo}`);
        this.pulso = setInterval(() => this.paraTodos((j) => j.res?.write(': ping\n\n')), 20_000);
        return this.info();
      } catch (e) {
        if (e.code !== 'EADDRINUSE') throw e;
      }
    }
    throw new Error('Nenhuma porta livre para a sala (47800–47809).');
  }

  fechar() {
    clearTimeout(this.timer);
    clearInterval(this.pulso);
    this.paraTodos((j) => { j.res?.write(`data: ${JSON.stringify({ t: 'fim' })}\n\n`); j.res?.end(); });
    this.servidor?.close();
    this.servidor?.closeAllConnections?.();
    this.servidor = null;
  }

  info() {
    return { codigo: this.codigo, porta: this.porta, enderecos: enderecosLocais(this.porta), jogadores: this.presenca() };
  }

  async atender(req, res) {
    const u = new URL(req.url, 'http://x');
    log(`host: ${req.method} ${u.pathname} de ${req.socket.remoteAddress}`);
    const responder = (status, corpo) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(corpo));
    };
    try {
      if (req.method === 'GET' && u.pathname === '/eventos') return this.abrirEventos(this.porToken(u.searchParams.get('token')), res);
      if (req.method === 'GET' && u.pathname === '/arte') return await this.servirArte(this.porToken(u.searchParams.get('token')), u.searchParams.get('u'), res);
      if (req.method !== 'POST') return responder(404, { ok: false, erro: 'rota desconhecida' });
      const corpo = await lerCorpo(req);
      let data;
      if (u.pathname === '/entrar') data = await this.entrar(corpo);
      else {
        const j = this.porToken(corpo.token);
        if (u.pathname === '/heroi') data = await this.escolherHeroi(j, corpo.heroi);
        else if (u.pathname === '/criar-heroi') data = await this.criarHeroi(j, corpo.dados);
        else if (u.pathname === '/op') data = await this.op(j, corpo.canal, Array.isArray(corpo.args) ? corpo.args : []);
        else if (u.pathname === '/sair') data = this.sair(j);
        else return responder(404, { ok: false, erro: 'rota desconhecida' });
      }
      responder(200, { ok: true, data });
    } catch (e) {
      log(`host: ${u.pathname} recusado — ${e.message}`);
      responder(e.status || 400, { ok: false, erro: e.message || String(e) });
    }
  }

  porToken(token) {
    const j = token && this.convidados.get(String(token));
    if (!j || j.saiu) throw Object.assign(new Error('Você não está nesta sala (entre de novo).'), { status: 401 });
    return j;
  }

  /** SSE: o convidado fica ouvindo; ao conectar recebe o estado atual. */
  async abrirEventos(j, res) {
    if (!j.heroi) throw new Error('Escolha um herói antes.');
    j.res?.end();
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(': ok\n\n');
    j.res = res;
    j.online = true;
    j.jaConectou = true;
    log(`host: ${j.nome} online (${j.heroi})`);
    res.on('close', () => {
      if (j.res !== res) return;
      j.res = null;
      j.online = false;
      this.avisarRodada();
      this.talvezResolver();
    });
    this.enviar(j, { t: 'estado', state: await this.vista(j.heroi) });
    this.avisarRodada();
  }

  async servirArte(_j, url, res) {
    const p = url ? new URL(url) : null;
    if (!p || (p.host !== 'campanha' && p.host !== 'usuario')) throw new Error('arte inválida');
    if (p.host === 'campanha' && decodeURIComponent(p.pathname).replace(/^\/+/, '').split('/')[0] !== this.slug) throw new Error('arte de outra campanha');
    const arq = catalogo.resolverUrl(url, this.store.root);
    if (!arq || !fs.existsSync(arq)) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(arq).toLowerCase()] || 'application/octet-stream', 'cache-control': 'max-age=3600' });
    fs.createReadStream(arq).pipe(res);
  }

  // ─────────────────────────── entrada ───────────────────────────
  async entrar({ codigo, nome } = {}) {
    if (String(codigo || '').trim().toUpperCase() !== this.codigo) throw new Error('Código da sala errado.');
    // quem caiu e não voltou libera a vaga
    // (só quem já esteve online e caiu, ou ficou parado >60 s sem abrir o fluxo — evita expulsar quem acabou de entrar)
    for (const [tk, j] of this.convidados) if (!j.online && (j.jaConectou || Date.now() - j.criado > 60_000)) this.convidados.delete(tk);
    if (this.convidados.size >= MAX_CONVIDADOS) throw new Error(`A sala está cheia (host + ${MAX_CONVIDADOS} convidados).`);
    const token = crypto.randomBytes(16).toString('hex');
    this.convidados.set(token, { token, nome: String(nome || 'Convidado').trim().slice(0, 30) || 'Convidado', heroi: null, online: false, res: null, criado: Date.now() });
    const st = await this.store.carregar(this.slug);
    return { token, slug: this.slug, campanha: { nome: st.campanha.nome, cenario: st.campanha.cenario, capitulo: st.campanha.capitulo }, herois: await this.heroisLivres(token) };
  }

  /** Heróis que um convidado pode assumir: os do grupo, menos o do host e os que já têm dono online. */
  async heroisLivres(token) {
    const ocupados = new Set([...this.convidados.values()].filter((j) => j.token !== token && j.heroi && j.online).map((j) => j.heroi));
    return (await this.store.listarHerois(this.slug)).filter((h) => h.id !== HEROI_PRINCIPAL).map((h) => ({ ...h, ocupado: ocupados.has(h.id) }));
  }

  async escolherHeroi(j, heroi) {
    const h = (await this.heroisLivres(j.token)).find((x) => x.id === heroi);
    if (!h) throw new Error('Herói não encontrado.');
    if (h.ocupado) throw new Error(`${h.nome} já está com outro jogador.`);
    // o mesmo herói com um token antigo (convidado que reabriu o app) sai da sala
    for (const [tk, o] of this.convidados) if (tk !== j.token && o.heroi === heroi) this.convidados.delete(tk);
    j.heroi = heroi;
    return { heroi };
  }

  async criarHeroi(j, dados = {}) {
    if (j.heroi) throw new Error('Você já tem um herói nesta sala.');
    const id = await this.store.criarHeroi(this.slug, { ...dados, imagem: undefined, jogador: j.nome });
    j.heroi = id;
    this.avisarGrupo();
    return { heroi: id };
  }

  sair(j) {
    // continua na lista como desconectado (o grupo vê 🔌); a vaga é liberada quando alguém entrar
    j.saiu = true;
    j.online = false;
    const res = j.res;
    j.res = null;
    res?.end();
    this.avisarRodada();
    this.talvezResolver();
    return true;
  }

  // ─────────────────────────── pedidos de um convidado ───────────────────────────
  /** O que um convidado pode pedir — sempre em nome do herói dele. */
  async op(j, canal, args) {
    if (!j.heroi) throw new Error('Escolha um herói antes.');
    const s = this.slug;
    const h = j.heroi;
    const store = this.store;
    switch (canal) {
      case 'campanhas:carregar': return this.vista(h);
      case 'catalogo:ler': return catalogo.comUrls(await catalogo.montar(store.root, store.dir(s)), s);
      case 'jogo:acao': return this.acao(h, args[0], args[1]);
      case 'jogo:iniciar': return { aguardando: true }; // quem abre a aventura é o host
      case 'jogo:repetir': return this.executar({ repetir: true });
      case 'jogo:cancelar': return false;
      case 'combate:salvar': return null; // a grade é do host
      case 'inventario:mover': await store.moverItem(s, args[0], args[1], h); return this.vista(h);
      case 'inventario:equipar': await store.alternarEquipado(s, args[0], h); return this.vista(h);
      case 'inventario:descartar': await store.descartarItem(s, args[0], h); return this.vista(h);
      case 'inventario:criarPasta': await store.criarPasta(s, args[0], h); return this.vista(h);
      case 'inventario:excluirPasta': await store.excluirPasta(s, args[0], h); return this.vista(h);
      case 'personagem:atualizar': await store.atualizarHeroi(s, args[0] || {}, h); this.avisarGrupo(); return this.vista(h);
      default: throw new Error('Só o host pode fazer isso.');
    }
  }

  /** Estado visto por um herói (convidados recebem o fim do histórico). */
  async vista(heroi) {
    const st = await this.store.carregar(this.slug, { heroi });
    if (heroi !== HEROI_PRINCIPAL) {
      st.mensagens = st.mensagens.slice(-MAX_MENSAGENS);
      st.pasta = '';
    }
    return st;
  }

  // ─────────────────────────── rodada ───────────────────────────
  /** Quem a rodada espera: o host e os convidados online com herói. */
  participantes() {
    return [this.host, ...[...this.convidados.values()].filter((j) => j.heroi && j.online)];
  }

  presenca() {
    const out = { [HEROI_PRINCIPAL]: { nome: this.host.nome, online: true, enviou: this.acoes.has(HEROI_PRINCIPAL), host: true } };
    for (const j of this.convidados.values()) if (j.heroi) out[j.heroi] = { nome: j.nome, online: j.online, enviou: this.acoes.has(j.heroi) };
    return out;
  }

  acao(heroi, texto, papel = 'jogador') {
    texto = String(texto || '').trim().slice(0, 4000);
    if (!texto) throw new Error('Ação vazia.');
    if (this.resolvendo) throw new Error('O mestre ainda está narrando a rodada anterior.');
    this.acoes.set(heroi, { texto, papel: papel === 'sistema' ? 'sistema' : 'jogador' });
    if (!this.timer) {
      this.prazo = Date.now() + this.prazoMs;
      this.timer = setTimeout(() => this.resolver(), this.prazoMs);
    }
    this.avisarRodada();
    // espera o fim do pedido antes de resolver: quem mandou recebe o "aguardando" antes do resultado
    setImmediate(() => this.talvezResolver());
    return { aguardando: true };
  }

  talvezResolver() {
    if (this.resolvendo || !this.acoes.size) return;
    if (this.participantes().every((p) => this.acoes.has(p.heroi))) this.resolver();
  }

  /** Fecha a rodada: o mestre responde às ações de todos de uma vez. */
  resolver() {
    if (this.resolvendo || !this.acoes.size) return { aguardando: true, resolvendo: this.resolvendo };
    // na ordem da mesa: host primeiro, depois os convidados
    const lugar = (id) => { const i = this.participantes().findIndex((p) => p.heroi === id); return i < 0 ? 99 : i; };
    const ordem = [...this.acoes.keys()].sort((a, b) => lugar(a) - lugar(b));
    const acoes = ordem.map((heroi) => ({ heroi, ...this.acoes.get(heroi) }));
    this.acoes.clear();
    return this.executar({ acoes });
  }

  /** Roda um turno do mestre para o grupo (rodada, abertura ou "tentar de novo") e manda o resultado a cada um. */
  executar(op) {
    if (this.resolvendo) return { aguardando: true, resolvendo: true };
    clearTimeout(this.timer);
    this.timer = null;
    this.prazo = null;
    this.resolvendo = true;
    this.avisarRodada();
    this.paraTodos((j) => this.enviar(j, { t: 'pensando' }));
    (async () => {
      try {
        const r = await this.engine.jogar(this.slug, op);
        const base = { ...r, meta: undefined, state: undefined };
        for (const j of [this.host, ...this.convidados.values()]) {
          if (!j.heroi || !j.online) continue;
          this.enviar(j, { t: 'turno', r: { ...base, state: await this.vista(j.heroi) } });
        }
      } catch (e) {
        this.paraTodos((j) => this.enviar(j, { t: 'erro', erro: e.message || String(e), cancelado: !!e.cancelado }));
      } finally {
        this.resolvendo = false;
        this.avisarRodada();
      }
    })();
    return { aguardando: true, resolvendo: true };
  }

  // ─────────────────────────── avisos ───────────────────────────
  enviar(j, ev) {
    if (j === this.host) return j.avisar(ev);
    j.res?.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  paraTodos(fn) {
    fn(this.host);
    for (const j of this.convidados.values()) if (j.res) fn(j);
  }

  avisarRodada() {
    const ev = { t: 'rodada', jogadores: this.presenca(), resolvendo: this.resolvendo, prazo: this.prazo,
      acoes: [...this.acoes].map(([heroi, a]) => ({ heroi, ...a })) };
    this.paraTodos((j) => this.enviar(j, ev));
  }

  /** Posições da grade de combate (o host calcula; os convidados só desenham). */
  avisarCombate(combate) {
    for (const j of this.convidados.values()) if (j.res) this.enviar(j, { t: 'combate', combate });
  }

  /** O grupo mudou (herói novo, retrato): todos atualizam a lista. */
  async avisarGrupo() {
    const grupo = await this.store.listarHerois(this.slug);
    this.paraTodos((j) => this.enviar(j, { t: 'grupo', grupo }));
    this.avisarRodada();
  }
}

function lerCorpo(req) {
  return new Promise((ok, falha) => {
    let tam = 0;
    const partes = [];
    req.on('data', (c) => {
      tam += c.length;
      if (tam > MAX_CORPO) { falha(Object.assign(new Error('Pedido grande demais.'), { status: 413 })); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => {
      try { ok(partes.length ? JSON.parse(Buffer.concat(partes).toString('utf8')) : {}); } catch { falha(new Error('JSON inválido.')); }
    });
    req.on('error', falha);
  });
}

module.exports = { Sala, PORTA_PADRAO, MAX_CONVIDADOS, enderecosLocais };
