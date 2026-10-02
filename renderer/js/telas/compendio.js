import { $, $$, esc, h, toast } from '../ui.js';
import { api, irPara } from '../app.js';
import { setTema, setCena } from '../cenario.js';
import { setBarra } from '../barra.js';
import { urlCena, cenaDoTema, RARIDADES, iconeItemHtml } from '../arte.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const rotulo = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/-/g, ' ') : '');
const unicos = (lista, campo) => [...new Set(lista.map((x) => x[campo]).filter(Boolean))].sort();

export function telaCompendio(raiz) {
  setTema('taverna');
  document.documentElement.classList.add('fundo-nitido');
  setCena(urlCena('mapa-mundi') || cenaDoTema('taverna'));

  const extra = h('<div class="linha-flex"><button class="btn" data-voltar>← Voltar</button></div>');
  $('[data-voltar]', extra).addEventListener('click', () => irPara('inicio'));
  setBarra({ t1: 'Compêndio', t2: 'Fichas de itens e monstros', extra });

  const el = h(`
    <div class="tela-compendio">
      <div class="comp-topo moldura leve">
        <div class="comp-abas">
          <button class="chip sel" data-aba="itens">Itens</button>
          <button class="chip" data-aba="monstros">Monstros</button>
        </div>
        <input class="campo" data-busca type="search" placeholder="Buscar por nome, descrição ou história…">
        <select class="campo" data-f1></select>
        <select class="campo" data-f2></select>
        <span class="suave" data-conta></span>
      </div>
      <div class="comp-corpo">
        <div class="comp-lista" data-lista></div>
        <div class="comp-ficha moldura" data-ficha><p class="suave">Escolha um registro para ver a ficha.</p></div>
      </div>
    </div>`);
  raiz.appendChild(el);

  let dados = { itens: [], monstros: [] };
  let aba = 'itens';
  let selecionado = null;

  const $busca = $('[data-busca]', el);
  const $f1 = $('[data-f1]', el);
  const $f2 = $('[data-f2]', el);

  function montarFiltros() {
    const opc = (todos, vals, fmt = rotulo) => `<option value="">${todos}</option>` + vals.map((v) => `<option value="${esc(v)}">${esc(fmt(v))}</option>`).join('');
    if (aba === 'itens') {
      $f1.innerHTML = opc('Todas as pastas', unicos(dados.itens, 'pasta'));
      $f2.innerHTML = opc('Todas as raridades', Object.keys(RARIDADES).filter((r) => dados.itens.some((i) => i.raridade === r)), (r) => RARIDADES[r].nome);
    } else {
      $f1.innerHTML = opc('Todos os tamanhos', unicos(dados.monstros, 'tamanho'));
      $f2.innerHTML = opc('Todos os habitats', unicos(dados.monstros, 'habitat'));
    }
  }

  function filtrar() {
    const q = norm($busca.value.trim());
    const [c1, c2] = aba === 'itens' ? ['pasta', 'raridade'] : ['tamanho', 'habitat'];
    return dados[aba].filter((r) => {
      if ($f1.value && r[c1] !== $f1.value) return false;
      if ($f2.value && r[c2] !== $f2.value) return false;
      return !q || norm(`${r.nome} ${r.desc || ''} ${r.historia || ''}`).includes(q);
    });
  }

  function desenhaLista() {
    const lista = filtrar();
    $('[data-conta]', el).textContent = `${lista.length} de ${dados[aba].length}`;
    const box = $('[data-lista]', el);
    box.innerHTML = '';
    if (!lista.length) box.appendChild(h('<p class="suave comp-vazio">Nenhum registro encontrado.</p>'));
    for (const r of lista) {
      const cor = aba === 'itens' ? RARIDADES[r.raridade]?.cor : '';
      const arte = aba === 'itens' ? iconeItemHtml(r) : r.url ? `<img class="ic-item" src="${r.url}" alt="">` : '<span class="ic-item emoji">👹</span>';
      const card = h(`<button class="comp-card painel${selecionado?.id === r.id ? ' sel' : ''}" style="${cor ? `--cor-rar:${cor}` : ''}">
        <span class="comp-ic">${arte}</span>
        <span class="comp-nome">${esc(r.nome)}</span>
        <span class="comp-sub suave">${esc(aba === 'itens' ? `${RARIDADES[r.raridade]?.nome || ''} · ${rotulo(r.pasta)}` : `${rotulo(r.tamanho)}${r.habitat ? ` · ${rotulo(r.habitat)}` : ''}`)}</span>
      </button>`);
      card.addEventListener('click', () => { selecionado = r; desenhaLista(); desenhaFicha(); });
      box.appendChild(card);
    }
  }

  function linha(rot, val) {
    return val === null || val === undefined || val === '' ? '' : `<div class="comp-linha"><span>${esc(rot)}</span><b>${esc(val)}</b></div>`;
  }

  function desenhaFicha() {
    const f = $('[data-ficha]', el);
    const r = selecionado;
    if (!r) { f.innerHTML = '<p class="suave">Escolha um registro para ver a ficha.</p>'; return; }
    const arte = aba === 'itens' ? iconeItemHtml(r, 'grande') : r.url ? `<img class="comp-retrato" src="${r.url}" alt="">` : '';
    const dano = r.dano_formula ? `${r.dano_formula}${r.tipo_dano ? ` ${r.tipo_dano}` : ''}` : null;
    const mec = aba === 'itens'
      ? linha('Dano', dano) + linha('Alcance', r.alcance && rotulo(r.alcance)) + linha('Efeito', r.efeito) + linha('Pasta', rotulo(r.pasta))
      : linha('Tamanho', rotulo(r.tamanho)) + linha('Habitat', rotulo(r.habitat)) + linha('Vida máxima', r.vida_max) + linha('Ataque', r.ataque) + linha('Dano', dano) + linha('Alcance', r.alcance && rotulo(r.alcance));
    const habil = r.habilidades?.length ? `<h4>Habilidades</h4><ul>${r.habilidades.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    f.innerHTML = `
      <div class="comp-ficha-cab">${arte}<div>
        <h3>${esc(r.nome)}</h3>
        ${aba === 'itens' ? `<div style="color:${RARIDADES[r.raridade]?.cor}">${esc(RARIDADES[r.raridade]?.nome || '')}</div>` : ''}
      </div></div>
      ${r.desc ? `<p>${esc(r.desc)}</p>` : ''}
      ${r.historia ? `<h4>História</h4><p class="suave">${esc(r.historia)}</p>` : ''}
      <div class="comp-mec">${mec}</div>${habil}`;
  }

  function trocarAba(nova) {
    aba = nova;
    selecionado = null;
    $$('[data-aba]', el).forEach((b) => b.classList.toggle('sel', b.dataset.aba === aba));
    $busca.value = '';
    montarFiltros();
    desenhaLista();
    desenhaFicha();
  }

  $$('[data-aba]', el).forEach((b) => b.addEventListener('click', () => trocarAba(b.dataset.aba)));
  for (const c of [$busca, $f1, $f2]) c.addEventListener('input', desenhaLista);

  api.compendio.listar().then((d) => {
    dados = d;
    trocarAba('itens');
  }).catch((e) => toast(`Compêndio: ${e.message}`, 'erro'));

  return () => document.documentElement.classList.remove('fundo-nitido');
}
