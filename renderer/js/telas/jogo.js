import { $, $$, esc, md, h, toast, confirmar, perguntar, modal, ATRIBUTOS, ABREV_ATR, NOME_ATR, mod, fmtMod, rolar, rolarExpr, FLAMULA } from '../ui.js';
import { S, api, irPara } from '../app.js';
import { TEMAS } from '../temas.js';
import { setTema, setCena, anunciarTexto, efeito, audio, particulas, ligarSom } from '../cenario.js';
import { setBarra } from '../barra.js';
import { carregarCatalogo, urlCena, cenaDoTema, urlRetrato, retratoNpc, corpoNpc, emojiNpc, iconeItem, iconeItemHtml, emojiPasta, slugify, RARIDADES, itemDoCatalogo } from '../arte.js';
import { abrirConfig } from './config.js';
import { narrador, roteiro, roteiroDoTurno, EMOCOES, PRESETS_VOZ, vozDoNpc } from '../vozes.js';
import { urlRetratoHeroi, editarHeroi } from '../heroi.js';
import { gravarVoz } from '../gravador.js';

const ICONE_ATR = { forca: '💪', destreza: '🪶', constituicao: '❤️', inteligencia: '📖', sabedoria: '👁️', carisma: '✨' };
const ORDEM_PASTAS = ['armas', 'armaduras', 'consumiveis', 'itens-chave'];
const PERIODO = { amanhecer: ['🌅', 'Amanhecer'], dia: ['☀️', 'Dia'], entardecer: ['🌇', 'Entardecer'], noite: ['🌙', 'Noite'] };
const MODOS = [
  { id: 'acao', ic: '✦', nome: 'Ação', ph: 'O que você faz?' },
  { id: 'fala', ic: '💬', nome: 'Falar', ph: 'O que você diz?' },
  { id: 'ooc', ic: '❔', nome: 'Perguntar ao mestre', ph: 'Pergunte algo ao mestre (fora do jogo)' },
];
const ICONE_SUGESTAO = [
  [/atac|golpe|lut|investir/, '⚔️'], [/defend|bloque|proteg|escudo/, '🛡️'], [/magia|feiti|conjur|runa/, '🔥'], [/fug|corr|recu/, '🏃'],
  [/fal|pergunt|convers|dig|negoci|chamar/, '💬'], [/exami|olh|observ|investig|ler|procur/, '🔍'], [/segu|ir |ir$|entr|avan|subir|explor|viaj/, '👣'],
  [/descans|dorm|acamp/, '🏕️'], [/compr|vend|pag/, '🪙'], [/ajud|salv|cur/, '🤝'], [/escond|furtiv|esgueir/, '🥷'], [/beb|us|poç/, '🧪'], [/orar|rez/, '🙏'],
];
const D20_SVG = `<svg viewBox="0 0 100 100"><polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="rgba(0,0,0,.6)" stroke="var(--ouro-2)" stroke-width="2.5" stroke-linejoin="round"/><polygon points="50,24 76,68 24,68" fill="none" stroke="var(--ouro-2)" stroke-width="1.4" opacity=".55"/><path d="M50 3 L50 24 M93 27 L76 68 M93 73 L76 68 M50 97 L76 68 M50 97 L24 68 M7 73 L24 68 M7 27 L24 68 M7 27 L50 24 M93 27 L50 24" stroke="var(--ouro-2)" stroke-width="1" opacity=".35" fill="none"/></svg>`;

