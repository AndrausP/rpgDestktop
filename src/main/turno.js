// Valida e normaliza o que o modelo devolveu (tool use da API ou JSON do Claude Code) antes de tocar nas pastas:
// nada fora do esquema passa, textos são cortados no tamanho, formatos alternativos são aceitos.
const { TEMAS, TIPOS_EVENTO, ATRIBUTOS, PERIODOS, EMOCOES } = require('./regras');

/** Aceita qualquer coisa vinda do modelo e devolve um turno válido. */
/**
 * @param {{heroi?: string, herois?: string[]}} [op] nome do herói (solo) ou nomes de todos os heróis do grupo
 */
function normalizarTurno(t, temaAtual, cat, { heroi = '', herois = [] } = {}) {
  if (!t || typeof t !== 'object') t = { narrativa: String(t || '') };
  const tema = TEMAS[t.tema] ? t.tema : temaAtual || 'taverna';
  const eventos = Array.isArray(t.eventos) ? t.eventos.filter((e) => e && TIPOS_EVENTO.includes(e.tipo)) : [];
  // o modelo às vezes flexiona ("aliada", "inimigo", "hostis"): volta para os valores que a tela entende
  for (const e of eventos) {
    if (e.heroi != null) e.heroi = String(e.heroi).trim().slice(0, 60) || undefined;
    if (e.tipo !== 'npc' || e.relacao == null) continue;
    const r = String(e.relacao).toLowerCase();
    e.relacao = /^alia/.test(r) ? 'aliado' : /^(hostil|hostis|inimig)/.test(r) ? 'hostil' : /^neutr/.test(r) ? 'neutro' : 'desconhecido';
    if (e.tamanho && !['medio', 'grande', 'enorme'].includes(e.tamanho)) e.tamanho = /enorm|imens|colos/i.test(e.tamanho) ? 'enorme' : /grand/i.test(e.tamanho) ? 'grande' : 'medio';
    if (e.alcance && !['corpo', 'distancia'].includes(e.alcance)) e.alcance = /dist|arco|magi|longe/i.test(e.alcance) ? 'distancia' : 'corpo';
  }
  let rolagem = null;
  if (t.rolagem && typeof t.rolagem === 'object' && t.rolagem.motivo) {
    rolagem = {
      dado: /^d\d+$/i.test(t.rolagem.dado || '') ? t.rolagem.dado.toLowerCase() : 'd20',
      atributo: ATRIBUTOS.includes(t.rolagem.atributo) ? t.rolagem.atributo : null,
      dificuldade: Number.isFinite(+t.rolagem.dificuldade) ? +t.rolagem.dificuldade : null,
      motivo: String(t.rolagem.motivo),
      ...(t.rolagem.heroi ? { heroi: String(t.rolagem.heroi).slice(0, 60) } : {}),
    };
  }
  const cenaOk = cat ? cat.cenas.some((c) => c.id === t.cena) : !!t.cena;
  const roteiro = normalizarRoteiro(t.roteiro, herois.length > 1 ? herois : heroi);
  const narrativa = roteiro.length ? comporNarrativa(roteiro) : String(t.narrativa || '(O mestre ficou em silêncio...)').trim();
  return {
    narrativa,
    roteiro: roteiro.length ? roteiro : null,
    tema,
    cena: cenaOk ? t.cena : null,
    falante: typeof t.falante === 'string' ? t.falante.trim().slice(0, 60) : null,
    local: t.local ? String(t.local).slice(0, 60) : null,
    local_mapa: typeof t.local_mapa === 'string' && t.local_mapa.trim() ? t.local_mapa.trim().slice(0, 60) : null,
    periodo: PERIODOS.includes(t.periodo) ? t.periodo : null,
    dia: Number.isFinite(+t.dia) && +t.dia > 0 ? Math.floor(+t.dia) : null,
    capitulo: t.capitulo ? String(t.capitulo).slice(0, 80) : null,
    eventos,
    rolagem,
    sugestoes: (Array.isArray(t.sugestoes) ? t.sugestoes : []).map(String).filter(Boolean).slice(0, 4),
    memoria: normalizarMemoria(t.memoria),
    enredo: normalizarEnredo(t.enredo),
  };
}

/**
 * @param {string|string[]} heroi nome do herói (solo → falas dele viram 'heroi') ou nomes do grupo
 *   (co-op → 'heroi:<nome>', para a tela e a voz saberem de qual herói é a fala)
 */
