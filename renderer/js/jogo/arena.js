// Mapa de combate da tela do jogo: cada criatura ocupa quadrados inteiros (5 pés), posições por turno.
// Lógica de posição/movimento em ../grade.js; aqui só o desenho e a câmera.
import { $, $$, esc } from '../ui.js';
import { criarGrade, posicionar, distancia, tamanhoDe, aDistancia, pes as pesDe } from '../grade.js';
import { mapaBatalha, iconeHtml, retratoNpc, emojiNpc } from '../arte.js';
import { urlRetratoHeroi } from '../heroi.js';
import { norm, lsGet, lsSet } from './util.js';

/** @param {import('./contexto.js').CtxJogo} ctx */
export function criarArena(ctx) {
  const { el, slug, entrada } = ctx;
  // ─────────────────────────── arena (tela de batalha) ───────────────────────────
  /** Inimigos no combate atual: o NPC em destaque e os hostis vivos que entraram na luta junto com ele. */
  function inimigosEmCena() {
    const vivos = ctx.st.npcs.filter((n) => n.relacao === 'hostil' && n.vidaMax && n.vida > 0);
    const foco = ctx.npcEmCena();
    const ref = Math.max(0, ...vivos.map((n) => Date.parse(n.atualizadoEm) || 0));
    const lista = vivos.filter((n) => n === foco || norm(n.nome) === norm(foco?.nome) || ref - (Date.parse(n.atualizadoEm) || 0) < 10 * 60 * 1000);
    // derrotados agora há pouco continuam no mapa (caídos) até a luta acabar
    const caidos = ctx.st.npcs.filter((n) => n.relacao === 'hostil' && n.vidaMax && n.vida <= 0 && ref && ref - (Date.parse(n.atualizadoEm) || 0) < 3 * 60 * 1000);
    if (lista.length) return [...lista, ...caidos].slice(0, 5);
    // combate sem inimigo com vida registrada (o mestre não mandou vida/vidaMax): o mapa não fica vazio —
    // entra quem está em cena (se não for aliado) e os hostis recentes, com a vida desconhecida ("?")
    const semVida = ctx.st.npcs.filter((n) => n.relacao === 'hostil' && !n.vidaMax);
    const recRef = Math.max(0, ...semVida.map((n) => Date.parse(n.atualizadoEm) || 0));
    const fallback = semVida.filter((n) => recRef - (Date.parse(n.atualizadoEm) || 0) < 10 * 60 * 1000);
    // quem falou na última narração (sem ser aliado) também está na luta
    const ultima = [...(ctx.st.mensagens || [])].reverse().find((m) => m.papel === 'mestre');
    for (const r of ultima?.roteiro || []) {
      if (r.quem === 'narrador' || /^heroi/.test(r.quem)) continue;
      const n = ctx.st.npcs.find((x) => norm(x.nome) === norm(r.quem));
      if (n && n.relacao !== 'aliado' && !(n.vidaMax && n.vida <= 0) && !fallback.some((x) => norm(x.nome) === norm(n.nome))) fallback.push(n);
    }
    if (foco && foco.relacao !== 'aliado' && !(foco.vidaMax && foco.vida <= 0) && !fallback.some((n) => norm(n.nome) === norm(foco.nome))) fallback.unshift(foco);
    return [...fallback.map((n) => (n.vidaMax ? n : { ...n, vida: 1, vidaMax: 1, semVida: true })), ...caidos].slice(0, 5);
  }
  // cada criatura ocupa quadrados inteiros do mapa (1 quadrado = 5 pés); as posições valem até a luta acabar
  // e ficam no save da campanha (historia/combate.json) — no co-op, quem calcula é o host; convidados só desenham
  let arena = null;
  let ultimoSalvo = '';
  const lerSave = () => {
    const c = ctx.st.combate;
    arena = c?.mapa ? { chave: c.mapa, pos: new Map(c.pos), turno: c.turno } : { chave: null, pos: new Map(), turno: null };
    ultimoSalvo = JSON.stringify(c || null);
  };
  const guardarArena = () => {
    const dados = arena.chave ? { mapa: arena.chave, turno: arena.turno, pos: [...arena.pos] } : null;
    const j = JSON.stringify(dados);
    if (j === ultimoSalvo) return;
    ultimoSalvo = j;
    ctx.st.combate = dados;
    if (ctx.papel !== 'convidado') ctx.api.combate.salvar(slug, dados).catch(() => {});
  };
  let observarArena = null;
  let enquadrarArena = null;
  // câmera: automática (enquadra todos) até o jogador dar zoom/arrastar; ⟲ ou duplo clique volta ao automático
  const cam = { manual: false, k: 1, tx: 0, ty: 0 };
  let vista = null; // {W, Hh, cel, grade, H} da última renderização (para zoom, arrasto e régua)
  let ampliada = lsGet('cronicas:arena-ampliada', false);
  function renderArena() {
    const box = $('[data-arena]', el);
    const banner = $('[data-banner]', el);
    if (!arena || ctx.papel === 'convidado') lerSave();
    const batalha = ctx.emCombate();
    banner.classList.toggle('em-batalha', batalha);
    $('.col-centro', el).classList.toggle('em-batalha', batalha);
    const mb = batalha && mapaBatalha(ctx.st.campanha.cena, ctx.st.campanha.tema);
    if (!mb?.grade) {
      box.innerHTML = '';
      box.dataset.mapa = '';
      if (!batalha && arena.chave) { arena = { chave: null, pos: new Map(), turno: null }; guardarArena(); }
      return;
    }
    const grade = criarGrade(mb.grade);
    if (arena.chave !== mb.id) arena = { chave: mb.id, pos: new Map(), turno: null }; // mapa novo = posições novas
    const inimigos = inimigosEmCena();
    // heróis: solo = 'heroi' (como sempre); co-op = um token por herói do grupo ('heroi:<id>')
    const grupo = (ctx.st.grupo || []).length > 1 ? ctx.st.grupo : [{ ...ctx.st.personagem, id: ctx.st.heroi || 'principal' }];
    const idToken = (h) => (grupo.length > 1 ? `heroi:${h.id}` : 'heroi');
    const meu = grupo.find((h) => h.id === (ctx.st.heroi || 'principal')) || grupo[0];
    const lista = [
      ...grupo.map((h) => ({ id: idToken(h), tam: 1, heroi: true, vivo: h.vida > 0, h })),
      ...inimigos.map((n) => ({ id: `npc:${norm(n.nome)}`, tam: tamanhoDe(n), vivo: n.vida > 0, distancia: aDistancia(n), npc: n })),
    ];
    const turnoAgora = ctx.st.campanha.turno || 0;
    const mover = arena.turno !== null && turnoAgora > arena.turno; // passou um turno: inimigos se movem
    if (ctx.papel === 'convidado') {
      // convidado: posições vêm do host; só aplica o tamanho reduzido que o host decidiu
      for (const x of lista) if (arena.pos.get(x.id)?.t) x.tam = arena.pos.get(x.id).t;
    } else {
      posicionar(grade, arena.pos, lista, { mover });
      arena.turno = turnoAgora;
      guardarArena();
    }

    // tudo em pixels da imagem (1402×1122): o token usa as linhas reais da grade desenhada
    const H = arena.pos.get(idToken(meu)); // distâncias contadas a partir do SEU herói
    const token = (x) => {
      const pos = arena.pos.get(x.id);
      if (!pos) return '';
      const r = grade.rect(pos.c, pos.r, x.tam);
      const n = x.npc;
      const p = x.h;
      const vida = n ? Math.max(0, n.vida) : p.vida;
      const vidaMax = n ? n.vidaMax : p.vidaMax;
      const pct = n?.semVida ? 100 : Math.max(0, Math.min(100, (vida / vidaMax) * 100));
      const vidaTxt = n?.semVida ? '?' : `${vida}/${vidaMax}`;
      const q = n && H ? distancia(pos, x.tam, H, 1) : 0;
      const dist = n && H ? `${pesDe(q)} pés` : '';
      const cls = n ? `inimigo ${n.vida <= 0 ? 'derrotado' : ''} ${norm(n.nome) === norm(ctx.st.campanha.falante) ? 'foco' : ''} ${q <= 1 && n.vida > 0 ? 'corpo' : ''}`
        : `heroi ${p.vida / p.vidaMax <= 0.25 ? 'critico' : ''} ${p === meu && grupo.length > 1 ? 'eu' : ''}`;
      const img = n ? retratoNpc(n) : urlRetratoHeroi(p, slug);
      const tamTxt = x.tam > 1 ? ` · ${x.tam * 5}×${x.tam * 5} pés` : '';
      return `
        <div class="token t${x.tam} ${cls}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px" data-c="${pos.c}" data-r="${pos.r}"
          ${n ? '' : `data-heroi="${esc(p.id)}"`} ${n ? `data-alvo="${esc(n.nome)}" title="${esc(n.nome)} (${vidaTxt}) — a ${esc(dist)} (${q} quadrado${q === 1 ? '' : 's'})${tamTxt}${x.distancia ? ' · ataca à distância' : ''}"` : `title="${esc(p.nome)}"`}>
          <div class="disco">${img ? `<img src="${img}" alt="">` : `<span>${n ? emojiNpc(n) : esc(p.icone || '⚔️')}</span>`}</div>
          <div class="mini-hp"><i style="width:${pct}%"></i></div>
          ${n && n.vida > 0 ? `<span class="dist">${pesDe(q)}</span>` : ''}
          <div class="placa"><span class="nome">${esc(n ? n.nome : p.nome)}</span>
            <div class="hp"><i style="width:${pct}%"></i></div><span class="num">${vidaTxt}${dist ? ` · <b>${dist}</b>` : ''}</span></div>
        </div>`;
    };
    const vivos = inimigos.filter((n) => n.vida > 0).length;
    if (box.dataset.mapa !== mb.id) {
      box.dataset.mapa = mb.id;
      box.innerHTML = `<div class="camera"><img class="mapa" src="${mb.url}" alt="" draggable="false"><div class="mira" hidden><span></span></div><div class="pecas"></div></div><div class="faixa-combate"></div>
        <div class="legenda-ampliada" data-legenda></div>
        <div class="zoom-ctl" data-zoom-ctl>
          <button type="button" data-zoom="1" title="Aproximar (roda do mouse)">＋</button>
          <button type="button" data-zoom="-1" title="Afastar (roda do mouse)">−</button>
          <button type="button" data-zoom="0" title="Enquadrar todos (duplo clique no mapa)">⟲</button>
          <button type="button" data-ampliar title="Mapa grande / pequeno">⛶</button>
        </div>`;
      cam.manual = false;
      $$('[data-zoom]', box).forEach((b) => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = Number(b.dataset.zoom);
        if (!d) { cam.manual = false; enquadrarArena?.(); return; }
        zoomEm(box.clientWidth / 2, box.clientHeight / 2, d > 0 ? 1.35 : 1 / 1.35);
      }));
      $('[data-ampliar]', box).addEventListener('click', (e) => { e.stopPropagation(); alternarAmpliada(); });
      ligarControlesCamera(box);
      observarArena?.disconnect();
      observarArena = new ResizeObserver(() => enquadrarArena?.());
      observarArena.observe(box);
    }
    // alvo em foco (quem o mestre pôs em cena) aparece na faixa, para a placa não cobrir os vizinhos
    const alvo = lista.find((x) => x.npc && x.npc.vida > 0 && norm(x.npc.nome) === norm(ctx.st.campanha.falante));
    const alvoPos = alvo && arena.pos.get(alvo.id);
    const alvoHtml = alvoPos && H ? `<span class="alvo">${esc(alvo.npc.nome)} <i><b style="width:${Math.max(0, Math.min(100, (alvo.npc.vida / alvo.npc.vidaMax) * 100))}%"></b></i> ${alvo.npc.semVida ? '?' : `${alvo.npc.vida}/${alvo.npc.vidaMax}`} · <em>${pesDe(distancia(alvoPos, alvo.tam, H, 1))} pés</em></span>` : '';
    $('.faixa-combate', box).innerHTML = `${iconeHtml('armas')}<span>Combate</span>${alvoHtml}${vivos > 1 ? `<small>${vivos} inimigos</small>` : ''}<small>1 quadrado = 5 pés</small>`;
    $('.pecas', box).innerHTML = lista.map(token).join('');
    $$('[data-alvo]', box).forEach((t) => t.addEventListener('click', () => {
      if (ctx.ocupado || t.classList.contains('derrotado')) return;
      entrada.value = `Ataco ${t.dataset.alvo} `;
      entrada.focus();
      ctx.autoAltura();
    }));
    enquadrarArena = enquadrar;
    renderLegenda();
    $('.col-centro', el).classList.toggle('arena-ampliada', ampliada);
    $('[data-ampliar]', box)?.classList.toggle('on', ampliada);
    enquadrar();

    /** Câmera: aproxima o mapa para os quadrados ficarem legíveis, mostrando todos os combatentes. */
    function enquadrar() {
      if (!$('.camera', box) || !box.clientWidth) return;
      const W = box.clientWidth;
      const Hh = box.clientHeight;
      const cel = (grade.x.at(-1) - grade.x[0]) / (grade.x.length - 1);
      let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
      for (const x of lista) {
        const pos = arena.pos.get(x.id);
        if (!pos) continue;
        const r = grade.rect(pos.c, pos.r, x.tam);
        x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
      }
      if (x0 === Infinity) return;
      // margem de 1,5 quadrado (+ espaço da placa embaixo) e no mínimo 9×6 quadrados à vista
      x0 -= cel * 1.5; x1 += cel * 1.5; y0 -= cel * 1.5; y1 += cel * 2.2;
      const larg = Math.max(x1 - x0, cel * 9);
      const alt = Math.max(y1 - y0, cel * 6);
      const k = Math.min(W / larg, Hh / alt, 78 / cel); // quadrado de no máximo 78 px na tela
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      vista = { W, Hh, cel, grade, H };
      if (cam.manual) aplicarCamera(cam.k, cam.tx, cam.ty);
      else aplicarCamera(k, W / 2 - cx * k, Hh / 2 - cy * k);
    }
  }

  // ─────────────────────────── câmera: zoom, arrasto e régua ───────────────────────────
  const MAPA_W = 1402;
  const MAPA_H = 1122;
  /** Aplica escala e deslocamento sem deixar o mapa sair da tela (nem ficar menor que ela inteira). */
  function aplicarCamera(k, tx, ty) {
    const box = $('[data-arena]', el);
    const camEl = $('.camera', box);
    if (!camEl || !vista) return;
    const { W, Hh, cel } = vista;
    const kMin = Math.min(W / MAPA_W, Hh / MAPA_H); // o mapa inteiro cabe
    const kMax = 170 / cel; // quadrado de até 170 px
    k = Math.max(kMin, Math.min(kMax, k));
    const IW = MAPA_W * k;
    const IH = MAPA_H * k;
    tx = IW <= W ? (W - IW) / 2 : Math.min(0, Math.max(W - IW, tx));
    ty = IH <= Hh ? (Hh - IH) / 2 : Math.min(0, Math.max(Hh - IH, ty));
    Object.assign(cam, { k, tx, ty });
    camEl.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
    camEl.style.setProperty('--k', k);
    box.classList.toggle('zoom-manual', cam.manual);
  }
  /** Zoom mantendo fixo o ponto (mx, my) da tela — onde está o mouse. */
  function zoomEm(mx, my, fator) {
    if (!vista) return;
    cam.manual = true;
    const k2 = cam.k * fator;
    aplicarCamera(k2, mx - (mx - cam.tx) * (k2 / cam.k), my - (my - cam.ty) * (k2 / cam.k));
  }
  /** Mapa grande esconde o histórico: a última fala do mestre aparece por cima do mapa, embaixo. */
  function renderLegenda() {
    const leg = $('[data-legenda]', el);
    if (!leg) return;
    const m = [...(ctx.st.mensagens || [])].reverse().find((x) => x.papel === 'mestre');
    const txt = String(m?.texto || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').trim();
    leg.innerHTML = txt ? `<div class="leg-txt">${esc(txt).replace(/\n{2,}/g, '<br><br>').replace(/\n/g, ' ')}</div>` : '';
    leg.hidden = !txt;
  }
  function alternarAmpliada() {
    ampliada = !ampliada;
    lsSet('cronicas:arena-ampliada', ampliada);
    $('.col-centro', el).classList.toggle('arena-ampliada', ampliada);
    $('[data-ampliar]', el)?.classList.toggle('on', ampliada);
    // o ResizeObserver reenquadra quando o banner terminar de mudar de altura
  }
  /** Quadrado da grade sob um ponto da tela (ou null). */
  function quadradoEm(mx, my) {
    if (!vista) return null;
    const { grade } = vista;
    const ix = (mx - cam.tx) / cam.k;
    const iy = (my - cam.ty) / cam.k;
    const acha = (linhas, v) => { for (let i = 0; i < linhas.length - 1; i++) if (v >= linhas[i] && v < linhas[i + 1]) return i; return -1; };
    const c = acha(grade.x, ix);
    const r = acha(grade.y, iy);
    return c >= grade.c0 && r >= grade.r0 && c < grade.c0 + grade.cols && r < grade.r0 + grade.rows ? { c, r, livre: grade.livre(c, r) } : null;
  }
  function ligarControlesCamera(box) {
    if (box.dataset.camera) return;
    box.dataset.camera = '1';
    box.addEventListener('wheel', (e) => {
      if (!$('.camera', box) || e.target.closest('.legenda-ampliada')) return; // na legenda a roda rola o texto
      e.preventDefault();
      const b = box.getBoundingClientRect();
      box.classList.add('arrastando'); // zoom contínuo sem a animação longa
      clearTimeout(box._fimRoda);
      box._fimRoda = setTimeout(() => box.classList.remove('arrastando'), 160);
      zoomEm(e.clientX - b.left, e.clientY - b.top, Math.exp(-e.deltaY * 0.0016));
    }, { passive: false });
    let arrasto = null;
    let acabouDeArrastar = false;
    box.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('[data-zoom-ctl], .faixa-combate, .legenda-ampliada')) return;
      arrasto = { x: e.clientX, y: e.clientY, tx: cam.tx, ty: cam.ty, moveu: false, id: e.pointerId };
    });
    box.addEventListener('pointermove', (e) => {
      const b = box.getBoundingClientRect();
      if (arrasto) {
        const dx = e.clientX - arrasto.x;
        const dy = e.clientY - arrasto.y;
        if (!arrasto.moveu && Math.hypot(dx, dy) < 5) return;
        if (!arrasto.moveu) { arrasto.moveu = true; box.setPointerCapture?.(arrasto.id); box.classList.add('arrastando'); }
        cam.manual = true;
        aplicarCamera(cam.k, arrasto.tx + dx, arrasto.ty + dy);
        $('.mira', box)?.setAttribute('hidden', '');
        return;
      }
      regua(e.clientX - b.left, e.clientY - b.top);
    });
    const soltar = () => {
      if (arrasto?.moveu) { acabouDeArrastar = true; setTimeout(() => (acabouDeArrastar = false), 0); }
      arrasto = null;
      box.classList.remove('arrastando');
    };
    box.addEventListener('pointerup', soltar);
    box.addEventListener('pointercancel', soltar);
    box.addEventListener('pointerleave', () => $('.mira', box)?.setAttribute('hidden', ''));
    // arrastar o mapa não conta como clique num inimigo
    box.addEventListener('click', (e) => { if (acabouDeArrastar) { e.stopPropagation(); e.preventDefault(); } }, true);
    box.addEventListener('dblclick', (e) => {
      if (e.target.closest('[data-zoom-ctl], .token, .legenda-ampliada')) return;
      cam.manual = false;
      enquadrarArena?.();
    });
  }
  /** Régua: o quadrado sob o mouse e a distância até o seu herói, em pés. */
  function regua(mx, my) {
    const box = $('[data-arena]', el);
    const mira = $('.mira', box);
    if (!mira || !vista) return;
    const q = quadradoEm(mx, my);
    if (!q || !vista.H) { mira.hidden = true; return; }
    const r = vista.grade.rect(q.c, q.r, 1);
    const d = distancia(q, 1, vista.H, 1);
    mira.hidden = false;
    mira.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
    $('span', mira).textContent = d ? `${pesDe(d)} pés${q.livre ? '' : ' · bloqueado'}` : 'você';
    mira.classList.toggle('bloqueado', !q.livre);
  }
  /** Tremida/flash num token do mapa (golpe recebido). nome = inimigo; heroi = id do herói atingido (co-op). */
  function golpearToken(nome, heroi) {
    const t = nome ? $$('.token.inimigo', el).find((x) => norm(x.dataset.alvo) === norm(nome))
      : (heroi && $(`.token.heroi[data-heroi="${heroi}"]`, el)) || $('.token.heroi.eu', el) || $('.token.heroi', el);
    if (!t) return;
    t.classList.remove('atingido');
    void t.offsetWidth;
    t.classList.add('atingido');
    setTimeout(() => t.classList.remove('atingido'), 700);
  }

  return { render: renderArena, golpear: golpearToken, destruir: () => observarArena?.disconnect() };
}
