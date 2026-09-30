// O "palco": fundo, partículas, som e anúncios. Toda troca de tema passa por aqui.
import { TEMAS, aplicarCores } from './temas.js';
import { Particulas } from './particulas.js';
import { Audio } from './audio.js';
import { $, esc } from './ui.js';

export const audio = new Audio();
export const particulas = new Particulas(document.getElementById('particulas'));

let temaAtual = null;
let fundoTopo = 'a';
let cenaAtual = null;

export function temaAtualId() {
  return temaAtual;
}

/** Troca a arte de fundo (crossfade). Aceita URL arte:// ou null. */
export function setCena(url, { instantaneo = false } = {}) {
  if (!url || url === cenaAtual) return false;
  cenaAtual = url;
  const a = document.getElementById('fundo-a');
  const b = document.getElementById('fundo-b');
  const aplicar = () => {
    if (instantaneo) {
      a.style.backgroundImage = `url("${url}")`;
      a.style.opacity = 1;
      b.style.opacity = 0;
      fundoTopo = 'a';
      return;
    }
    const novo = fundoTopo === 'a' ? b : a;
    const velho = fundoTopo === 'a' ? a : b;
    novo.style.backgroundImage = `url("${url}")`;
    novo.style.zIndex = 0;
    velho.style.zIndex = -1;
    novo.style.opacity = 1;
    setTimeout(() => (velho.style.opacity = 0), 60);
    fundoTopo = fundoTopo === 'a' ? 'b' : 'a';
  };
  // pré-carrega para o crossfade não piscar
  const img = new Image();
  img.onload = img.onerror = aplicar;
  img.src = url;
  return true;
}

/** Troca o tema (cores, partículas, som). */
export function setTema(id, { anunciar = false, instantaneo = false } = {}) {
  if (!TEMAS[id]) id = 'taverna';
  const t = TEMAS[id];
  const mudou = id !== temaAtual;
  if (!mudou && !instantaneo) return t;
  temaAtual = id;
  if (instantaneo) {
    document.documentElement.style.setProperty('--t-tema', '0s');
    requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.style.removeProperty('--t-tema')));
  }
  aplicarCores(id);
  particulas.definir(t.particulas);
  audio.tema(id);

  if (anunciar && mudou) {
    audio.transicao();
    anunciarTexto('A atmosfera muda', `${t.icone} ${t.nome}`, 2600);
    if (id === 'batalha') {
      document.body.classList.remove('tremer');
      void document.body.offsetWidth;
      document.body.classList.add('tremer');
    }
  }
  return t;
}

let timerAnuncio;
let geracaoAnuncio = 0;
/** Anúncio central. Some sozinho (timer + animationend) e nunca fica preso na tela. */
export function anunciarTexto(rotulo, nome, ms = 3200) {
  document.getElementById('anuncio')?.remove();
  clearTimeout(timerAnuncio);
  const ger = ++geracaoAnuncio;
  const el = document.createElement('div');
  el.id = 'anuncio';
  el.style.setProperty('--dur', `${ms}ms`);
  el.innerHTML = `<div class="caixa"><div class="rotulo-cap">${esc(rotulo)}</div><div class="nome-cap">${esc(nome)}</div><div class="linha"></div></div>`;
  el.addEventListener('animationend', (e) => { if (e.animationName === 'anuncio-vida') el.remove(); });
  document.body.appendChild(el);
  // rede de segurança caso a animação não rode (janela oculta, reduced motion…)
  timerAnuncio = setTimeout(() => { if (ger === geracaoAnuncio) el.remove(); }, ms + 800);
}

/** Tira do palco tudo que é transitório: anúncios, vitrines, rolagens, flashes. */
export function limparPalco() {
  clearTimeout(timerAnuncio);
  geracaoAnuncio++;
  document.querySelectorAll('#anuncio, .vitrine-item, .rolagem-overlay').forEach((e) => e.remove());
  document.body.classList.remove('tremer', 'flash-dano', 'flash-cura');
}

export function efeito(tipo) {
  const b = document.body;
  const cls = { dano: 'flash-dano', cura: 'flash-cura' }[tipo];
  if (cls) {
    b.classList.remove(cls);
    void b.offsetWidth;
    b.classList.add(cls);
    setTimeout(() => b.classList.remove(cls), 800);
  }
  if (tipo === 'dano') {
    audio.dano();
    b.classList.remove('tremer');
    void b.offsetWidth;
    b.classList.add('tremer');
  }
  if (tipo === 'cura') audio.cura();
  if (tipo === 'item') audio.item();
  if (tipo === 'moedas') audio.moedas();
  if (tipo === 'mana') audio.mana();
  if (tipo === 'xp') audio.xp();
  if (tipo === 'missao') audio.missao();
  if (tipo === 'inimigo') audio.inimigo();
  if (tipo === 'nivel') {
    audio.nivel();
    particulas.rajada([255, 215, 100], 120);
    anunciarTexto('Você ficou mais forte', 'Subiu de nível!', 2800);
  }
}

/** Liga/desliga o som ambiente já no clima do tema atual. */
export function ligarSom(on) {
  audio.setLigado(on, temaAtual || 'taverna');
}