function normalizarRoteiro(r, heroi = '') {
  if (!Array.isArray(r)) return [];
  const grupo = Array.isArray(heroi) ? heroi.filter(Boolean) : [];
  const nomeHeroi = Array.isArray(heroi) ? '' : String(heroi || '').trim().toLowerCase();
  const doGrupo = (q) => grupo.find((n) => n.toLowerCase() === q.toLowerCase().replace(/^her[oó]i:\s*/, ''));
  return r
    .filter((x) => x && typeof x === 'object' && String(x.texto || '').trim())
    .map((x) => {
      let quem = String(x.quem || 'narrador').trim().slice(0, 60) || 'narrador';
      if (/^(narrador|narrator|mestre)$/i.test(quem)) quem = 'narrador';
      // fala do personagem do jogador (o mestre não deveria, mas acontece): fica marcada como 'heroi',
      // para a tela mostrar o rosto do herói e a voz dele ler — nunca vira NPC
      else if (grupo.length && doGrupo(quem)) quem = `heroi:${doGrupo(quem)}`;
      else if (/^(heroi|herói|jogador|player|voce|você)$/i.test(quem) || (nomeHeroi && quem.toLowerCase() === nomeHeroi)) quem = 'heroi';
      const texto = String(x.texto).trim().replace(/^[—–-]\s*/, '').slice(0, 1500);
      return { quem, texto, emocao: EMOCOES.includes(x.emocao) ? x.emocao : 'neutro' };
    })
    .slice(0, 24);
}

/** Texto corrido do roteiro — vai para o histórico, a crônica e o contexto do modelo. */
function comporNarrativa(roteiro) {
  return roteiro.map((r) => (r.quem === 'narrador' ? r.texto : `**${r.quem === 'heroi' ? 'Você' : r.quem.replace(/^heroi:/, '')}:** — ${r.texto}`)).join('\n\n');
}

const lista = (x, n, max = 200) => (Array.isArray(x) ? x : []).map((v) => String(v || '').trim().slice(0, max)).filter(Boolean).slice(0, n);
const texto = (x, max) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : undefined);

function normalizarMemoria(m) {
  if (!m || typeof m !== 'object') return {};
  return {
    resumo: texto(m.resumo, 220),
    fatos: lista(m.fatos, 4),
    ato: m.ato !== null && m.ato !== '' && Number.isFinite(+m.ato) ? Math.max(0, Math.floor(+m.ato)) : undefined,
    ganchos_novos: lista(m.ganchos_novos, 4),
    ganchos_resolvidos: lista(m.ganchos_resolvidos, 6),
    enredo_ajuste: texto(m.enredo_ajuste, 300),
    resumo_geral: texto(m.resumo_geral, 1400),
  };
}

