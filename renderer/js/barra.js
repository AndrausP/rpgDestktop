// Barra de título própria (a janela não tem moldura do sistema): emblema, títulos, área extra e controles.
import { $, esc } from './ui.js';

export function iniciarBarra() {
  const b = $('#barra');
  $('[data-min]', b).addEventListener('click', () => window.rpg.janela.minimizar());
  $('[data-max]', b).addEventListener('click', () => window.rpg.janela.maximizar());
  $('[data-fechar-janela]', b).addEventListener('click', () => window.rpg.janela.fechar());
  b.addEventListener('dblclick', (e) => {
    if (!e.target.closest('.extra, .ctl')) window.rpg.janela.maximizar();
  });
  window.rpg.janela.plataforma().then((p) => p === 'darwin' && document.documentElement.classList.add('mac')).catch(() => {});
}

/** Define o conteúdo da barra para a tela atual. `extra` é um elemento (botões, info) ou null. */
export function setBarra({ t1 = 'Crônicas', t2 = '', extra = null } = {}) {
  const b = $('#barra');
  $('.t1', b).textContent = t1;
  $('.t2', b).innerHTML = esc(t2);
  const box = $('.extra', b);
  box.innerHTML = '';
  if (extra) box.appendChild(extra);
}
