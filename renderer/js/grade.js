// Grade tática do mapa de batalha: cada criatura ocupa quadrados inteiros (1 quadrado = 5 pés),
// nunca em cima de parede/pilar/água e nunca duas no mesmo quadrado.
// Lógica pura (sem DOM) — testável com node.

const VIZ = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const PES = 5; // pés por quadrado
export const PASSOS_POR_TURNO = 6; // 30 pés de deslocamento

/** Tamanho em quadrados (lado): medio 1, grande 2, enorme 3. */
const GRANDES = /\b(ogro|troll|urso|golem|minotauro|elemental|quimera|manticora|grifo|wyvern|serpe|boi|cervo|sapo|arvore|treant|rainha|anjo|colosso|cavalo|lobo atroz|aranha gigante|verme)/;
const ENORMES = /\b(dragao|gigante|hidra|kraken|behemoth|titan|leviata|boca do pantano|devorador de luz)/;
const NORM = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/-/g, ' ');
export function tamanhoDe(npc) {
  if (npc?.tamanho === 'enorme') return 3;
  if (npc?.tamanho === 'grande') return 2;
  if (npc?.tamanho === 'medio') return 1;
  const t = NORM(`${npc?.nome} ${npc?.retrato}`);
  if (ENORMES.test(t)) return 3;
  if (GRANDES.test(t)) return 2;
  return 1;
}
const DISTANCIA = /\b(arqueir|besteir|atirador|mago|maga|feiticeir|bruxa|bruxo|xama|necromante|cultista|sacerdot|bispo|clerig|cacador)/;
export function aDistancia(npc) {
  if (npc?.alcance) return npc.alcance === 'distancia';
  return DISTANCIA.test(NORM(`${npc?.nome} ${npc?.descricao} ${npc?.retrato}`));
}

/**
 * @param {{x:number[], y:number[], zona:[number,number], mapa:string[]}} g
 */
export function criarGrade(g) {
  const [c0, r0] = g.zona;
  const cols = g.mapa[0].length;
  const rows = g.mapa.length;
  let heroi = null;
  const chao = g.mapa.map((linha, r) => [...linha].map((ch, c) => {
    if (ch === 'h') heroi = [c0 + c, r0 + r];
    return ch !== '#';
  }));
  const dentro = (c, r) => c >= c0 && r >= r0 && c < c0 + cols && r < r0 + rows;
  const livre = (c, r) => dentro(c, r) && chao[r - r0][c - c0];
  /** Retângulo em pixels da imagem (usa as linhas reais desenhadas). */
  const rect = (c, r, tam = 1) => ({ x: g.x[c], y: g.y[r], w: g.x[c + tam] - g.x[c], h: g.y[r + tam] - g.y[r] });
  /** Todos os quadrados de uma criatura cabem no chão? */
  const cabe = (c, r, tam) => {
    for (let i = 0; i < tam; i++) for (let j = 0; j < tam; j++) if (!livre(c + i, r + j)) return false;
    return true;
  };
  return { c0, r0, cols, rows, heroi: heroi || [c0 + (cols >> 1), r0 + rows - 1], livre, cabe, rect, x: g.x, y: g.y };
}

/** Quadrados ocupados por uma criatura em (c,r) com lado tam. */
export function pegada(p, tam) {
  const q = [];
  for (let i = 0; i < tam; i++) for (let j = 0; j < tam; j++) q.push(`${p.c + i},${p.r + j}`);
  return q;
}

/** Distância em quadrados entre duas criaturas (regra do D&D 5e: diagonal conta 1), borda a borda. */
export function distancia(a, ta, b, tb) {
  const dx = Math.max(0, a.c - (b.c + tb - 1), b.c - (a.c + ta - 1));
  const dy = Math.max(0, a.r - (b.r + tb - 1), b.r - (a.r + ta - 1));
  return Math.max(dx, dy);
}
export const pes = (quadrados) => Math.max(PES, quadrados * PES);

