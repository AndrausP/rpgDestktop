// Mapa-múndi: locais e rotas (renderer/assets/cenas/mapa-mundi.json, coordenadas da imagem 4k).
// Calcula o caminho mais curto entre dois locais (dias de viagem por terra/mar) e reconhece um local pelo nome.
const fs = require('fs');
const path = require('path');
const { norm } = require('./util');

const ARQUIVO = path.join(__dirname, '..', '..', 'renderer', 'assets', 'cenas', 'mapa-mundi.json');
const TIPO = { city: 'cidade', settlement: 'vila', port: 'porto', landmark: 'marco', pass: 'passagem', island: 'ilha', ruin: 'ruína', hazard: 'perigo' };

let cache = null;
function carregar() {
  if (cache) return cache;
  const m = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
  const porId = new Map(m.locations.map((l) => [l.id, l]));
  const pxDia = { land: m.travel?.landPxPerDay || 320, sea: m.travel?.seaPxPerDay || 480 };
  const comprimento = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  const rotas = m.routes.filter((r) => porId.has(r.from) && porId.has(r.to)).map((r) => ({ ...r, dias: Math.max(0.5, Math.round((comprimento(r.points) / pxDia[r.mode === 'sea' ? 'sea' : 'land']) * 2) / 2) }));
  const vizinhos = new Map(m.locations.map((l) => [l.id, []]));
  for (const r of rotas) {
    vizinhos.get(r.from).push({ para: r.to, rota: r });
    vizinhos.get(r.to).push({ para: r.from, rota: r });
  }
  cache = { ...m, porId, rotas, vizinhos };
  return cache;
}

/** Local pelo id ou pelo nome (sem acento, parcial): "capital" → Capital das Pontes. */
function acharLocal(texto) {
  if (!texto) return null;
  const m = carregar();
  if (m.porId.has(texto)) return m.porId.get(texto);
  const t = norm(texto);
  return m.locations.find((l) => norm(l.name) === t) || m.locations.find((l) => t.includes(norm(l.name))) || m.locations.find((l) => norm(l.name).includes(t) && t.length >= 4) || null;
}

/** Caminho mais curto em dias (Dijkstra). → {dias, trechos: [{de, para, rota, modo, dias}]} ou null. */
function rota(deId, paraId) {
  const m = carregar();
  if (!m.porId.has(deId) || !m.porId.has(paraId)) return null;
  if (deId === paraId) return { dias: 0, trechos: [] };
  const dist = new Map([[deId, 0]]);
  const veio = new Map();
  const abertos = new Set([deId]);
  while (abertos.size) {
    let atual = null;
    for (const a of abertos) if (atual === null || dist.get(a) < dist.get(atual)) atual = a;
    abertos.delete(atual);
    if (atual === paraId) break;
    for (const { para, rota: r } of m.vizinhos.get(atual)) {
      const d = dist.get(atual) + r.dias;
      if (d < (dist.get(para) ?? Infinity)) { dist.set(para, d); veio.set(para, { de: atual, rota: r }); abertos.add(para); }
    }
  }
  if (!veio.has(paraId)) return null;
  const trechos = [];
  for (let p = paraId; p !== deId; p = veio.get(p).de) {
    const { de, rota: r } = veio.get(p);
    trechos.unshift({ de, para: p, rota: r.id, nomeRota: r.name, modo: r.mode, dias: r.dias });
  }
  return { dias: dist.get(paraId), trechos };
}

/** Texto curto de uma viagem: "Porto Ocidental → Fortaleza do Sul pela Costa Ocidental (mar, 3 dias)". */
function descreverRota(deId, paraId) {
  const m = carregar();
  const r = rota(deId, paraId);
  if (!r || !r.trechos.length) return null;
  const partes = r.trechos.map((t) => `${m.porId.get(t.para).name} via ${t.nomeRota} (${t.modo === 'sea' ? 'mar' : 'terra'}, ${t.dias} dia${t.dias === 1 ? '' : 's'})`);
  return `${m.porId.get(deId).name} → ${partes.join(' → ')}; total ~${r.dias} dia${r.dias === 1 ? '' : 's'}`;
}

/** Bloco compacto para o prompt do mestre: locais e ligações (≈ 450 tokens). */
function resumoParaMestre() {
  const m = carregar();
  const nome = (id) => m.porId.get(id).name;
  const locais = m.locations.map((l) => `${l.name} [${TIPO[l.type] || l.type}]`).join('; ');
  const ligacoes = m.rotas.map((r) => `${nome(r.from)} — ${nome(r.to)}: ${r.name} (${r.mode === 'sea' ? 'mar' : 'terra'}, ${r.dias}d)`).join('; ');
  return `MAPA-MÚNDI — o continente onde a história acontece (a menos que a lore da campanha diga outro mundo).
- Viagens seguem estas rotas e duram os dias indicados; não há atalho entre lugares distantes. Cada dia de estrada pode ter um encontro.
- Quando o grupo estiver em (ou chegar a) um destes locais, preencha "local_mapa" com o nome exato. Entre dois locais, use o último local por onde passou.
Locais: ${locais}
Rotas: ${ligacoes}`;
}

/** Onde o grupo está e para onde dá para ir dali (vai no estado de cada turno). */
function posicaoParaMestre(id) {
  const m = carregar();
  const l = m.porId.get(id);
  if (!l) return '';
  const viz = m.vizinhos.get(id).map(({ para, rota: r }) => `${m.porId.get(para).name} via ${r.name} (${r.mode === 'sea' ? 'mar' : 'terra'}, ${r.dias}d)`);
  return `No mapa: ${l.name}${viz.length ? ` — dali: ${viz.join('; ')}` : ''}`;
}

/** Dados para a tela (mapa interativo). */
function paraTela() {
  const m = carregar();
  return { image: m.image, locations: m.locations.map((l) => ({ ...l, tipo: TIPO[l.type] || l.type })), routes: m.rotas };
}

module.exports = { carregar, acharLocal, rota, descreverRota, resumoParaMestre, posicaoParaMestre, paraTela, TIPO };
