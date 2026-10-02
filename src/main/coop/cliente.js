// Co-op — o lado do convidado. Fala com a sala do host (HTTP) e repassa os eventos dela para a tela.
// Enquanto conectado, os pedidos da campanha (carregar, ação, inventário...) vão para o host, não para o disco.
const http = require('http');
const { PORTA_PADRAO } = require('./servidor');
const { log, explicarRede, caminho } = require('./log');

class Cliente {
  /** @param {(ev: object) => void} avisar manda um evento para a tela (coop:evento) */
  constructor(avisar) {
    this.avisar = avisar;
    this.base = null;
    this.token = null;
    this.slug = null;
    this.heroi = null;
    this.req = null;
    this.fechado = true;
    this.caiu = false;
  }

  get ativo() {
    return !this.fechado && !!this.heroi;
  }

  /** "192.168.0.10" ou "192.168.0.10:47800" → http://192.168.0.10:47800 */
  static normalizar(endereco) {
    let e = String(endereco || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!e) throw new Error('Digite o endereço do host.');
    if (!/:\d+$/.test(e)) e = `${e}:${PORTA_PADRAO}`;
    return `http://${e}`;
  }

  async post(rota, corpo) {
    let r;
    try {
      r = await fetch(this.base + rota, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: this.token, ...corpo }), signal: AbortSignal.timeout(rota === '/op' ? 30_000 : 10_000) });
    } catch (e) {
      const porque = explicarRede(e);
      log(`cliente: POST ${this.base}${rota} FALHOU — ${porque} [${e?.cause?.code || e?.cause?.errors?.[0]?.code || e?.name}: ${e?.cause?.message || e?.message}]`);
      throw new Error(`Não consegui falar com ${this.base}: ${porque}. Log: ${caminho() || 'console'}`);
    }
    const j = await r.json().catch(() => ({ ok: false, erro: `resposta inválida do host (${r.status}) — esse endereço é mesmo de uma sala Crônicas?` }));
    if (!j.ok) {
      log(`cliente: POST ${rota} recusado pelo host (${r.status}): ${j.erro}`);
      throw new Error(j.erro || 'erro no host');
    }
    log(`cliente: POST ${rota} ok`);
    return j.data;
  }

  async conectar({ endereco, codigo, nome }) {
    this.sair();
    this.base = Cliente.normalizar(endereco);
    log(`cliente: conectando em ${this.base} como "${nome}"`);
    this.token = null;
    const r = await this.post('/entrar', { codigo, nome });
    this.token = r.token;
    this.slug = r.slug;
    return r;
  }

  async escolherHeroi(heroi) {
    const r = await this.post('/heroi', { heroi });
    return this.entrou(r.heroi);
  }

  async criarHeroi(dados) {
    const r = await this.post('/criar-heroi', { dados });
    return this.entrou(r.heroi);
  }

  async entrou(heroi) {
    this.heroi = heroi;
    this.fechado = false;
    this.ouvir();
    return { slug: this.slug, heroi };
  }

  /** Pedido da tela que vai para o host (canal do IPC + argumentos sem o slug). */
  chamar(canal, args) {
    return this.post('/op', { canal, args });
  }

  /** Imagem que só existe no PC do host (artes da campanha, retrato enviado). */
  arte(url) {
    return fetch(`${this.base}/arte?token=${this.token}&u=${encodeURIComponent(url)}`);
  }

  /** Fluxo de eventos do host; se cair, tenta de novo a cada 2 s até sair da sala. */
  ouvir() {
    if (this.fechado) return;
    const req = http.get(`${this.base}/eventos?token=${this.token}`, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return falhou(res.statusCode === 401);
      }
      if (this.caiu) this.avisar({ t: 'conexao', ok: true });
      this.caiu = false;
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', (txt) => {
        buf += txt;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const bloco = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const dados = bloco.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
          if (!dados) continue;
          let ev;
          try { ev = JSON.parse(dados); } catch { continue; }
          if (ev.t === 'fim') this.fechado = true;
          if (ev.t === 'rodada') this.ultimaRodada = ev; // a tela pode abrir depois do primeiro aviso
          this.avisar(ev);
        }
      });
      res.on('end', () => falhou(false));
      res.on('error', () => falhou(false));
    });
    req.on('error', (e) => { log(`cliente: fluxo de eventos erro — ${explicarRede(e)}`); falhou(false); });
    this.req = req;
    let uma = false;
    const falhou = (expulso) => {
      if (uma || this.req !== req) return;
      uma = true;
      if (this.fechado) return;
      if (expulso) {
        this.fechado = true;
        return this.avisar({ t: 'fim', motivo: 'A sala não reconhece mais você (o host fechou e abriu de novo?).' });
      }
      if (!this.caiu) this.avisar({ t: 'conexao', ok: false });
      this.caiu = true;
      setTimeout(() => this.ouvir(), 2000);
    };
  }

  sair() {
    if (this.base && this.token && !this.fechado) this.post('/sair', {}).catch(() => {});
    this.fechado = true;
    this.heroi = null;
    this.ultimaRodada = null;
    this.req?.destroy();
    this.req = null;
  }
}

module.exports = { Cliente };