/** BFS pelo chão a partir de uma (ou várias) posições. Devolve Map "c,r" → passos. */
function mapaDePassos(grade, inicio, tam, bloqueados = new Set()) {
  const inicios = Array.isArray(inicio) ? inicio : [inicio];
  const dist = new Map(inicios.map((p) => [`${p.c},${p.r}`, 0]));
  const fila = [...inicios];
  while (fila.length) {
    const p = fila.shift();
    const d = dist.get(`${p.c},${p.r}`);
    for (const [dc, dr] of VIZ) {
      const n = { c: p.c + dc, r: p.r + dr };
      const k = `${n.c},${n.r}`;
      if (dist.has(k) || !grade.cabe(n.c, n.r, tam)) continue;
      if (pegada(n, tam).some((q) => bloqueados.has(q))) continue;
      // criatura média não corta quina de obstáculo na diagonal (as grandes se espremem)
      if (tam === 1 && dc && dr && (!grade.livre(p.c + dc, p.r) || !grade.livre(p.c, p.r + dr))) continue;
      dist.set(k, d + 1);
      fila.push(n);
    }
  }
  return dist;
}

/**
 * Posiciona e move as criaturas.
 * @param {ReturnType<typeof criarGrade>} grade
 * @param {Map<string,{c:number,r:number}>} pos posições atuais (é atualizado)
 * @param {{id:string, tam:number, heroi?:boolean, vivo:boolean, distancia?:boolean}[]} lista
 * @param {{mover?: boolean}} op mover = passou um turno de combate (inimigos avançam)
 */
export function posicionar(grade, pos, lista, { mover = false } = {}) {
  const ids = new Set(lista.map((x) => x.id));
  for (const k of [...pos.keys()]) if (!ids.has(k)) pos.delete(k);
  // quem não coube no tamanho real (dragão num corredor) ficou com o maior tamanho que cabe
  for (const x of lista) if (pos.get(x.id)?.t) x.tam = pos.get(x.id).t;
  const herois = lista.filter((x) => x.heroi);
  const heroi = herois[0]; // o líder entra pela entrada do mapa; o resto do grupo, ao lado
  const ocupado = (exceto) => {
    const s = new Set();
    for (const x of lista) if (x.id !== exceto && pos.has(x.id)) pegada(pos.get(x.id), x.tam).forEach((q) => s.add(q));
    return s;
  };
  const encaixa = (p, tam, exceto) => grade.cabe(p.c, p.r, tam) && !pegada(p, tam).some((q) => ocupado(exceto).has(q));

  // herói: entrada do mapa (ou o chão livre mais perto dela)
  if (heroi && (!pos.has(heroi.id) || !encaixa(pos.get(heroi.id), 1, heroi.id))) {
    const [hc, hr] = grade.heroi;
    pos.set(heroi.id, maisPerto(grade, { c: hc, r: hr }, 1, (p) => encaixa(p, 1, heroi.id)) || { c: hc, r: hr });
  }
  for (const x of herois.slice(1)) {
    if (pos.has(x.id) && encaixa(pos.get(x.id), 1, x.id)) continue;
    const base = pos.get(heroi.id);
    const p = maisPerto(grade, base, 1, (q) => encaixa(q, 1, x.id));
    if (p) pos.set(x.id, p);
  }
  const H = heroi && pos.get(heroi.id);
  const centro = { c: grade.c0 + grade.cols / 2, r: grade.r0 + grade.rows / 2 };
  const frente = H ? norm2(centro.c - H.c, centro.r - H.r) : [0, -1];

  // inimigos novos: 25-35 pés do herói, do lado de dentro do mapa, sem colar um no outro
  for (const x of lista) {
    if (x.heroi || (pos.has(x.id) && encaixa(pos.get(x.id), x.tam, x.id))) continue;
    const procurar = (tam, comCaminho) => {
      const alcancaveis = H && comCaminho ? chegaAoHeroi(grade, H, tam) : null;
      let melhor = null;
      for (let r = grade.r0; r < grade.r0 + grade.rows; r++) {
        for (let c = grade.c0; c < grade.c0 + grade.cols; c++) {
          const p = { c, r };
          if (!encaixa(p, tam, x.id)) continue;
          if (alcancaveis && !alcancaveis.has(`${c},${r}`)) continue; // precisa haver caminho até o herói
          const d = H ? distancia(p, tam, H, 1) : 5;
          const alvo = x.distancia ? 6 : 5;
          const lado = H ? (c + (tam - 1) / 2 - H.c) * frente[0] + (r + (tam - 1) / 2 - H.r) * frente[1] : 0;
          const vizinhos = lista.filter((o) => !o.heroi && o.id !== x.id && pos.has(o.id)).map((o) => distancia(p, tam, pos.get(o.id), o.tam));
          const perto = vizinhos.length ? Math.min(...vizinhos) : 9;
          const nota = Math.abs(d - alvo) * 3 - Math.min(lado, 6) + (perto < 2 ? 8 : 0) + (perto > 4 ? 1.5 : 0) + (d < 3 ? 20 : 0);
          if (!melhor || nota < melhor.nota) melhor = { p, nota };
        }
      }
      return melhor?.p;
    };
    let achou = null;
    for (let tam = x.tam; tam >= 1 && !achou; tam--) {
      const p = procurar(tam, true) || (tam === 1 ? procurar(1, false) : null);
      if (p) achou = { ...p, ...(tam !== x.tam ? { t: tam } : {}) };
      if (p && tam !== x.tam) x.tam = tam;
    }
    if (achou) pos.set(x.id, achou);
  }

  // a cada turno: corpo a corpo avança até ficar adjacente; à distância mantém 20-30 pés
  if (mover && H) {
    for (const x of lista) {
      if (x.heroi || !x.vivo || !pos.has(x.id)) continue;
      const p = pos.get(x.id);
      // persegue o herói de pé mais próximo
      const alvos = herois.filter((h) => h.vivo !== false && pos.has(h.id)).map((h) => pos.get(h.id));
      const A = (alvos.length ? alvos : [H]).reduce((m, a) => (distancia(p, x.tam, a, 1) < distancia(p, x.tam, m, 1) ? a : m));
      const d = distancia(p, x.tam, A, 1);
      const quer = x.distancia ? (d >= 4 && d <= 6 ? null : [4, 6]) : (d <= 1 ? null : [1, 1]);
      if (!quer) continue;
      const passos = mapaDePassos(grade, p, x.tam, ocupado(x.id));
      let melhor = null;
      for (const [k, n] of passos) {
        if (n > PASSOS_POR_TURNO) continue;
        const [c, r] = k.split(',').map(Number);
        const q = { c, r };
        if (!encaixa(q, x.tam, x.id)) continue;
        const dq = distancia(q, x.tam, A, 1);
        const fora = dq < quer[0] ? quer[0] - dq : dq > quer[1] ? dq - quer[1] : 0;
        const nota = fora * 10 + n * 0.1;
        if (!melhor || nota < melhor.nota) melhor = { q, nota };
      }
      if (melhor) pos.set(x.id, melhor.q);
    }
  }
  return pos;
}

