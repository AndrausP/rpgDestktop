// Enredo e memória compacta da campanha (historia/enredo.json e historia/memoria.json).
// Pouco texto, sem perder fatos: resumo geral + fatos duráveis + linha do tempo com teto + ganchos abertos.
const path = require('path');
const { norm, readJson, writeJson } = require('./util');

const MEMORIA_VAZIA = { resumo: '', fatos: [], linha: [], ganchos: [] };
const MEMORIA_LINHAS_MAX = 60; // teto duro da linha do tempo
const MEMORIA_LINHAS_APOS_COMPACTAR = 8;
const MEMORIA_COMPACTAR_A_PARTIR = 30; // o app pede [COMPACTAR MEMÓRIA] ao mestre a partir daqui
const MEMORIA_FATOS_MAX = 40; // os mais recentes; os antigos ficam no resumo geral quando o mestre compacta

/** Aplica o que o mestre registrou neste turno (enredo novo, ato, fatos, ganchos, linha do tempo). */
async function aplicarMemoria(store, slug, turno, { numero, dia }) {
  const d = path.join(store.dir(slug), 'historia');
  const fEnredo = path.join(d, 'enredo.json');
  const fMem = path.join(d, 'memoria.json');
  let enredo = await readJson(fEnredo, null);
  const mem = { ...MEMORIA_VAZIA, ...((await readJson(fMem, {})) || {}) };
  const m = turno.memoria || {};
  const n = (x) => norm(x).replace(/[^a-z0-9 ]/g, '').trim();

  if (turno.enredo && (!enredo || !enredo.atos?.length)) {
    enredo = { ...turno.enredo, criadoEm: new Date().toISOString() };
    enredo.atos = (enredo.atos || []).map((a, i) => ({ ...a, estado: i === 0 ? 'atual' : 'futuro' }));
    mem.ganchos = [...new Set([...(mem.ganchos || []), ...(turno.enredo.ganchos || [])])].slice(-12);
  }
  if (enredo && Number.isInteger(m.ato) && enredo.atos?.[m.ato] && enredo.atos[m.ato].estado !== 'atual') {
    enredo.atos = enredo.atos.map((a, i) => ({ ...a, estado: i < m.ato ? 'concluido' : i === m.ato ? 'atual' : 'futuro' }));
  }
  if (enredo && m.enredo_ajuste) enredo.ajustes = [...(enredo.ajustes || []), `T${numero}: ${m.enredo_ajuste}`].slice(-10);

  if (m.resumo) mem.linha = [...mem.linha, `T${numero} D${dia || 1}: ${m.resumo}`];
  const conhecidos = new Set(mem.fatos.map(n));
  // fato = permanente: vida/HP e estado do combate não entram (já estão na ficha e no NPC)
  const passageiro = /\b\d+\s*(de|\/)\s*\d+\s*(de vida|pv|hp)?\b|\b(de vida|pontos de vida|\bhp\b|\bpv\b|adjacente|ferid[oa] no|regener)/i;
  for (const f of m.fatos || []) if (!conhecidos.has(n(f)) && !passageiro.test(f)) { mem.fatos.push(f); conhecidos.add(n(f)); }
  mem.fatos = mem.fatos.slice(-MEMORIA_FATOS_MAX);
  const resolvidos = new Set((m.ganchos_resolvidos || []).map(n));
  mem.ganchos = [...(mem.ganchos || []).filter((g) => !resolvidos.has(n(g))), ...(m.ganchos_novos || [])];
  mem.ganchos = [...new Map(mem.ganchos.map((g) => [n(g), g])).values()].slice(-12);
  // o mestre compactou a linha do tempo: o resumo geral absorve o começo, ficam só as linhas recentes.
  // Só corta quando o app pediu a compactação — um resumo_geral espontâneo atualiza o resumo, sem apagar nada.
  if (m.resumo_geral) {
    const pedido = mem.linha.length > MEMORIA_COMPACTAR_A_PARTIR; // > porque a linha deste turno já entrou
    if (pedido || !mem.resumo) mem.resumo = m.resumo_geral;
    if (pedido) mem.linha = mem.linha.slice(-MEMORIA_LINHAS_APOS_COMPACTAR);
  }
  mem.linha = mem.linha.slice(-MEMORIA_LINHAS_MAX);
  mem.atualizadaEm = new Date().toISOString();
  store.marcar();
  if (enredo) await writeJson(fEnredo, enredo);
  await writeJson(fMem, mem);
  return { enredo, memoria: mem };
}

module.exports = { aplicarMemoria, MEMORIA_VAZIA };
