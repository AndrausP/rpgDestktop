// Utilidades de interface: escape, markdown leve, toasts, modais (o Electron não tem window.prompt).

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Markdown mínimo e seguro: **negrito**, *itálico*, parágrafos, falas com travessão. */
export function md(texto) {
  return esc(texto)
    .split(/\n{2,}/)
    .map((par) => {
      let h = par
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
        .replace(/\n/g, '<br>');
      const fala = /^\s*(—|-{1,2}\s)/.test(par);
      return `<p${fala ? ' class="fala"' : ''}>${h}</p>`;
    })
    .join('');
}

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function toast(msg, tipo = 'info', ms = 3800) {
  let box = $('#toasts');
  if (!box) {
    box = h('<div id="toasts"></div>');
    document.body.appendChild(box);
  }
  const el = h(`<div class="toast ${tipo}">${esc(msg)}</div>`);
  box.appendChild(el);
  setTimeout(() => el.classList.add('saindo'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

/** Modal genérico. Retorna {el, fechar, promessa}. */
export function modal(conteudoHtml, { classe = '', fecharFora = true } = {}) {
  const fundo = h(`<div class="modal-fundo"><div class="modal moldura ${classe}">${conteudoHtml}</div></div>`);
  document.body.appendChild(fundo);
  requestAnimationFrame(() => fundo.classList.add('aberto'));
  let resolver;
  const promessa = new Promise((r) => (resolver = r));
  const fechar = (valor) => {
    fundo.classList.remove('aberto');
    setTimeout(() => fundo.remove(), 250);
    document.removeEventListener('keydown', onKey);
    resolver(valor);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') fechar(null);
  };
  document.addEventListener('keydown', onKey);
  if (fecharFora) fundo.addEventListener('mousedown', (e) => e.target === fundo && fechar(null));
  $$('[data-fechar]', fundo).forEach((b) => b.addEventListener('click', () => fechar(null)));
  return { el: $('.modal', fundo), fechar, promessa };
}

export function confirmar(titulo, texto, { ok = 'Confirmar', perigo = false } = {}) {
  const m = modal(`
    <h2>${esc(titulo)}</h2>
    <p class="suave">${esc(texto)}</p>
    <div class="modal-acoes">
      <button class="btn fantasma" data-fechar>Cancelar</button>
      <button class="btn ${perigo ? 'perigo' : 'primario'}" data-ok>${esc(ok)}</button>
    </div>`, { classe: 'pequeno' });
  $('[data-ok]', m.el).addEventListener('click', () => m.fechar(true));
  $('[data-ok]', m.el).focus();
  return m.promessa.then((v) => !!v);
}

export function perguntar(titulo, { valor = '', placeholder = '', ok = 'OK' } = {}) {
  const m = modal(`
    <h2>${esc(titulo)}</h2>
    <input class="campo" type="text" value="${esc(valor)}" placeholder="${esc(placeholder)}" data-input>
    <div class="modal-acoes">
      <button class="btn fantasma" data-fechar>Cancelar</button>
      <button class="btn primario" data-ok>${esc(ok)}</button>
    </div>`, { classe: 'pequeno' });
  const inp = $('[data-input]', m.el);
  const enviar = () => inp.value.trim() && m.fechar(inp.value.trim());
  $('[data-ok]', m.el).addEventListener('click', enviar);
  inp.addEventListener('keydown', (e) => e.key === 'Enter' && enviar());
  setTimeout(() => inp.focus(), 50);
  return m.promessa;
}

export function tempoRelativo(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `há ${Math.floor(s / 86400)} dias`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ─── dados ───
export const ATRIBUTOS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
export const NOME_ATR = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma' };
export const ABREV_ATR = { forca: 'FOR', destreza: 'DES', constituicao: 'CON', inteligencia: 'INT', sabedoria: 'SAB', carisma: 'CAR' };
export const mod = (v) => Math.floor((Number(v) - 10) / 2);
export const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);

export function rolar(lados, qtd = 1) {
  const arr = [];
  const buf = new Uint32Array(qtd);
  crypto.getRandomValues(buf);
  for (let i = 0; i < qtd; i++) arr.push((buf[i] % lados) + 1);
  return arr;
}

/** "2d6+3" → {dados:[..], total, lados, qtd, bonus} */
export function rolarExpr(expr) {
  const m = String(expr).replace(/\s/g, '').toLowerCase().match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!m) return null;
  const qtd = Math.min(50, parseInt(m[1] || '1', 10));
  const lados = parseInt(m[2], 10);
  const bonus = parseInt(m[3] || '0', 10);
  const dados = rolar(lados, qtd);
  return { expr, dados, qtd, lados, bonus, total: dados.reduce((a, b) => a + b, 0) + bonus };
}

/** Flâmula pendurada (decoração das molduras). */
export const FLAMULA = `<svg class="flamula" viewBox="0 0 54 130" aria-hidden="true">
  <path d="M4 0 H50 V112 L27 96 L4 112 Z" fill="#1b0c08"/>
  <path class="pano" d="M7 0 H47 V106 L27 92 L7 106 Z"/>
  <path d="M7 0 H47 V106 L27 92 L7 106 Z" fill="none" stroke="#c9a063" stroke-width="1.2" opacity=".8"/>
  <path d="M33 40 a12 12 0 1 1 -10 -12 a9 9 0 1 0 10 12 z" fill="#ecd29a" opacity=".9"/>
  <path d="M27 60 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0 z" fill="#ecd29a" opacity=".75"/>
</svg>`;
