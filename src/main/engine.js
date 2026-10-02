// Orquestra um turno: salva a ação → chama o provedor → aplica eventos nas pastas → salva a narrativa.
const gm = require('./gm-prompt');
const { slugify } = require('./util');
const anthropic = require('./providers/anthropic');
const claudeCode = require('./providers/claude-code');
const demo = require('./providers/demo');
const mapa = require('./mapa');
const diario = require('./diario');

const PROVEDORES = { api: anthropic, 'claude-code': claudeCode, demo };
const emAndamento = new Map(); // slug → AbortController do turno em curso

class Cancelado extends Error {
  constructor() { super('Turno cancelado.'); this.cancelado = true; }
}

function recapitulacao(mensagens, n = 14) {
  return mensagens
    .slice(-n)
    .map((m) => (m.papel === 'mestre' ? `MESTRE: ${m.texto}` : m.papel === 'jogador' ? `JOGADOR: ${m.texto}` : `[${m.texto}]`))
    .join('\n\n');
}

const { vidaInimigo } = require('./regras');
// fichas do compêndio (monstros do bestiário com vida, tamanho e alcance definidos): o mesmo monstro é sempre igual
let FICHAS = {};
try { FICHAS = require('../data/compendio-fichas.json').monstros || {}; } catch { /* sem compêndio */ }
/**
 * Combate (tema batalha) precisa de inimigo com vida para aparecer no mapa e receber dano.
 * Completa a vida de hostis sem vida e, se ninguém hostil ficou em cena, põe quem o mestre colocou em foco
 * (ou quem falou no roteiro e não é aliado) como hostil.
 */
function garantirInimigos(turno, state) {
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const herois = new Set((state.grupo || []).map((h) => norm(h.nome)));
  const doEstado = (nome) => (state.npcs || []).find((n) => norm(n.nome) === norm(nome));
  const eventosNpc = turno.eventos.filter((e) => e.tipo === 'npc' && e.nome);
  // nível de referência: o do herói (no grupo, a média) — o mesmo "chefe" acompanha a evolução do grupo
  const niveis = (state.grupo?.length ? state.grupo : [state.personagem]).map((h) => h?.nivel || 1);
  const nivel = Math.round(niveis.reduce((s, n) => s + n, 0) / niveis.length) || 1;
  const ganhaVida = (e, base) => {
    if (e.vida != null || base?.vidaMax) return;
    // monstro do compêndio: a ficha manda (vida, tamanho, alcance)
    const ficha = FICHAS[e.retrato] || FICHAS[base?.retrato] || FICHAS[slugify(e.nome)];
    if (ficha?.vida_max) {
      e.vida = e.vidaMax = ficha.vida_max;
      e.tamanho = e.tamanho || ficha.tamanho;
      e.alcance = e.alcance || ficha.alcance;
      return;
    }
    // o mestre só disse a ameaça (lacaio/soldado/elite/chefe): o app calcula a vida
    const v = vidaInimigo(e.ameaca || base?.ameaca || 'soldado', e.tamanho || base?.tamanho, nivel);
    e.vida = v;
    e.vidaMax = v;
  };
  // ameaça informada vale em qualquer cena (o chefe pode aparecer antes de a luta começar)
  for (const e of eventosNpc) if (e.ameaca || FICHAS[e.retrato]) ganhaVida(e, doEstado(e.nome));
  if (turno.tema !== 'batalha') return;
  for (const e of eventosNpc) if ((e.relacao || doEstado(e.nome)?.relacao) === 'hostil') ganhaVida(e, doEstado(e.nome));
  const temInimigo = eventosNpc.some((e) => (e.relacao || doEstado(e.nome)?.relacao) === 'hostil' && (e.vida == null || e.vida > 0))
    || (state.npcs || []).some((n) => n.relacao === 'hostil' && n.vidaMax && n.vida > 0 && !eventosNpc.some((e) => norm(e.nome) === norm(n.nome) && e.relacao && e.relacao !== 'hostil'));
  if (temInimigo) return;
  const candidatos = [turno.falante || state.campanha.falante, ...(turno.roteiro || []).map((r) => r.quem)]
    .filter((q) => q && q !== 'narrador' && !/^heroi/.test(q) && !herois.has(norm(q)));
  const vistos = new Set();
  for (const nome of candidatos) {
    if (vistos.has(norm(nome)) || vistos.size >= 3) continue;
    vistos.add(norm(nome));
    const base = doEstado(nome);
    const ev = eventosNpc.find((e) => norm(e.nome) === norm(nome));
    if ((ev?.relacao || base?.relacao) === 'aliado' || (base?.vidaMax && base.vida <= 0)) continue;
    if (ev) { ev.relacao = 'hostil'; ganhaVida(ev, base); } else {
      const e = { tipo: 'npc', nome, relacao: 'hostil' };
      ganhaVida(e, base);
      turno.eventos.push(e);
    }
  }
}

