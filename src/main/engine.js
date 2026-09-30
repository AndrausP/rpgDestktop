// Orquestra um turno: salva a ação → chama o provedor → aplica eventos nas pastas → salva a narrativa.
const gm = require('./gm-prompt');
const { slugify } = require('./util');
const anthropic = require('./providers/anthropic');
const claudeCode = require('./providers/claude-code');
const demo = require('./providers/demo');

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

class Engine {
  constructor(store, getSettings, getCatalogo) {
    this.store = store;
    this.getSettings = getSettings;
    this.getCatalogo = getCatalogo; // (slug) => catálogo de artes (cenas/retratos)
  }

  /**
   * @param {string} slug
   * @param {{texto?: string, papel?: 'jogador'|'sistema', inicio?: boolean, repetir?: boolean}} op
   */
  async jogar(slug, op = {}) {
    if (emAndamento.has(slug)) throw new Error('O mestre ainda está narrando o turno anterior.');
    const ctrl = new AbortController();
    const signal = ctrl.signal;
    emAndamento.set(slug, ctrl);
    const checar = () => { if (signal.aborted) throw new Cancelado(); };
    let adicionou = false;
    try {
      const settings = await this.getSettings();
      const provedor = PROVEDORES[settings.provedor] || demo;

      if (op.inicio) {
        await this.store.adicionarMensagens(slug, [{ papel: 'sistema', texto: 'A aventura começa. Apresente a cena de abertura, o gancho inicial e uma primeira missão.' }]);
        adicionou = true;
      } else if (op.texto && !op.repetir) {
        await this.store.adicionarMensagens(slug, [{ papel: op.papel === 'sistema' ? 'sistema' : 'jogador', texto: String(op.texto).slice(0, 4000) }]);
        adicionou = true;
      }

      const state = await this.store.carregar(slug);
      const msgs = state.mensagens;
      const ultima = msgs[msgs.length - 1];
      if (!ultima || ultima.papel === 'mestre') throw new Error('Nada para o mestre responder.');
      const historico = msgs.slice(0, -1);
      const acao = ultima.papel === 'sistema' ? `[${ultima.texto}]` : ultima.texto;
      const cat = this.getCatalogo ? await this.getCatalogo(slug) : null;
      const atual = gm.mensagemTurno(state, acao, settings.provedor === 'claude-code' ? cat : null);

      let bruto;
      let meta = {};
      if (settings.provedor === 'claude-code') {
        await this.store.garantirClaudeMd(slug);
        const sid = state.campanha.claudeSessionId;
        const lembrete = '\n\nResponda apenas com o JSON do turno, conforme o CLAUDE.md.';
        // sessão nova (ou perdida) recebe uma recapitulação; sessão retomada já lembra de tudo
        const promptNovo = `${historico.length ? `[RECAPITULAÇÃO DA HISTÓRIA ATÉ AQUI]\n${recapitulacao(historico)}\n\n` : ''}${atual}${lembrete}`;
        const r = await claudeCode.turno({ settings, cwd: state.pasta, prompt: atual + lembrete, promptNovo, sessionId: sid, signal });
        bruto = gm.extrairJson(r.texto);
        meta = { sessionId: r.sessionId, custo: r.custo };
      } else if (settings.provedor === 'api') {
        const lore = await this.store.lerLore(slug);
        const r = await anthropic.turno({ settings, systemPrompt: gm.systemPromptApi(state.campanha, lore, cat), historico, atual, tool: gm.montarTool(cat || undefined), signal });
        bruto = r.turno;
        meta = { uso: r.uso };
      } else {
        const r = await provedor.turno({ slug, acao, state, cat, signal });
        bruto = r.turno;
      }
      // saiu da tela no meio do turno: nada é aplicado
      checar();

      const turno = gm.normalizarTurno(bruto, state.campanha.tema, cat);
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
        if (r.quem === 'narrador' || r.quem === 'heroi' || conhecidos.has(id) || slugify(state.personagem.nome) === id) continue;
        conhecidos.add(id);
        turno.eventos.push({ tipo: 'npc', nome: r.quem, relacao: 'desconhecido' });
      }
      const logs = await this.store.aplicarEventos(slug, turno.eventos);

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

      return { state: await this.store.carregar(slug), turno, logs, temaMudou, cenaMudou, capituloNovo, meta };
    } catch (e) {
      if (signal.aborted) {
        // desfaz a ação que ninguém respondeu, para a campanha voltar exatamente como estava
        if (adicionou) await this.store.removerUltimaMensagem(slug).catch(() => {});
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