/** "Nome, o que é/quer" ou "Nome: ..." ou "Nome — ..." → {nome, objetivo}. */
function separarNome(s) {
  const m = String(s).match(/^\s*([^,:—–(]{2,80}?)\s*(?:[,:—–(]|\s-\s)\s*(.*)$/s);
  return m ? { nome: m[1].trim(), resto: m[2].replace(/\)\s*$/, '').trim() } : { nome: String(s).trim(), resto: '' };
}
/** Aceita o ato como objeto {titulo, objetivo, virada} ou como texto "Ato 1 — O Chamado: objetivo". */
function normalizarAto(a) {
  if (typeof a === 'string') {
    const sem = a.replace(/^\s*ato\s*\d+\s*[—–:.-]?\s*/i, '');
    const { nome, resto } = separarNome(sem);
    return nome ? { titulo: nome.slice(0, 100), objetivo: resto.slice(0, 300) } : null;
  }
  if (!a || typeof a !== 'object' || !(a.titulo || a.nome)) return null;
  return { titulo: texto(a.titulo || a.nome, 100), objetivo: texto(a.objetivo || a.descricao, 300) || '', virada: texto(a.virada, 300) };
}
function normalizarEnredo(e) {
  if (!e || typeof e !== 'object' || !Array.isArray(e.atos)) return null;
  const atos = e.atos.slice(0, 6).map(normalizarAto).filter(Boolean);
  if (!atos.length) return null;
  // antagonista como objeto ou texto livre ("A Viúva do Brejo, espírito que usa os sinos...")
  let ant = e.antagonista && typeof e.antagonista === 'object' ? e.antagonista : {};
  if (typeof e.antagonista === 'string' && e.antagonista.trim()) {
    const { nome, resto } = separarNome(e.antagonista);
    ant = { nome, objetivo: resto };
  }
  return {
    titulo: texto(e.titulo, 120) || 'A Jornada',
    premissa: texto(e.premissa, 500) || '',
    antagonista: { nome: texto(ant.nome, 80), objetivo: texto(ant.objetivo, 200), segredo: texto(ant.segredo, 300) },
    segredos: lista(e.segredos, 6, 300),
    atos,
    ganchos: lista(e.ganchos, 6),
    final: texto(e.final, 400),
  };
}

/**
 * Conserta os defeitos comuns de JSON escrito à mão por um modelo: quebra de linha crua dentro de texto,
 * aspas sem escape no meio de uma fala, vírgula sobrando antes de } ou ], e resposta cortada no meio
 * (fecha o texto e as chaves abertas).
 */
function repararJson(s) {
  let out = '';
  let dentro = false;
  const pilha = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (dentro) {
      if (c === '\\') { out += c + (s[i + 1] ?? ''); i++; continue; }
      if (c === '"') {
        // fecha o texto só se o que vem depois faz sentido em JSON; senão é aspa de diálogo sem escape
        const resto = s.slice(i + 1);
        const fecha = /^\s*($|[:}\]])/.test(resto) || /^\s*,\s*($|["{\[\]}]|-?\d|(true|false|null)\b)/.test(resto);
        if (fecha) { dentro = false; out += c; } else out += '\\"';
        continue;
      }
      out += c === '\n' ? '\\n' : c === '\r' ? '' : c === '\t' ? '\\t' : c;
      continue;
    }
    if (c === '"') { dentro = true; out += c; continue; }
    if (c === '{' || c === '[') pilha.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') pilha.pop();
    out += c;
  }
  if (dentro) out += '"';
  out = out.replace(/,\s*$/, '');
  while (pilha.length) out = out.replace(/,\s*$/, '').replace(/:\s*$/, ': null') + pilha.pop();
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/** Último recurso: tira do texto o que dá para aproveitar (falas do roteiro e campos simples). */
function resgatarCampos(s) {
  const lerTexto = (x) => { try { return JSON.parse(`"${x}"`); } catch { return x.replace(/\\"/g, '"').replace(/\\n/g, '\n'); } };
  const roteiro = [];
  const re = /\{\s*"quem"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"texto"\s*:\s*"((?:[^"\\]|\\.)*)"(?:\s*,\s*"emocao"\s*:\s*"((?:[^"\\]|\\.)*)")?/g;
  for (const m of s.matchAll(re)) roteiro.push({ quem: lerTexto(m[1]), texto: lerTexto(m[2]), emocao: m[3] ? lerTexto(m[3]) : 'neutro' });
  const campo = (k) => { const m = s.match(new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)); return m ? lerTexto(m[1]) : undefined; };
  const t = { eventos: [], sugestoes: [] };
  if (roteiro.length) t.roteiro = roteiro;
  for (const k of ['narrativa', 'tema', 'cena', 'falante', 'local', 'local_mapa', 'periodo', 'capitulo']) { const v = campo(k); if (v !== undefined) t[k] = v; }
  const dia = s.match(/"dia"\s*:\s*(\d+)/);
  if (dia) t.dia = +dia[1];
  return t.roteiro || t.narrativa ? t : null;
}

/**
 * Extrai o JSON do turno de uma resposta em texto livre (Claude Code). Nunca devolve o JSON cru como narração:
 * se nada der certo, devolve {_invalido: true} para quem chamou pedir de novo.
 */
function extrairJson(texto) {
  const s = String(texto || '').replace(/^﻿/, '').trim();
  const tentativas = [];
  const cerca = s.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (cerca) tentativas.push(cerca[1].trim());
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0) tentativas.push(b > a ? s.slice(a, b + 1) : s.slice(a));
  if (a >= 0) tentativas.push(s.slice(a)); // resposta cortada: sem o } final
  tentativas.push(s);
  for (const t of tentativas) {
    try { const o = JSON.parse(t); if (o && typeof o === 'object') return o; } catch { /* tenta consertar */ }
  }
  // consertando, a versão mais longa primeiro (uma resposta cortada perde menos)
  for (const t of [...tentativas].sort((x, y) => y.length - x.length)) {
    try { const o = JSON.parse(repararJson(t)); if (o && typeof o === 'object' && (o.roteiro || o.narrativa)) return o; } catch { /* próxima */ }
  }
  const resgate = a >= 0 ? resgatarCampos(s.slice(a)) : null;
  if (resgate) return { ...resgate, _resgatado: true };
  // texto puro, sem cara de JSON: é a própria narração
  if (a < 0 || !/"(roteiro|narrativa|eventos)"\s*:/.test(s)) return { narrativa: s, eventos: [], sugestoes: [] };
  return { _invalido: true, eventos: [], sugestoes: [] };
}

/** Mensagem antiga do mestre que ficou com o JSON cru no texto: mostra só a narração. */
function repararMensagemMestre(m) {
  if (!m || m.papel !== 'mestre' || typeof m.texto !== 'string' || !/^\s*(```|\{)/.test(m.texto) || !/"(roteiro|narrativa)"\s*:/.test(m.texto)) return m;
  const t = extrairJson(m.texto);
  if (t._invalido) return m;
  const roteiro = normalizarRoteiro(t.roteiro, '');
  const narrativa = roteiro.length ? comporNarrativa(roteiro) : String(t.narrativa || '').trim();
  return narrativa ? { ...m, texto: narrativa, roteiro: roteiro.length ? roteiro : m.roteiro } : m;
}

module.exports = { normalizarTurno, normalizarRoteiro, normalizarMemoria, normalizarEnredo, comporNarrativa, extrairJson, repararJson, repararMensagemMestre };