class Engine {
  constructor(store, getSettings, getCatalogo) {
    this.store = store;
    this.getSettings = getSettings;
    this.getCatalogo = getCatalogo; // (slug) => catálogo de artes (cenas/retratos)
  }

  /**
   * @param {string} slug
   * @param {{texto?: string, papel?: 'jogador'|'sistema', autor?: string, inicio?: boolean, repetir?: boolean,
   *   acoes?: {heroi: string, texto: string, papel?: 'jogador'|'sistema'}[]}} op
   *   acoes = rodada do co-op (uma por herói); autor = herói de uma ação avulsa
   */
  async jogar(slug, op = {}) {
    if (emAndamento.has(slug)) throw new Error('O mestre ainda está narrando o turno anterior.');
    const ctrl = new AbortController();
    const signal = ctrl.signal;
    emAndamento.set(slug, ctrl);
    const checar = () => { if (signal.aborted) throw new Cancelado(); };
    let adicionou = 0; // quantas mensagens desta chamada entraram (desfeitas se o turno for cancelado)
    let aplicando = false;
    try {
      const settings = await this.getSettings();
      const provedor = PROVEDORES[settings.provedor] || demo;
      await this.store.recuperarTurno(slug); // sobrou um turno pela metade de uma sessão anterior?

      if (op.inicio) {
        await this.store.adicionarMensagens(slug, [{ papel: 'sistema', texto: 'A aventura começa. Planeje o enredo da história inteira (campo enredo) e apresente a cena de abertura, o gancho inicial e uma primeira missão ligada ao ato 1.' }]);
        adicionou = 1;
      } else if (!op.repetir && (op.acoes?.length || op.texto)) {
        const grupoAntes = await this.store.listarHerois(slug);
        const nomeDe = (id) => grupoAntes.find((h) => h.id === id)?.nome;
        const lista = op.acoes?.length ? op.acoes : [{ heroi: op.autor, texto: op.texto, papel: op.papel }];
        await this.store.adicionarMensagens(slug, lista.filter((a) => String(a.texto || '').trim()).map((a) => ({
          papel: a.papel === 'sistema' ? 'sistema' : 'jogador',
          texto: String(a.texto).slice(0, 4000),
          ...(a.heroi && nomeDe(a.heroi) ? { autor: a.heroi, autorNome: nomeDe(a.heroi) } : {}),
        })));
        adicionou = lista.length;
      }

      const state = await this.store.carregar(slug);
      const msgs = state.mensagens;
      // o que o mestre ainda não respondeu: as mensagens depois da última fala dele (uma por herói, no co-op)
      let k = msgs.length;
      while (k > 0 && msgs[k - 1].papel !== 'mestre') k--;
      const pendentes = msgs.slice(k);
      if (!pendentes.length) throw new Error('Nada para o mestre responder.');
      const historico = msgs.slice(0, k);
      const emGrupo = state.grupo.length > 1;
      if (emGrupo) state.grupoCompleto = await this.store.carregarGrupo(slug);
      const linha = (m) => (m.papel === 'sistema' ? `[${m.texto}]` : m.texto);
      const acao = emGrupo
        ? pendentes.map((m) => `- ${m.autorNome || state.grupo[0].nome}: ${linha(m)}`).join('\n')
        : pendentes.map(linha).join('\n');
      const autores = [...new Set(pendentes.map((m) => m.autor).filter(Boolean))];
      const cat = this.getCatalogo ? await this.getCatalogo(slug) : null;
      // Claude Code: a lista de artes só vai quando a sessão é nova (ou a cada 15 turnos) — ele lembra do resto
      const turnoN = state.campanha.turno || 0;
      const mandarArtes = settings.provedor === 'claude-code' && (!state.campanha.claudeSessionId || turnoN % 15 === 0);
      const atual = gm.mensagemTurno(state, acao, mandarArtes ? cat : null);
      const atualComArtes = settings.provedor === 'claude-code' && !mandarArtes ? gm.mensagemTurno(state, acao, cat) : atual;

      let bruto;
      let meta = {};
      if (settings.provedor === 'claude-code') {
        await this.store.garantirClaudeMd(slug);
        const sid = state.campanha.claudeSessionId;
        const lembrete = '\n\nResponda apenas com o JSON do turno, conforme o CLAUDE.md.';
        // sessão nova (ou perdida) recebe uma recapitulação; sessão retomada já lembra de tudo
        // sessão nova: a memória compacta + as últimas mensagens bastam (sem reenviar a história inteira)
        const promptNovo = `${historico.length ? `[ÚLTIMAS MENSAGENS]\n${recapitulacao(historico, 8)}\n\n` : ''}${atualComArtes}${lembrete}`;
        const r = await claudeCode.turno({ settings, cwd: state.pasta, prompt: atual + lembrete, promptNovo, sessionId: sid, signal });
        bruto = gm.extrairJson(r.texto);
        meta = { sessionId: r.sessionId, custo: r.custo };
        if (bruto._invalido) {
          // JSON quebrado e sem nada aproveitável: pede de novo na mesma sessão, uma vez
          checar();
          const r2 = await claudeCode.turno({ settings, cwd: state.pasta, prompt: 'Sua resposta anterior não era um JSON válido e não pôde ser lida. Reenvie a MESMA resposta como um único objeto JSON válido (aspas internas escapadas com \\", sem quebras de linha cruas dentro dos textos, sem texto fora do JSON).', promptNovo: promptNovo, sessionId: r.sessionId || sid, signal });
          bruto = gm.extrairJson(r2.texto);
          meta = { sessionId: r2.sessionId || r.sessionId, custo: (r.custo || 0) + (r2.custo || 0) };
          if (bruto._invalido) throw new Error('O mestre respondeu num formato que não deu para ler. Clique em "Tentar de novo".');
        }
      } else if (settings.provedor === 'api') {
        const lore = await this.store.lerLore(slug);
        // histórico curto: o enredo e a memória (no 'atual') carregam o passado com poucos tokens
        const r = await anthropic.turno({ settings, systemPrompt: gm.systemPromptApi(state.campanha, lore, cat), historico: historico.slice(-10), atual, tool: gm.montarTool(cat || undefined), signal });
        bruto = r.turno;
        meta = { uso: r.uso };
      } else {
        const r = await provedor.turno({ slug, acao, state, cat, signal });
        bruto = r.turno;
      }
      // saiu da tela no meio do turno: nada é aplicado
      checar();

      const turno = gm.normalizarTurno(bruto, state.campanha.tema, cat, { heroi: state.personagem?.nome, herois: state.grupo.map((h) => h.nome) });
      garantirInimigos(turno, state);
      // itens com arte: completa o que o mestre não informou (raridade, pasta, descrição, ícone)
      for (const e of turno.eventos) {
        if (e.tipo !== 'item_ganho' || !cat?.itens) continue;
        const base = cat.itens[slugify(e.nome)];
        if (!base?.raridade) continue;
        e.raridade = e.raridade || base.raridade;
        e.pasta = e.pasta || base.pasta;
        e.descricao = e.descricao || base.desc;
        e.icone = e.icone || base.icone;
      }
      // quem fala no roteiro vira NPC conhecido (ganha ficha, voz ajustável e rosto), mesmo se o mestre esqueceu o evento
      const conhecidos = new Set([...(state.npcs || []).map((n) => slugify(n.nome)), ...turno.eventos.filter((e) => e.tipo === 'npc').map((e) => slugify(e.nome))]);
      for (const r of turno.roteiro || []) {
        const id = slugify(r.quem);
        if (r.quem === 'narrador' || r.quem === 'heroi' || r.quem.startsWith('heroi:') || conhecidos.has(id) || state.grupo.some((h) => slugify(h.nome) === id)) continue;
        conhecidos.add(id);
        turno.eventos.push({ tipo: 'npc', nome: r.quem, relacao: 'desconhecido' });
      }
      // daqui até a mensagem do mestre é "tudo ou nada" (diário do turno)
      this.store.marcar();
      await diario.iniciar(state.pasta, { turno: (state.campanha.turno || 0) + 1 });
      aplicando = true;
      const logs = await this.store.aplicarEventos(slug, turno.eventos, { padrao: autores.length === 1 ? autores[0] : undefined });
      await this.store.aplicarMemoria(slug, turno, { numero: (state.campanha.turno || 0) + 1, dia: turno.dia || state.campanha.dia });

      const campanha = state.campanha;
      const temaMudou = turno.tema !== campanha.tema;
      const capituloNovo = turno.capitulo && turno.capitulo !== campanha.capitulo ? turno.capitulo : null;
      campanha.tema = turno.tema;
      // cenário: o que o mestre escolheu; se ele só trocou o clima, usa a arte padrão do tema
      const cenaAntes = campanha.cena;
      if (turno.cena) campanha.cena = turno.cena;
      else if (temaMudou && cat?.temaPadrao?.[turno.tema]) campanha.cena = cat.temaPadrao[turno.tema];
      if (turno.falante !== null) campanha.falante = turno.falante;
      if (turno.local) campanha.local = turno.local;
      // posição no mapa-múndi: só aceita um local que existe (pelo nome ou id); guarda os visitados
      const noMapa = mapa.acharLocal(turno.local_mapa) || (!turno.local_mapa && turno.local ? mapa.acharLocal(turno.local) : null);
      if (noMapa) {
        campanha.mapaLocal = noMapa.id;
        campanha.mapaVisitados = [...new Set([...(campanha.mapaVisitados || []), noMapa.id])];
      }
      if (turno.periodo) campanha.periodo = turno.periodo;
      if (turno.dia) campanha.dia = turno.dia;
      // inimigo derrotado sai de cena no turno seguinte
      if (logs.some((l) => l.tipo === 'npc_derrotado') && !turno.falante) campanha.falante = '';
      const cenaMudou = campanha.cena !== cenaAntes;
      if (capituloNovo) campanha.capitulo = capituloNovo;
      campanha.turno = (campanha.turno || 0) + 1;
      if (meta.sessionId) campanha.claudeSessionId = meta.sessionId;
      await this.store.salvarCampanha(slug, campanha);

      await this.store.adicionarMensagens(slug, [{
        papel: 'mestre',
        texto: turno.narrativa,
        roteiro: turno.roteiro || undefined,
        tema: turno.tema,
        cena: campanha.cena,
        falante: campanha.falante,
        capituloNovo,
        logs,
        rolagem: turno.rolagem,
        sugestoes: turno.sugestoes,
      }]);
      await diario.concluir(state.pasta);
      aplicando = false;

      return { state: await this.store.carregar(slug), turno, logs, temaMudou, cenaMudou, capituloNovo, meta };
    } catch (e) {
      // erro no meio da aplicação: desfaz o turno inteiro (a ação do jogador fica, para "Tentar de novo")
      if (aplicando) await this.store.recuperarTurno(slug).catch(() => {});
      if (signal.aborted) {
        // desfaz a ação que ninguém respondeu, para a campanha voltar exatamente como estava
        for (let i = 0; i < adicionou; i++) await this.store.removerUltimaMensagem(slug).catch(() => {});
        throw new Cancelado();
      }
      throw e;
    } finally {
      if (emAndamento.get(slug) === ctrl) emAndamento.delete(slug);
    }
  }

  /** Aborta o turno em curso (fetch da API ou processo do Claude Code). */
  cancelar(slug) {
    const c = slug ? emAndamento.get(slug) : null;
    if (c) { c.abort(); return true; }
    if (!slug) { for (const x of emAndamento.values()) x.abort(); }
    return false;
  }

  emCurso(slug) {
    return emAndamento.has(slug);
  }

  async testar() {
    const settings = await this.getSettings();
    return (PROVEDORES[settings.provedor] || demo).testar(settings);
  }
}

module.exports = { Engine };