const conta = (b) => (b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`);
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function telaJogo(raiz, { slug, novo }) {
  let st = null;
  let ocupado = false;
  let vivo = true; // vira false quando a tela é destruída (Home, trocar de campanha)
  let modo = 'acao';
  let aba = lsGet('cronicas:aba', 'inv');
  let filtroPasta = 'todos';
  let busca = '';
  let itemAberto = null;
  let itensNovos = new Set();
  let digitacao = null;
  let vidaAnterior = null;
  const historicoDados = [];
  const secoes = lsGet('cronicas:secoes', { equip: true, hist: false });
  let bannerVisivel = lsGet('cronicas:banner', true);

  const el = h(`
    <div class="jogo">
      <aside class="moldura col-heroi" data-ficha></aside>

      <section class="col-centro ${bannerVisivel ? '' : 'sem-banner'}">
        <div class="moldura cena-banner" data-banner>
          <div class="arte" data-arte></div>
          <div class="rotulo-cena" data-rotulo-cena></div>
        </div>
        <div class="moldura narrativa">
          <div class="historia" data-historia></div>
        </div>
        <div class="npc-card" data-npc></div>
        <div class="acoes-rapidas" data-acoes></div>
        <div class="moldura compositor">
          <button class="btn icone modo-btn" data-modo title="Modo: Ação">✦</button>
          <textarea rows="1" data-entrada placeholder="O que você faz?"></textarea>
          <button class="btn icone" data-dado title="Rolar d20 livre">🎲</button>
          <button class="btn primario enviar" data-enviar title="Enviar (Enter)">➤</button>
        </div>
      </section>

      <aside class="moldura col-lateral">
        <nav class="abas" data-abas></nav>
        <div class="conteudo-aba" data-conteudo></div>
        <div class="efeitos" data-efeitos></div>
      </aside>
    </div>`);
  raiz.appendChild(el);

  const hist = $('[data-historia]', el);
  const entrada = $('[data-entrada]', el);

  const extra = h(`<div class="linha-flex" style="gap:10px">
    <div class="info-barra" data-info></div>
    <div class="info-barra tema-barra" data-tema title="O clima muda com a história"></div>
    <button class="btn icone" data-voltar title="Voltar às campanhas">⌂</button>
    <button class="btn icone ${bannerVisivel ? 'on' : ''}" data-recolher title="Mostrar/ocultar a arte da cena">🖼️</button>
    <button class="btn icone" data-cronica title="Abrir a crônica">📖</button>
    <button class="btn icone" data-pasta title="Abrir pasta da campanha">📁</button>
    <button class="btn icone" data-voz title="Voz do mestre e dos personagens (Chatterbox)">🗣️</button>
    <button class="btn icone" data-som title="Som ambiente">🔈</button>
    <button class="btn icone" data-cfg title="Configurações">⚙️</button>
  </div>`);

  // ─────────────────────────── carregar ───────────────────────────
  async function carregar() {
    try {
      await carregarCatalogo(slug);
      st = await api.campanhas.carregar(slug);
    } catch (e) {
      if (!vivo) return;
      toast(e.message, 'erro');
      return irPara('inicio');
    }
    if (!vivo) return;
    setTema(st.campanha.tema, { instantaneo: true });
    aplicarCena(true);
    vidaAnterior = st.personagem.vida;
    renderTudo();
    renderHistoriaCompleta();
    if (novo || st.mensagens.length === 0) iniciar();
    else if (st.mensagens.at(-1)?.papel !== 'mestre') mostrarErro('O último turno não recebeu resposta do mestre.');
    entrada.focus();
  }
  const iniciar = () => turno(() => api.jogo.iniciar(slug));

  function renderTudo() {
    renderBarra();
    renderFicha();
    renderNpc();
    renderAbas();
    renderEfeitos();
  }

  function urlCenaAtual() {
    return urlCena(st.campanha.cena) || cenaDoTema(st.campanha.tema) || urlCena('taverna');
  }
  function aplicarCena(instantaneo = false) {
    const url = urlCenaAtual();
    setCena(url, { instantaneo });
    const arte = $('[data-arte]', el);
    if (arte.dataset.url === url) return;
    arte.dataset.url = url;
    const nova = h(`<div class="camada" style="background-image:url('${url}')"></div>`);
    arte.appendChild(nova);
    requestAnimationFrame(() => requestAnimationFrame(() => nova.classList.add('visivel')));
    const velhas = $$('.camada', arte).slice(0, -1);
    setTimeout(() => velhas.forEach((v) => v.remove()), 1600);
  }

  // ─────────────────────────── barra ───────────────────────────
  function renderBarra() {
    const c = st.campanha;
    const t = TEMAS[c.tema] || TEMAS.taverna;
    const [ic, nomePer] = PERIODO[c.periodo] || PERIODO.dia;
    setBarra({ t1: c.nome, t2: c.capitulo || '', extra });
    $('[data-info]', extra).innerHTML = `<span class="sol">${ic}</span><div><div class="l1">Dia ${c.dia || 1} · ${nomePer}</div><div class="l2">${esc(c.local || '—')}</div></div>`;
    $('[data-tema]', extra).innerHTML = `<span class="sol">${t.icone}</span><div><div class="l2">${esc(t.nome)}</div><div class="l1">turno ${c.turno || 0}</div></div>`;
    const somBtn = $('[data-som]', extra);
    somBtn.textContent = S.cfg?.som ? '🔊' : '🔈';
    somBtn.classList.toggle('on', !!S.cfg?.som);
    const cena = st.campanha.cena ? (st.campanha.cena || '').replace(/-/g, ' ') : '';
    $('[data-rotulo-cena]', el).innerHTML = c.local ? `<span>📍 ${esc(c.local)}</span>` : cena ? `<span>${esc(cena)}</span>` : '';
  }

  // ─────────────────────────── ficha ───────────────────────────
  function barra(tipo, ic, v, max, extraCls = '') {
    const pct = max ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
    return `<div class="barra ${tipo} ${extraCls}" data-barra="${tipo}" title="${tipo}">
      <span class="ic">${ic}</span>
      <div class="trilho"><div class="fantasma" style="width:${pct}%"></div><div class="fill" style="width:${pct}%"></div></div>
      <span class="num">${v} / ${max}</span>
    </div>`;
  }

  function renderFicha() {
    const p = st.personagem;
    const caido = p.status.some((s) => /ca[ií]do/i.test(s.nome)) || p.vida <= 0;
    const equipados = Object.values(st.inventario).flat().filter((i) => i.equipado);
    const ret = urlRetratoHeroi(p, slug);
    const box = $('[data-ficha]', el);
    box.innerHTML = `
      ${FLAMULA}
      <div class="retrato-heroi ${caido ? 'caido' : ''}" data-editar-heroi title="Retrato, aparência e voz do herói">
        <span class="editar-heroi">✏️</span>
        ${ret ? `<img src="${ret}" alt="">` : `<div class="sem-retrato">${esc(p.icone || '⚔️')}</div>`}
        <div class="nome-heroi">
          <div class="nome">${esc(p.nome)}</div>
          <div class="rc">${esc(p.raca)} · ${esc(p.classe)}</div>
          <div class="nivel">Nível ${p.nivel}</div>
        </div>
      </div>
      <div class="corpo-heroi">
        <div class="barras">
          ${barra('vida', '❤️', p.vida, p.vidaMax, p.vida / p.vidaMax <= 0.25 ? 'critica' : '')}
          ${p.manaMax > 0 ? barra('mana', '💧', p.mana, p.manaMax) : ''}
          ${barra('xp', '⭐', p.xp, p.xpProximo)}
        </div>
        <div class="ouro">🪙 <b>${p.ouro}</b> <span class="suave">moedas de ouro</span></div>
        <div class="atributos">
          ${ATRIBUTOS.map((a) => `<button class="atr" data-atr="${a}" title="Teste de ${NOME_ATR[a]} (d20 ${fmtMod(mod(p.atributos[a]))})">
            <span class="ic">${ICONE_ATR[a]}</span><span class="ab">${ABREV_ATR[a]}</span><span class="v">${p.atributos[a]}</span><span class="m">${fmtMod(mod(p.atributos[a]))}</span></button>`).join('')}
        </div>
        <details class="secao" data-sec="equip" ${secoes.equip ? 'open' : ''}>
          <summary>Equipamento</summary>
          <div class="equipados">
            ${equipados.map((i) => `<div class="eq" title="${esc(i.descricao || '')}">${iconeItemHtml(i)}<span>${esc(i.nome)}</span></div>`).join('')}
            ${Array.from({ length: Math.max(0, 5 - equipados.length) }, () => '<div class="eq vazio"></div>').join('')}
          </div>
        </details>
        <details class="secao" data-sec="hist" ${secoes.hist ? 'open' : ''}>
          <summary>História</summary>
          ${p.aparencia ? `<div class="historia-heroi"><b>Aparência.</b> ${esc(p.aparencia)}</div>` : ''}
          <div class="historia-heroi">${esc(p.historia || 'Uma história ainda por escrever.')}</div>
        </details>
      </div>`;
    $('[data-editar-heroi]', box).addEventListener('click', async () => {
      const novo = await editarHeroi(st, slug, S.cfg);
      if (!novo || !vivo) return;
      st = novo;
      renderFicha();
      toast('🛡️ Herói atualizado');
    });
    if (vidaAnterior != null && vidaAnterior > p.vida) {
      const f = $('[data-barra="vida"] .fantasma', box);
      f.style.transition = 'none';
      f.style.width = `${(vidaAnterior / p.vidaMax) * 100}%`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        f.style.transition = '';
        f.style.width = `${(p.vida / p.vidaMax) * 100}%`;
      }));
    }
    vidaAnterior = p.vida;
    $$('[data-atr]', box).forEach((a) => a.addEventListener('click', () => testeLivre(a.dataset.atr)));
    $$('details[data-sec]', box).forEach((d) => d.addEventListener('toggle', () => {
      secoes[d.dataset.sec] = d.open;
      lsSet('cronicas:secoes', secoes);
    }));
  }

  // ─────────────────────────── NPC em cena ───────────────────────────
  function npcEmCena() {
    const nome = st.campanha.falante;
    if (!nome) return null;
    return st.npcs.find((n) => norm(n.nome) === norm(nome)) || { nome, relacao: 'desconhecido' };
  }
  function emCombate() {
    const n = npcEmCena();
    return st.campanha.tema === 'batalha' || (n && n.relacao === 'hostil' && n.vidaMax && n.vida > 0);
  }

  function renderNpc(nomeFalando = null) {
    const box = $('[data-npc]', el);
    const n = (nomeFalando && st.npcs.find((x) => x.nome === nomeFalando)) || npcEmCena();
    $('.col-centro', el).classList.toggle('com-npc', !!n);
    if (!n) {
      box.classList.remove('visivel');
      return;
    }
    const corpo = corpoNpc(n);
    const ret = corpo || retratoNpc(n);
    const pct = n.vidaMax ? Math.max(0, Math.min(100, (n.vida / n.vidaMax) * 100)) : null;
    box.className = `npc-card moldura visivel ${n.relacao || ''} ${n.vidaMax && n.vida <= 0 ? 'derrotado' : ''} ${nomeFalando === n.nome ? 'falando' : ''}`;
    box.innerHTML = `
      <div class="npc-arte ${corpo ? 'com-corpo' : ''}">${ret ? `<img src="${ret}" alt="">` : `<div class="npc-emoji">${emojiNpc(n)}</div>`}</div>
      <div class="npc-info">
        <div class="npc-nome">${esc(n.nome)}</div>
        ${pct !== null ? `<div class="npc-vida"><div class="trilho"><div class="fill" style="width:${pct}%"></div></div><span>${n.vida} / ${n.vidaMax}</span></div>`
          : `<span class="rel ${esc(n.relacao || 'desconhecido')}">${esc(n.relacao || '?')}</span>`}
      </div>`;
    box.title = n.descricao || n.nome;
    box.onclick = () => {
      if (ocupado) return;
      entrada.value = n.relacao === 'hostil' ? `Ataco ${n.nome} ` : `Digo a ${n.nome}: "`;
      entrada.focus();
      autoAltura();
    };
  }

  // ─────────────────────────── ações rápidas ───────────────────────────
  function renderAcoes(sugestoes = []) {
    const box = $('[data-acoes]', el);
    box.innerHTML = '';
    if (ocupado) return;
    let cartas;
    if (emCombate()) {
      const alvo = npcEmCena()?.nome || 'o inimigo';
      const arma = Object.values(st.inventario).flat().find((i) => i.equipado && /arma/.test(i.pasta));
      const temMagia = st.personagem.manaMax > 0;
      cartas = [
        { ic: '⚔️', t: 'Atacar', d: 'Tentar um golpe contra o inimigo', acao: `Ataco ${alvo}${arma ? ` com ${arma.nome}` : ''}.`, destaque: true },
        { ic: '🛡️', t: 'Defender', d: 'Reduz o dano do próximo ataque', acao: `Assumo postura defensiva contra ${alvo}.` },
        temMagia
          ? { ic: '🔥', t: 'Magia', d: 'Usar um feitiço do seu grimório', acao: `Conjuro um feitiço contra ${alvo}.` }
          : { ic: '🌀', t: 'Manobra', d: 'Empurrar, derrubar ou desarmar', acao: `Tento uma manobra para desarmar ${alvo}.` },
        { ic: '🧪', t: 'Item', d: 'Usar item do inventário', item: true },
      ];
    } else {
      cartas = (sugestoes || []).slice(0, 4).map((s) => ({ ic: ICONE_SUGESTAO.find(([re]) => re.test(norm(s)))?.[1] || '✦', t: s, acao: s }));
    }
    cartas.forEach((c, i) => {
      const b = h(`<button class="carta-acao ${c.destaque ? 'destaque' : ''} ${c.d ? '' : 'simples'}" style="animation-delay:${i * 70}ms">
        <span class="ic">${c.ic}</span><span class="tx"><b>${esc(c.t)}</b>${c.d ? `<small>${esc(c.d)}</small>` : ''}</span></button>`);
      b.addEventListener('click', () => {
        if (c.item) {
          aba = 'inv';
          filtroPasta = Object.keys(st.inventario).includes('consumiveis') ? 'consumiveis' : 'todos';
          renderAbas();
          toast('Escolha um item e clique em "Usar"');
        } else enviar(c.acao);
      });
      box.appendChild(b);
    });
  }

  // ─────────────────────────── lateral ───────────────────────────
  function renderAbas() {
    const qtdItens = Object.values(st.inventario).flat().length;
    const ativas = st.missoes.filter((m) => m.estado === 'ativa').length;
    const abas = [
      ['inv', '🎒', 'Inventário', 0], ['missoes', '📜', 'Missões', ativas], ['npcs', '👥', 'NPCs', 0],
      ['lugares', '🗺️', 'Lugares', 0], ['dados', '🎲', 'Dados', 0],
    ];
    const nav = $('[data-abas]', el);
    nav.innerHTML = abas.map(([id, ic, n, q]) => `<button class="aba ${aba === id ? 'sel' : ''}" data-aba="${id}"><span class="ic">${ic}${q ? `<span class="cont">${q}</span>` : ''}</span>${n}</button>`).join('');
    $$('[data-aba]', nav).forEach((b) => b.addEventListener('click', () => {
      aba = b.dataset.aba;
      lsSet('cronicas:aba', aba);
      audio.clique();
      renderAbas();
    }));
    const c = $('[data-conteudo]', el);
    c.innerHTML = '';
    if (aba === 'inv') renderInventario(c, qtdItens);
    if (aba === 'missoes') renderMissoes(c);
    if (aba === 'npcs') renderNpcs(c);
    if (aba === 'lugares') renderLugares(c);
    if (aba === 'dados') renderDados(c);
  }

  function pastasOrdenadas() {
    return Object.keys(st.inventario).sort((a, b) => {
      if (a === 'diversos') return 1;
      if (b === 'diversos') return -1;
      const ia = ORDEM_PASTAS.indexOf(a);
      const ib = ORDEM_PASTAS.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
  }

  function renderInventario(c) {
    const pastas = pastasOrdenadas();
    if (filtroPasta !== 'todos' && !pastas.includes(filtroPasta)) filtroPasta = 'todos';
    c.appendChild(h(`<div class="busca-inv">
      <div class="com-ic"><span class="ic">🔍</span><input class="campo" data-busca placeholder="Buscar item..." value="${esc(busca)}"></div>
      <button class="btn icone" data-abrir-inv title="Abrir a pasta do inventário">📁</button>
    </div>`));
    const chips = h(`<div class="chips-pastas"></div>`);
    const chip = (id, rot) => {
      const qtd = id === 'todos' ? Object.values(st.inventario).flat().length : st.inventario[id].length;
      const b = h(`<button class="chip-pasta ${filtroPasta === id ? 'sel' : ''}" data-pasta-nome="${esc(id)}" title="${esc(rot)} (${qtd})">${id === 'todos' ? '' : emojiPasta(id) + ' '}${esc(rot)}</button>`);
      b.addEventListener('click', () => { filtroPasta = id; itemAberto = null; renderAbas(); });
      if (id !== 'todos') {
        b.addEventListener('dragover', (e) => { e.preventDefault(); b.classList.add('alvo'); });
        b.addEventListener('dragleave', () => b.classList.remove('alvo'));
        b.addEventListener('drop', async (e) => {
          e.preventDefault();
          b.classList.remove('alvo');
          const itemId = e.dataTransfer.getData('text/item');
          if (itemId && itemId.split('/')[0] !== id) await moverItem(itemId, id);
        });
        if (!qtd) b.addEventListener('contextmenu', async (e) => {
          e.preventDefault();
          if (await confirmar('Excluir pasta vazia?', `A pasta "${id}" será removida.`, { ok: 'Excluir' })) {
            try { st = await api.inventario.excluirPasta(slug, id); renderAbas(); } catch (err) { toast(err.message, 'erro'); }
          }
        });
      }
      chips.appendChild(b);
    };
    chip('todos', 'Todos');
    pastas.forEach((p) => chip(p, p.replace(/-/g, ' ')));
    const nova = h('<button class="chip-pasta nova" title="Nova pasta">＋</button>');
    nova.addEventListener('click', async () => {
      const nome = await perguntar('Nova pasta do inventário', { placeholder: 'Ex.: relíquias, ingredientes, cartas' });
      if (!nome) return;
      try { st = await api.inventario.criarPasta(slug, nome); filtroPasta = slugify(nome); renderAbas(); } catch (e) { toast(e.message, 'erro'); }
    });
    chips.appendChild(nova);
    c.appendChild(chips);

    const termo = norm(busca);
    const itens = (filtroPasta === 'todos' ? pastas.flatMap((p) => st.inventario[p]) : st.inventario[filtroPasta])
      .filter((i) => !termo || norm(`${i.nome} ${i.descricao}`).includes(termo));
    const grade = h('<div class="grade-itens"></div>');
    itens.forEach((it) => {
      const ic = iconeItem(it);
      const t = h(`<button class="tile rar-${esc(it.raridade || 'comum')} ${itemAberto === it.id ? 'sel' : ''} ${itensNovos.has(it.nome) ? 'novo' : ''}" draggable="true" title="${esc(it.nome)}">
        ${ic.img ? `<img src="${ic.img}" alt="">` : `<span class="emoji">${ic.emoji}</span>`}
        ${it.quantidade > 1 ? `<span class="qt">${it.quantidade}</span>` : ''}
        ${it.equipado ? '<span class="eqp" title="Equipado">E</span>' : ''}
      </button>`);
      t.addEventListener('click', () => { itemAberto = itemAberto === it.id ? null : it.id; renderAbas(); });
      t.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/item', it.id); ev.dataTransfer.effectAllowed = 'move'; });
      grade.appendChild(t);
    });
    const vazios = Math.max(12, Math.ceil((itens.length + 1) / 4) * 4) - itens.length;
    for (let i = 0; i < vazios; i++) grade.appendChild(h('<div class="tile vazio"></div>'));
    c.appendChild(grade);

    const sel = Object.values(st.inventario).flat().find((i) => i.id === itemAberto);
    if (sel) c.appendChild(detalheItem(sel, pastas));
    itensNovos = new Set();

    const inp = $('[data-busca]', c);
    inp.addEventListener('input', () => {
      busca = inp.value;
      const pos = inp.selectionStart;
      renderAbas();
      const novo = $('[data-busca]', el);
      novo.focus();
      novo.setSelectionRange(pos, pos);
    });
    $('[data-abrir-inv]', c).addEventListener('click', () => api.campanhas.abrirPasta(slug, 'inventario'));
  }

  function detalheItem(it, pastas) {
    const e = h(`<div class="detalhe-item moldura leve">
      <div class="cab"><div class="moldura-ic rar-${esc(it.raridade || 'comum')}">${iconeItemHtml(it, 'grande')}</div><div><div class="n rar-txt-${esc(it.raridade || 'comum')}">${esc(it.nome)}${it.quantidade > 1 ? ` <span class="suave">x${it.quantidade}</span>` : ''}</div>
        <div class="meta">${esc(RARIDADES[it.raridade]?.nome || 'Comum')} · ${emojiPasta(it.pasta)} ${esc(it.pasta)}/${it.equipado ? ' · equipado' : ''}</div></div></div>
      ${it.descricao ? `<div class="desc">${esc(it.descricao)}</div>` : ''}
      <div class="acoes-item">
        <button class="btn pequeno" data-a="usar">✋ Usar</button>
        <button class="btn pequeno" data-a="equipar">${it.equipado ? 'Desequipar' : '⚔️ Equipar'}</button>
        <button class="btn pequeno" data-a="examinar">🔍</button>
        <select class="btn pequeno" data-a="mover" title="Mover para...">
          <option value="">📁 Mover…</option>
          ${pastas.filter((p) => p !== it.pasta).map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
          <option value="__nova">＋ nova pasta…</option>
        </select>
        <button class="btn pequeno perigo" data-a="descartar" title="Descartar">🗑️</button>
      </div>
    </div>`);
    $('[data-a="usar"]', e).addEventListener('click', () => enviar(`Uso ${it.nome}.`));
    $('[data-a="examinar"]', e).addEventListener('click', () => enviar(`Examino ${it.nome} com atenção.`));
    $('[data-a="equipar"]', e).addEventListener('click', async () => {
      try { st = await api.inventario.equipar(slug, it.id); renderFicha(); renderAbas(); } catch (err) { toast(err.message, 'erro'); }
    });
    $('[data-a="mover"]', e).addEventListener('change', async (ev) => {
      let dest = ev.target.value;
      if (dest === '__nova') dest = await perguntar('Mover para nova pasta', { placeholder: 'nome da pasta' });
      if (dest) await moverItem(it.id, dest);
      else ev.target.value = '';
    });
    $('[data-a="descartar"]', e).addEventListener('click', async () => {
      if (!(await confirmar('Descartar item?', `${it.nome}${it.quantidade > 1 ? ` (x${it.quantidade})` : ''} será removido do inventário.`, { ok: 'Descartar', perigo: true }))) return;
      try { st = await api.inventario.descartar(slug, it.id); itemAberto = null; renderFicha(); renderAbas(); } catch (err) { toast(err.message, 'erro'); }
    });
    return e;
  }

  async function moverItem(id, pasta) {
    try {
      st = await api.inventario.mover(slug, id, pasta);
      itemAberto = null;
      audio.clique();
      renderAbas();
    } catch (e) { toast(e.message, 'erro'); }
  }

  function renderMissoes(c) {
    if (!st.missoes.length) return c.appendChild(h('<div class="vazia">Nenhuma missão ainda. O mestre registra aqui os objetivos da história.</div>'));
    const grupos = [['ativa', 'Em andamento', '📜'], ['concluida', 'Concluídas', '✅'], ['falhou', 'Falhas', '❌']];
    for (const [estado, titulo, ic] of grupos) {
      const ms = st.missoes.filter((m) => (m.estado || 'ativa') === estado);
      if (!ms.length) continue;
      c.appendChild(h(`<div class="secao-titulo">${titulo}</div>`));
      ms.forEach((m) => c.appendChild(h(`<div class="cartao ${estado}"><div class="t">${ic} ${esc(m.nome)}</div>${m.descricao ? `<div class="d">${esc(m.descricao)}</div>` : ''}</div>`)));
    }
  }

  function renderNpcs(c) {
    if (!st.npcs.length) return c.appendChild(h('<div class="vazia">Ninguém conhecido ainda.</div>'));
    st.npcs.forEach((n) => {
      const ret = retratoNpc(n);
      const card = h(`<div class="cartao npc ${n.vidaMax && n.vida <= 0 ? 'derrotado' : ''}">
        <div class="mini-ret">${ret ? `<img src="${ret}" alt="">` : emojiNpc(n)}</div>
        <div class="corpo"><div class="t">${esc(n.nome)}<span class="rel ${esc(n.relacao || 'desconhecido')}">${esc(n.relacao || '?')}</span></div>
          ${n.descricao ? `<div class="d">${esc(n.descricao)}</div>` : ''}
          ${n.vidaMax ? `<div class="d">❤️ ${n.vida}/${n.vidaMax}${n.vida <= 0 ? ' — derrotado' : ''}</div>` : ''}
          <div class="linha-flex" style="margin-top:6px;flex-wrap:wrap">
            <button class="btn pequeno" data-falar>💬 Falar com</button>
            <select class="btn pequeno sel-voz" data-voz-npc title="Voz deste personagem">
              <option value="">🗣️ auto (${esc(PRESETS_VOZ[vozDoNpc({ ...n, voz: null })]?.nome || '')})</option>
              ${Object.entries(PRESETS_VOZ).map(([id, v]) => `<option value="${id}" ${n.voz === id ? 'selected' : ''}>${esc(v.nome)}</option>`).join('')}
            </select>
            <button class="btn pequeno" data-ouvir title="Ouvir a voz">▶</button>
            <button class="btn pequeno" data-gravar title="Gravar uma voz só para este personagem">🎙️</button>
          </div></div></div>`);
      $('[data-gravar]', card).addEventListener('click', async () => {
        const wav = await gravarVoz({ titulo: `Voz de ${n.nome}`, idioma: st.campanha.idioma || 'pt' });
        if (!wav) return;
        try { await api.voz.salvarRef(slugify(n.nome), wav, slug); toast(`🎙️ ${n.nome} agora fala com a voz gravada.`); } catch (e) { toast(e.message, 'erro'); }
      });
      $('[data-voz-npc]', card).addEventListener('change', async (ev) => {
        try { st = await api.voz.definirVozNpc(slug, n.id, ev.target.value); renderAbas(); } catch (e) { toast(e.message, 'erro'); }
      });
      $('[data-ouvir]', card).addEventListener('click', () => {
        const atual = st.npcs.find((x) => x.id === n.id) || n;
        const en = st.campanha.idioma === 'en';
        falarComVoz([{ quem: atual.nome, texto: en ? `Greetings, ${st.personagem.nome}. I am ${atual.nome}.` : `Saudações, ${st.personagem.nome}. Eu sou ${atual.nome}.`, emocao: 'neutro' }]);
      });
      $('[data-falar]', card).addEventListener('click', () => {
        entrada.value = `Vou até ${n.nome} e digo: "`;
        entrada.focus();
        autoAltura();
      });
      c.appendChild(card);
    });
  }

  function renderLugares(c) {
    const mapa = urlCena('mapa-mundi');
    if (mapa) {
      const m = h(`<button class="mapa-mini" style="background-image:url('${mapa}')"><span>🗺️ Abrir mapa do mundo</span></button>`);
      m.addEventListener('click', () => modal(`<h2>🗺️ Mapa do mundo</h2><img class="mapa-grande" src="${mapa}" alt=""><div class="modal-acoes"><button class="btn" data-fechar>Fechar</button></div>`, { classe: 'largo' }));
      c.appendChild(m);
    }
    if (!st.lugares.length) return c.appendChild(h('<div class="vazia">Nenhum lugar descoberto ainda.</div>'));
    st.lugares.forEach((l) => {
      const card = h(`<div class="cartao"><div class="t">📍 ${esc(l.nome)}</div>${l.descricao ? `<div class="d">${esc(l.descricao)}</div>` : ''}
        <div style="margin-top:8px"><button class="btn pequeno" data-ir>🧭 Viajar para lá</button></div></div>`);
      $('[data-ir]', card).addEventListener('click', () => enviar(`Viajo até ${l.nome}.`));
      c.appendChild(card);
    });
  }

  function renderDados(c) {
    c.innerHTML = `
      <div class="bandeja">
        ${[4, 6, 8, 10, 12, 20, 100].map((d) => `<button class="dado-btn" data-lados="${d}"><span class="forma">${d === 20 ? '⬢' : d === 6 ? '■' : d === 4 ? '▲' : d === 100 ? '◉' : '◆'}</span>d${d}</button>`).join('')}
        <button class="dado-btn" data-expr title="Expressão livre, ex.: 2d6+3"><span class="forma">∑</span>livre</button>
      </div>
      <div class="dado-opcoes">
        <label class="suave">Qtd</label><input class="campo" type="number" min="1" max="20" value="1" data-qtd style="width:70px">
        <label class="suave">Bônus</label><input class="campo" type="number" value="0" data-bonus style="width:76px">
      </div>
      <div class="alternar"><span>Enviar resultado ao mestre</span><div class="switch ${lsGet('cronicas:dadoMestre', false) ? 'on' : ''}" data-enviar-mestre></div></div>
      <div class="secao-titulo">Histórico</div>
      <div class="historico-dados">${historicoDados.map((r) => `<div class="h"><span>${esc(r.expr)} <span class="suave">[${r.dados.join(', ')}]${r.bonus ? ` ${fmtMod(r.bonus)}` : ''}</span></span><b>${r.total}</b></div>`).join('') || '<div class="vazia">Nada rolado ainda.</div>'}</div>`;
    const sw = $('[data-enviar-mestre]', c);
    sw.addEventListener('click', () => { const v = !sw.classList.contains('on'); sw.classList.toggle('on', v); lsSet('cronicas:dadoMestre', v); });
    const rolarLivre = async (expr) => {
      const r = rolarExpr(expr);
      if (!r) return toast('Expressão inválida. Use algo como 2d6+3', 'erro');
      await animarRolagem(r.lados, r.total - r.bonus, { titulo: expr, total: r.total, mostrarDetalhe: `[${r.dados.join(', ')}]${r.bonus ? ` ${fmtMod(r.bonus)}` : ''}` });
      historicoDados.unshift(r);
      historicoDados.splice(15);
      if (lsGet('cronicas:dadoMestre', false)) enviar(`Rolei ${expr}: [${r.dados.join(', ')}]${r.bonus ? ` ${fmtMod(r.bonus)}` : ''} = ${r.total}`, 'sistema');
      if (aba === 'dados') renderAbas();
    };
    $$('[data-lados]', c).forEach((b) => b.addEventListener('click', () => {
      const q = Math.max(1, parseInt($('[data-qtd]', c).value, 10) || 1);
      const bonus = parseInt($('[data-bonus]', c).value, 10) || 0;
      rolarLivre(`${q}d${b.dataset.lados}${bonus ? fmtMod(bonus) : ''}`);
    }));
    $('[data-expr]', c).addEventListener('click', async () => {
      const e = await perguntar('Rolar expressão', { placeholder: 'Ex.: 2d6+3, 4d8, 1d20-1' });
      if (e) rolarLivre(e);
    });
  }

  function renderEfeitos() {
    const box = $('[data-efeitos]', el);
    const bons = st.personagem.status.filter((s) => s.positivo === true || (s.positivo === undefined && !/ca[ií]do|envenen|sangr|atordo|exaust|congel|amaldi|arrepi|ferid|queim/i.test(s.nome)));
    const ruins = st.personagem.status.filter((s) => !bons.includes(s));
    if (!bons.length && !ruins.length) { box.innerHTML = ''; box.classList.add('oculto'); return; }
    box.classList.remove('oculto');
    const linha = (s, bom) => `<div class="efeito ${bom ? 'bom' : 'ruim'}" title="${esc(s.descricao || '')}">
      <span class="ponto">${bom ? '●' : '🩸'}</span><div class="tx"><b>${esc(s.nome)}</b>${s.descricao ? `<small>${esc(s.descricao)}</small>` : ''}</div>
      <span class="turnos">${s.turnos ? `${s.turnos} turno${s.turnos > 1 ? 's' : ''}` : ''}</span></div>`;
    box.innerHTML = `
      ${bons.length ? `<div class="secao-titulo">Efeitos ativos</div>${bons.map((s) => linha(s, true)).join('')}` : ''}
      ${ruins.length ? `<div class="secao-titulo">Condições</div>${ruins.map((s) => linha(s, false)).join('')}` : ''}`;
  }

  // ─────────────────────────── história ───────────────────────────
  function rolarFim(forcar = false) {
    const perto = hist.scrollHeight - hist.scrollTop - hist.clientHeight < 180;
    if (forcar || perto) hist.scrollTop = hist.scrollHeight;
  }

  function msgEl(m, { primeira = false } = {}) {
    if (m.papel === 'jogador') {
      return h(`<div class="msg jogador"><div class="bolha"><div class="quem">${esc(st.personagem.nome)}</div>${esc(m.texto)}</div></div>`);
    }
    if (m.papel === 'sistema') {
      if (/^A aventura começa/.test(m.texto)) return null;
      const cls = /SUCESSO|CRÍTICO/.test(m.texto) ? 'sucesso' : /FALHA|DESASTRE/.test(m.texto) ? 'falha' : '';
      const partes = m.texto.match(/^🎲\s*(.+?):\s*(.+?)(?:\s*→\s*(\w+))?$/);
      if (partes) {
        return h(`<div class="msg sistema"><span class="rol ${cls}"><span class="d">🎲</span><span class="q">${esc(partes[1])}</span><span class="c">${esc(partes[2])}${partes[3] ? ` <span class="v">→ ${esc(partes[3])}</span>` : ''}</span></span></div>`);
      }
      return h(`<div class="msg sistema"><span class="rol ${cls}">${esc(m.texto)}</span></div>`);
    }
    const frag = document.createDocumentFragment();
    if (m.capituloNovo) frag.appendChild(h(`<div class="divisor-cap">${esc(m.capituloNovo)}</div>`));
    const avatar = urlRetrato('mago-anciao');
    const e = h(`<div class="msg mestre ${primeira || m.capituloNovo ? 'primeira' : ''} ${m.roteiro ? 'com-roteiro' : ''}">
      <div class="av-mestre">${avatar ? `<img src="${avatar}" alt="">` : '🪶'}</div>
      <div class="conteudo"><div class="texto">${htmlMestre(m)}</div></div>
      <button class="ouvir-msg" title="Ouvir de novo">🔊</button></div>`);
    $('.ouvir-msg', e).addEventListener('click', (ev) => { ev.stopPropagation(); narrarMsg(m, e); });
    if (m.logs?.length) $('.conteudo', e).appendChild(logsEl(m.logs));
    frag.appendChild(e);
    return frag;
  }

  /** Narração do mestre: roteiro (narrador + falas com retrato e emoção) ou texto corrido (turnos antigos). */
  function htmlMestre(m) {
    if (!m.roteiro?.length) return md(m.texto);
    const inline = (t) => md(t).replace(/^<p[^>]*>|<\/p>$/g, '').replace(/<\/p><p[^>]*>/g, '<br><br>');
    return m.roteiro.map((r, i) => {
      if (r.quem === 'narrador') return `<p class="seg narr" data-seg="${i}">${inline(r.texto)}</p>`;
      const npc = st.npcs.find((n) => n.nome === r.quem) || { nome: r.quem };
      const ret = retratoNpc(npc);
      const emo = EMOCOES[r.emocao];
      return `<div class="seg fala-npc ${esc(npc.relacao || '')} emo-${esc(r.emocao || 'neutro')}" data-seg="${i}">
        <div class="fala-av">${ret ? `<img src="${ret}" alt="">` : `<span>${emojiNpc(npc)}</span>`}</div>
        <div class="fala-corpo"><div class="fala-quem">${esc(r.quem)}${emo?.icone ? `<span class="emo" title="${esc(emo.nome)}">${emo.icone}</span>` : ''}</div>
        <div class="fala-txt">${inline(r.texto)}</div></div></div>`;
    }).join('');
  }

  function logsEl(logs) {
    return h(`<div class="logs">${logs.map((l, i) => `<span class="log ${esc(l.tipo)}" style="animation-delay:${i * 90}ms">${l.icone} ${esc(l.texto)}</span>`).join('')}</div>`);
  }

  function renderHistoriaCompleta() {
    hist.innerHTML = '';
    let primeira = true;
    for (const m of st.mensagens) {
      const e = msgEl(m, { primeira: primeira && m.papel === 'mestre' });
      if (m.papel === 'mestre') primeira = false;
      if (e) hist.appendChild(e);
    }
    const ultima = st.mensagens.at(-1);
    if (ultima?.papel === 'mestre') {
      if (ultima.rolagem) mostrarCardRolagem(ultima.rolagem);
      renderAcoes(ultima.sugestoes);
    } else renderAcoes([]);
    requestAnimationFrame(() => rolarFim(true));
  }

  function mostrarPensando() {
    const frases = ['O mestre consulta suas anotações', 'O destino está sendo tecido', 'Os dados do destino rolam nas sombras', 'O mestre molha a pena no tinteiro'];
    hist.appendChild(h(`<div class="pensando" data-pensando><span class="pena">🪶</span><span>${frases[Math.floor(Math.random() * frases.length)]}</span><span class="pontos"><span>.</span><span>.</span><span>.</span></span></div>`));
    rolarFim(true);
  }

  function mostrarErro(msg) {
    $$('.erro-turno', hist).forEach((x) => x.remove());
    const e = h(`<div class="erro-turno">⚠️ ${esc(msg)}
      <div class="acoes"><button class="btn pequeno" data-repetir>↻ Tentar de novo</button><button class="btn pequeno fantasma" data-desfazer>Desfazer minha ação</button><button class="btn pequeno fantasma" data-cfg2>⚙️ Configurações</button></div></div>`);
    $('[data-repetir]', e).addEventListener('click', () => { e.remove(); turno(() => api.jogo.repetir(slug)); });
    $('[data-desfazer]', e).addEventListener('click', async () => { e.remove(); st = await api.jogo.desfazerUltima(slug); renderHistoriaCompleta(); });
    $('[data-cfg2]', e).addEventListener('click', async () => { if (await abrirConfig()) renderBarra(); });
    hist.appendChild(e);
    rolarFim(true);
  }

  /** Digita o texto do mestre revelando nó por nó (preserva negrito/itálico). */
  function digitar(container, html) {
    container.innerHTML = html;
    const vel = S.cfg?.velocidadeTexto ?? 14;
    if (vel <= 0) return { promessa: Promise.resolve(), pular() {} };
    const nos = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nos.push({ no: walker.currentNode, txt: walker.currentNode.textContent });
    nos.forEach((n) => (n.no.textContent = ''));
    const pars = [...container.children];
    pars.forEach((p) => (p.style.display = 'none'));
    container.classList.add('digitando');
    let i = 0, c = 0, fim, raf, ultimo = performance.now(), acumulado = 0;
    const promessa = new Promise((r) => (fim = r));
    const concluir = () => {
      cancelAnimationFrame(raf);
      nos.forEach((n) => (n.no.textContent = n.txt));
      pars.forEach((p) => (p.style.display = ''));
      container.classList.remove('digitando');
      fim();
    };
    const passo = (agora) => {
      acumulado += (agora - ultimo) / vel;
      ultimo = agora;
      let n = Math.floor(acumulado);
      acumulado -= n;
      while (n-- > 0 && i < nos.length) {
        const atual = nos[i];
        const par = pars.find((p) => p.contains(atual.no));
        if (par) par.style.display = '';
        c++;
        atual.no.textContent = atual.txt.slice(0, c);
        audio.pena();
        if (c >= atual.txt.length) { i++; c = 0; }
      }
      rolarFim();
      if (i >= nos.length) return concluir();
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return { promessa, pular: concluir };
  }

  // ─────────────────────────── turno ───────────────────────────
  function setOcupado(v) {
    ocupado = v;
    $('[data-enviar]', el).disabled = v;
    const m = MODOS.find((x) => x.id === modo);
    entrada.placeholder = v ? 'O mestre está narrando...' : m.ph;
    el.classList.toggle('ocupado', v);
  }

  async function enviar(texto, papel = 'jogador') {
    texto = String(texto || '').trim();
    if (!texto || ocupado) return;
    if (papel === 'jogador') {
      if (modo === 'fala' && !/^digo/i.test(texto)) texto = `Digo: "${texto.replace(/^"|"$/g, '')}"`;
      if (modo === 'ooc') texto = `(Fora do jogo, pergunto ao mestre) ${texto}`;
    }
    if (papel === 'jogador') {
      audio.enviar();
      narrador.parar();
      if (S.cfg?.vozLerJogador && narrador.ativo) {
        const fala = texto.match(/^Digo:\s*"?(.+?)"?$/s)?.[1] || texto;
        falarComVoz([{ quem: 'heroi', texto: fala, emocao: 'neutro' }]);
      }
    }
    const e = msgEl({ papel, texto });
    if (e) hist.appendChild(e);
    rolarFim(true);
    await turno(() => api.jogo.acao(slug, texto, papel), { manterVoz: papel === 'jogador' && !!S.cfg?.vozLerJogador });
  }

  async function turno(chamada, { manterVoz = false } = {}) {
    if (ocupado) return;
    if (!manterVoz) narrador.parar();
    digitacao?.pular();
    $$('.card-rolagem', hist).forEach((x) => x.remove());
    setOcupado(true);
    renderAcoes([]);
    mostrarPensando();
    let r;
    try {
      r = await chamada();
    } catch (err) {
      if (!vivo) return; // saiu da tela: o turno foi cancelado de propósito
      $('[data-pensando]', hist)?.remove();
      setOcupado(false);
      mostrarErro(err.message);
      return;
    }
    if (!vivo) return;
    $('[data-pensando]', hist)?.remove();
    const antes = st;
    st = r.state;
    const ultimaMestre = st.mensagens.at(-1);

    // o palco muda ANTES do texto: lugar, clima, quem está em cena
    if (r.temaMudou) setTema(r.turno.tema, { anunciar: true });
    aplicarCena();
    if (r.capituloNovo) setTimeout(() => vivo && anunciarTexto('Capítulo', r.capituloNovo, 3400), r.temaMudou ? 1400 : 0);
    renderBarra();
    renderNpc();

    const primeira = !antes.mensagens.some((m) => m.papel === 'mestre');
    const frag = msgEl({ ...ultimaMestre, logs: [] }, { primeira });
    const msgMestre = frag.lastElementChild || frag;
    hist.appendChild(frag);
    digitacao = digitar($('.texto', msgMestre), htmlMestre(ultimaMestre));
    narrarMsg(ultimaMestre, msgMestre);
    msgMestre.addEventListener('click', () => digitacao?.pular(), { once: true });
    await digitacao.promessa;
    digitacao = null;
    if (!vivo) return;

    if (r.logs?.length) {
      $('.conteudo', msgMestre).appendChild(logsEl(r.logs));
      await tocarConsequencias(r);
      if (!vivo) return;
    }
    renderFicha();
    renderNpc();
    renderAbas();
    renderEfeitos();
    if (r.turno.rolagem) mostrarCardRolagem(r.turno.rolagem);
    setOcupado(false);
    renderAcoes(r.turno.sugestoes);
    rolarFim();
    entrada.focus();
  }

  /** Som e efeitos visuais de cada consequência, em sequência (sem virar cacofonia). */
  async function tocarConsequencias(r) {
    const esperar = (ms) => new Promise((res) => setTimeout(res, ms));
    const fila = [];
    const tipos = new Set(r.logs.map((l) => l.tipo));
    if (tipos.has('npc') && r.logs.some((l) => l.tipo === 'npc' && l.icone === '👹')) fila.push(() => efeito('inimigo'));
    if (tipos.has('npc_dano')) fila.push(() => { audio.golpeInimigo(); $('[data-npc]', el).classList.add('atingido'); setTimeout(() => $('[data-npc]', el)?.classList.remove('atingido'), 600); });
    if (tipos.has('npc_derrotado')) fila.push(() => { audio.derrota(); $('[data-npc]', el).classList.add('atingido'); setTimeout(() => $('[data-npc]', el)?.classList.remove('atingido'), 600); });
    if (tipos.has('dano') || tipos.has('morte')) fila.push(() => efeito('dano'));
    if (tipos.has('cura')) fila.push(() => efeito('cura'));
    if (r.logs.some((l) => l.tipo === 'mana' && l.texto.startsWith('+'))) fila.push(() => efeito('mana'));
    if (r.logs.some((l) => l.tipo === 'ouro' && l.texto.startsWith('+'))) fila.push(() => efeito('moedas'));
    if (tipos.has('xp') && !tipos.has('nivel')) fila.push(() => efeito('xp'));
    if (r.logs.some((l) => l.tipo === 'missao' && /^Nova|conclu/i.test(l.texto))) fila.push(() => efeito('missao'));
    const ganhos = r.turno.eventos.filter((e) => e.tipo === 'item_ganho');
    ganhos.forEach((e) => itensNovos.add(e.nome));
    const especiais = ganhos.filter((e) => ['raro', 'epico', 'lendario', 'mitico'].includes(e.raridade || itemDoCatalogo(e.nome)?.raridade));
    const simples = ganhos.filter((e) => !especiais.includes(e));
    if (simples.length) fila.push(() => audio.item(simples[0].raridade || 'comum'));
    for (const f of fila) { if (!vivo) return; f(); await esperar(260); }
    for (const e of especiais) { if (!vivo) return; await mostrarItemObtido(e); }
    if (tipos.has('nivel')) setTimeout(() => vivo && efeito('nivel'), 300);
  }

  /** Vitrine de item raro+: arte grande, brilho da raridade, fanfarra. */
  function mostrarItemObtido(ev) {
    return new Promise((resolve) => {
      const base = itemDoCatalogo(ev.nome) || {};
      const raridade = ev.raridade || base.raridade || 'raro';
      const rar = RARIDADES[raridade] || RARIDADES.raro;
      const ic = iconeItem({ nome: ev.nome, icone: ev.icone, pasta: ev.pasta });
      const ov = h(`<div class="vitrine-item rar-${raridade}" style="--cor-rar:${rar.cor}">
        <div class="raios"></div>
        <div class="caixa">
          <div class="rotulo-rar">${rar.nome}</div>
          <div class="arte-item">${ic.img ? `<img src="${ic.img}" alt="">` : `<span>${ic.emoji}</span>`}</div>
          <div class="nome-item">${esc(ev.nome)}</div>
          ${ev.descricao || base.desc ? `<div class="desc-item">${esc(ev.descricao || base.desc)}</div>` : ''}
          <div class="dica">clique para guardar na mochila</div>
        </div>
      </div>`);
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('aberta'));
      audio.item(raridade);
      particulas.rajada(rar.cor.match(/\w\w/g).map((x) => parseInt(x, 16)), raridade === 'mitico' ? 180 : 110);
      const fechar = () => {
        ov.classList.remove('aberta');
        setTimeout(() => { ov.remove(); resolve(); }, 350);
        document.removeEventListener('keydown', fechar);
      };
      ov.addEventListener('click', fechar);
      document.addEventListener('keydown', fechar);
      setTimeout(() => ov.isConnected && ov.classList.contains('aberta') && fechar(), raridade === 'mitico' ? 6000 : 4500);
    });
  }

  // ─────────────────────────── rolagens ───────────────────────────
  function mostrarCardRolagem(rol) {
    const mb = rol.atributo ? mod(st.personagem.atributos[rol.atributo]) : 0;
    const card = h(`<div class="card-rolagem">
      <div class="d20">🎲</div>
      <div class="info"><b>${esc(rol.motivo)}</b>
        <div>${esc(rol.dado)}${rol.atributo ? ` + ${NOME_ATR[rol.atributo]} (${fmtMod(mb)})` : ''}${rol.dificuldade ? ` · dificuldade ${rol.dificuldade}` : ''}</div>
      </div>
      <button class="btn primario">Rolar ${esc(rol.dado)}</button>
    </div>`);
    $('button', card).addEventListener('click', () => { card.remove(); testePedido(rol); });
    hist.appendChild(card);
    rolarFim();
  }

  function veredito(nat, total, lados, dif) {
    if (lados === 20 && nat === 20) return { txt: 'CRÍTICO!', cls: 'sucesso', critico: true };
    if (lados === 20 && nat === 1) return { txt: 'DESASTRE!', cls: 'falha', desastre: true };
    if (dif == null) return null;
    return total >= dif ? { txt: 'SUCESSO', cls: 'sucesso' } : { txt: 'FALHA', cls: 'falha' };
  }

  async function testePedido(rol) {
    const lados = parseInt(String(rol.dado).replace(/\D/g, ''), 10) || 20;
    const [nat] = rolar(lados);
    const mb = rol.atributo ? mod(st.personagem.atributos[rol.atributo]) : 0;
    const total = nat + mb;
    const v = veredito(nat, total, lados, rol.dificuldade);
    await animarRolagem(lados, nat, { titulo: rol.motivo, total, bonus: mb, veredito: v });
    if (!vivo) return;
    const partes = `${rol.dado} = ${nat}${rol.atributo ? ` ${conta(mb)} = ${total}` : ''}`;
    enviar(`🎲 ${rol.atributo ? `Teste de ${NOME_ATR[rol.atributo]}` : 'Rolagem'}${rol.dificuldade ? ` (CD ${rol.dificuldade})` : ''} — ${rol.motivo}: ${partes}${v ? ` → ${v.txt.replace('!', '')}` : ''}`, 'sistema');
  }

  async function testeLivre(atr) {
    if (ocupado) return;
    const [nat] = rolar(20);
    const mb = atr ? mod(st.personagem.atributos[atr]) : 0;
    const total = nat + mb;
    const v = veredito(nat, total, 20, null);
    const enviarAoMestre = await animarRolagem(20, nat, { titulo: atr ? `Teste de ${NOME_ATR[atr]}` : 'd20 livre', total, bonus: mb, veredito: v, perguntarEnvio: true });
    if (!vivo) return;
    const txtConta = atr ? `d20 = ${nat} ${conta(mb)} = ${total}` : `d20 = ${nat}`;
    if (enviarAoMestre) enviar(`🎲 ${atr ? `Teste livre de ${NOME_ATR[atr]}` : 'Rolagem livre'}: ${txtConta}${v ? ` → ${v.txt.replace('!', '')}` : ''}`, 'sistema');
  }

  /** Overlay com o dado girando. Retorna true se o jogador pediu para enviar ao mestre. */
  function animarRolagem(lados, nat, { titulo, total, bonus = 0, veredito: v = null, perguntarEnvio = false, mostrarDetalhe = '' }) {
    return new Promise((resolve) => {
      audio.dado();
      const ov = h(`<div class="rolagem-overlay"><div>
        <div class="dado-grande girando">${D20_SVG}<span>?</span></div>
        <div class="res"><div class="suave">${esc(titulo || '')}</div><div data-det></div><div class="veredito" data-ver></div>
        <div class="linha-flex" style="justify-content:center;margin-top:14px" data-botoes></div></div>
      </div></div>`);
      document.body.appendChild(ov);
      const face = $('.dado-grande span', ov);
      const giro = setInterval(() => (face.textContent = rolar(lados)[0]), 60);
      setTimeout(() => {
        clearInterval(giro);
        const dado = $('.dado-grande', ov);
        dado.classList.remove('girando');
        face.textContent = nat;
        audio.pousarDado();
        if (v?.critico) { dado.classList.add('critico'); audio.critico(); particulas.rajada([255, 215, 90], 90); }
        if (v?.desastre) { dado.classList.add('desastre'); audio.falhaCritica(); }
        $('[data-det]', ov).innerHTML = mostrarDetalhe
          ? `${esc(mostrarDetalhe)} = <b style="font-size:24px">${total}</b>`
          : bonus ? `${nat} ${conta(bonus)} = <b style="font-size:24px">${total}</b>` : '';
        if (v) { const ver = $('[data-ver]', ov); ver.textContent = v.txt; ver.classList.add(v.cls); }
        const bot = $('[data-botoes]', ov);
        const fechar = (val) => { ov.remove(); document.removeEventListener('keydown', tecla); resolve(val); };
        const tecla = (e) => (e.key === 'Escape' || e.key === 'Enter') && fechar(e.key === 'Enter' && perguntarEnvio);
        document.addEventListener('keydown', tecla);
        if (perguntarEnvio) {
          const b1 = h('<button class="btn primario">Enviar ao mestre</button>');
          const b2 = h('<button class="btn fantasma">Só olhar</button>');
          b1.addEventListener('click', () => fechar(true));
          b2.addEventListener('click', () => fechar(false));
          bot.append(b2, b1);
        } else {
          ov.addEventListener('click', () => fechar(false));
          setTimeout(() => ov.isConnected && fechar(false), 1700);
        }
      }, 800);
    });
  }

  // ─────────────────────────── eventos da tela ───────────────────────────
  function autoAltura() {
    entrada.style.height = 'auto';
    entrada.style.height = Math.min(140, entrada.scrollHeight) + 'px';
  }
  const enviarEntrada = () => {
    const t = entrada.value;
    if (!t.trim() || ocupado) return;
    entrada.value = '';
    autoAltura();
    enviar(t);
  };
  entrada.addEventListener('input', autoAltura);
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarEntrada(); }
  });
  $('[data-enviar]', el).addEventListener('click', enviarEntrada);
  $('[data-dado]', el).addEventListener('click', () => testeLivre(null));
  $('[data-modo]', el).addEventListener('click', (e) => {
    const i = (MODOS.findIndex((m) => m.id === modo) + 1) % MODOS.length;
    modo = MODOS[i].id;
    e.currentTarget.textContent = MODOS[i].ic;
    e.currentTarget.title = `Modo: ${MODOS[i].nome} (clique para trocar)`;
    toast(`Modo: ${MODOS[i].nome}`);
    setOcupado(ocupado);
    entrada.focus();
  });
  $('[data-recolher]', extra).addEventListener('click', (e) => {
    bannerVisivel = !bannerVisivel;
    lsSet('cronicas:banner', bannerVisivel);
    e.currentTarget.classList.toggle('on', bannerVisivel);
    $('.col-centro', el).classList.toggle('sem-banner', !bannerVisivel);
  });
  $('[data-voltar]', extra).addEventListener('click', () => irPara('inicio'));
  $('[data-pasta]', extra).addEventListener('click', () => api.campanhas.abrirPasta(slug));
  $('[data-cronica]', extra).addEventListener('click', () => api.campanhas.abrirPasta(slug, 'historia/cronica.md'));
  $('[data-cfg]', extra).addEventListener('click', async () => { if (await abrirConfig()) { renderBarra(); renderBotaoVoz(); narrador.configurar(S.cfg); } });
  $('[data-som]', extra).addEventListener('click', async () => {
    const som = !S.cfg?.som;
    S.cfg = await api.config.salvar({ som });
    ligarSom(som);
    renderBarra();
  });
  // ─────────────────────────── voz ───────────────────────────
  function ctxVoz() {
    const p = st.personagem;
    return {
      npcs: st.npcs, falante: st.campanha.falante, heroi: p.nome, slug, idioma: st.campanha.idioma || 'pt',
      vozHeroi: p.voz || vozDoNpc({ nome: p.nome, retrato: p.retrato }),
    };
  }
  function falarComVoz(segmentos) {
    narrador.configurar(S.cfg);
    return narrador.falar(segmentos, ctxVoz());
  }
  let msgFalando = null;
  /** Narra uma mensagem do mestre: usa o roteiro dele (com emoções) ou quebra o texto antigo pelo travessão. */
  function narrarMsg(m, msgEl) {
    narrador.configurar(S.cfg);
    if (!narrador.ativo) return;
    msgFalando = msgEl;
    const segs = m.roteiro?.length ? roteiroDoTurno(m.roteiro) : roteiro(m.texto, ctxVoz());
    falarComVoz(segs);
  }
  let avisouErroVoz = false;
  narrador.onErro = (e) => {
    if (avisouErroVoz) return;
    avisouErroVoz = true;
    toast(`🗣️ Voz indisponível: ${e.message}`, 'erro', 7000);
  };
  narrador.onAviso = (msg) => { if (!avisouErroVoz) { avisouErroVoz = true; toast(`🗣️ ${msg}`, 'info', 7000); } };
  narrador.onFalante = (quem, i = -1) => {
    if (!vivo) return;
    $$('.msg.mestre.narrando', el).forEach((x) => x.classList.remove('narrando'));
    $$('.seg.falando', el).forEach((x) => x.classList.remove('falando'));
    if (quem === 'narrador' && msgFalando) msgFalando.classList.add('narrando');
    if (quem && i >= 0 && msgFalando) $(`.seg[data-seg="${i}"]`, msgFalando)?.classList.add('falando');
    const npc = quem && quem !== 'narrador' && quem !== 'heroi' ? quem : null;
    renderNpc(npc);
  };
  function renderBotaoVoz() {
    const b = $('[data-voz]', extra);
    const on = S.cfg?.vozAtiva !== false && S.cfg?.vozMotor !== 'desligado';
    b.classList.toggle('on', on);
    b.style.opacity = on ? 1 : 0.5;
    b.title = on ? 'Voz ligada — clique para silenciar o mestre' : 'Voz desligada — clique para o mestre falar';
  }
  $('[data-voz]', extra).addEventListener('click', async () => {
    const vozAtiva = !(S.cfg?.vozAtiva !== false);
    S.cfg = await api.config.salvar({ vozAtiva, ...(vozAtiva && S.cfg.vozMotor === 'desligado' ? { vozMotor: 'chatterbox' } : {}) });
    narrador.configurar(S.cfg);
    if (!vozAtiva) narrador.parar();
    renderBotaoVoz();
    toast(vozAtiva ? '🗣️ O mestre vai falar' : '🔇 Mestre em silêncio');
  });
  renderBotaoVoz();
  narrador.configurar(S.cfg);

  const teclaGlobal = (e) => {
    if (e.key === 'Escape' && digitacao) digitacao.pular();
    else if (e.key === 'Escape') narrador.parar();
  };
  document.addEventListener('keydown', teclaGlobal);

  // se você (ou o Claude Code) editar arquivos na pasta, a tela acompanha — inclusive artes novas
  const desligarWatcher = api.onMudancaExterna(async ({ state, arquivo }) => {
    if (!vivo || ocupado || state.slug !== slug) return;
    if (/^artes[\\/]/.test(arquivo)) await carregarCatalogo(slug);
    if (!vivo) return;
    st = state;
    if (st.campanha.tema !== document.documentElement.dataset.tema) setTema(st.campanha.tema, { anunciar: true });
    aplicarCena();
    renderTudo();
    toast(`📁 Pasta atualizada: ${arquivo}`);
  });

  carregar();

  return () => {
    // a sessão para de verdade: cancela o turno no processo principal (API/Claude Code),
    // cala a voz e impede que qualquer promessa pendente mexa na tela depois
    vivo = false;
    api.jogo.cancelar(slug).catch(() => {});
    digitacao?.pular();
    narrador.parar();
    desligarWatcher();
    document.removeEventListener('keydown', teclaGlobal);
    api.campanhas.fechar().catch(() => {});
  };
}