/** Posições (canto de cima à esquerda) de onde uma criatura desse tamanho consegue chegar ao lado do herói. */
const cacheAlcance = new WeakMap();
function chegaAoHeroi(grade, H, tam) {
  const k = `${H.c},${H.r},${tam}`;
  const cache = cacheAlcance.get(grade) || new Map();
  cacheAlcance.set(grade, cache);
  if (cache.has(k)) return cache.get(k);
  const lado = [];
  for (let r = H.r - tam; r <= H.r + 1; r++) {
    for (let c = H.c - tam; c <= H.c + 1; c++) {
      const p = { c, r };
      if (grade.cabe(c, r, tam) && distancia(p, tam, H, 1) === 1) lado.push(p);
    }
  }
  const m = mapaDePassos(grade, lado, tam, new Set([`${H.c},${H.r}`]));
  cache.set(k, m);
  return m;
}

function norm2(x, y) {
  const m = Math.hypot(x, y) || 1;
  return [x / m, y / m];
}

/** Quadrado livre mais próximo (espiral por anéis). */
function maisPerto(grade, alvo, tam, ok) {
  for (let raio = 0; raio < 20; raio++) {
    for (let dr = -raio; dr <= raio; dr++) {
      for (let dc = -raio; dc <= raio; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== raio) continue;
        const p = { c: alvo.c + dc, r: alvo.r + dr };
        if (grade.cabe(p.c, p.r, tam) && ok(p)) return p;
      }
    }
  }
  return null;
}
