// Coluna lateral da tela do jogo: inventário em pastas, missões + enredo + diário, NPCs, lugares, dados e efeitos.
import { $, $$, esc, h, toast, confirmar, perguntar, modal, fmtMod, rolarExpr } from '../ui.js';
import { api } from '../app.js';
import { audio } from '../cenario.js';
import { urlCena, iconeHtml, iconeKitHtml, retratoNpc, emojiNpc, iconeItem, iconeItemHtml, emojiPasta, iconePastaHtml, slugify, RARIDADES } from '../arte.js';
import { PRESETS_VOZ, vozDoNpc } from '../vozes.js';
import { lsGet, lsSet, norm } from './util.js';
import { abrirMapaMundi } from './mapa.js';

const ORDEM_PASTAS = ['armas', 'armaduras', 'consumiveis', 'itens-chave'];

/** @param {import('./contexto.js').CtxJogo} ctx */
export function criarLateral(ctx) {
  const { el, slug, entrada } = ctx;
  let aba = lsGet('cronicas:aba', 'inv');
  let filtroPasta = 'todos';
  let busca = '';
  let itemAberto = null;
  let itensNovos = new Set();
  const historicoDados = [];

  // ─────────────────────────── lateral ───────────────────────────
  function renderAbas() {
    const qtdItens = Object.values(ctx.st.inventario).flat().length;
    const ativas = ctx.st.missoes.filter((m) => m.estado === 'ativa').length;
    const abas = [
      ['inv', 'mochila', 'Inventário', 0], ['missoes', 'missao', 'Missões', ativas], ['npcs', 'npcs', 'NPCs', 0],
      ['lugares', 'mapa', 'Lugares', 0], ['dados', 'dado', 'Dados', 0],
    ];
    const nav = $('[data-abas]', el);
    const iconesKit = { inv: 'inventory', missoes: 'quests', npcs: 'npcs', lugares: 'locations', dados: 'dice' };
    nav.innerHTML = abas.map(([id, ic, n, q]) => `<button class="aba ${aba === id ? 'sel' : ''}" data-aba="${id}"><span class="ic">${iconeKitHtml('menu', iconesKit[id])}${q ? `<span class="cont">${q}</span>` : ''}</span>${n}</button>`).join('');
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
    return Object.keys(ctx.st.inventario).sort((a, b) => {
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
      const qtd = id === 'todos' ? Object.values(ctx.st.inventario).flat().length : ctx.st.inventario[id].length;
      const b = h(`<button class="chip-pasta ${filtroPasta === id ? 'sel' : ''}" data-pasta-nome="${esc(id)}" title="${esc(rot)} (${qtd})">${id === 'todos' ? iconeHtml('mochila', 'pasta') : iconePastaHtml(id)}${esc(rot)}</button>`);
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
            try { ctx.st = await api.inventario.excluirPasta(slug, id); renderAbas(); } catch (err) { toast(err.message, 'erro'); }
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
      try { ctx.st = await api.inventario.criarPasta(slug, nome); filtroPasta = slugify(nome); renderAbas(); } catch (e) { toast(e.message, 'erro'); }
    });
    chips.appendChild(nova);
    c.appendChild(chips);

    const termo = norm(busca);
    const itens = (filtroPasta === 'todos' ? pastas.flatMap((p) => ctx.st.inventario[p]) : ctx.st.inventario[filtroPasta])
      .filter((i) => !termo || norm(`${i.nome} ${i.descricao}`).includes(termo));
    const grade = h('<div class="grade-itens"></div>');
    itens.forEach((it) => {
      const ic = iconeItem(it);
      const t = h(`<button class="tile rar-${esc(it.raridade || 'comum')} ${it.equipado ? 'equipado' : ''} ${itemAberto === it.id ? 'sel' : ''} ${itensNovos.has(it.nome) ? 'novo' : ''}" draggable="true" title="${esc(it.nome)}${it.equipado ? ' · Equipado' : ''}">
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

    const sel = Object.values(ctx.st.inventario).flat().find((i) => i.id === itemAberto);
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
    $('[data-a="usar"]', e).addEventListener('click', () => ctx.enviar(`Uso ${it.nome}.`));
    $('[data-a="examinar"]', e).addEventListener('click', () => ctx.enviar(`Examino ${it.nome} com atenção.`));
    $('[data-a="equipar"]', e).addEventListener('click', async () => {
      try { ctx.st = await api.inventario.equipar(slug, it.id); ctx.renderFicha(); renderAbas(); } catch (err) { toast(err.message, 'erro'); }
    });
    $('[data-a="mover"]', e).addEventListener('change', async (ev) => {
      let dest = ev.target.value;
      if (dest === '__nova') dest = await perguntar('Mover para nova pasta', { placeholder: 'nome da pasta' });
      if (dest) await moverItem(it.id, dest);
      else ev.target.value = '';
    });
    $('[data-a="descartar"]', e).addEventListener('click', async () => {
      if (!(await confirmar('Descartar item?', `${it.nome}${it.quantidade > 1 ? ` (x${it.quantidade})` : ''} será removido do inventário.`, { ok: 'Descartar', perigo: true }))) return;
      try { ctx.st = await api.inventario.descartar(slug, it.id); itemAberto = null; ctx.renderFicha(); renderAbas(); } catch (err) { toast(err.message, 'erro'); }
    });
    return e;
  }

  async function moverItem(id, pasta) {
    try {
      ctx.st = await api.inventario.mover(slug, id, pasta);
      itemAberto = null;
      audio.clique();
      renderAbas();
    } catch (e) { toast(e.message, 'erro'); }
  }

  function renderMissoes(c) {
    // o rumo da história (sem os segredos do mestre) e o diário do que já aconteceu
    const e = ctx.st.enredo;
    if (e?.atos?.length) {
      const i = Math.max(0, e.atos.findIndex((a) => a.estado === 'atual'));
      c.appendChild(h(`<div class="cartao enredo">
        <div class="t">${iconeHtml('orientacao', 'mini')} ${esc(e.titulo)}</div>
        <div class="atos">${e.atos.map((a, j) => `<span class="ato ${j < i ? 'feito' : j === i ? 'atual' : ''}" title="${esc(a.titulo)}">${j + 1}</span>`).join('')}</div>
        <div class="d"><b>Ato ${i + 1} — ${esc(e.atos[i].titulo)}</b><br>${esc(e.atos[i].objetivo)}</div>
      </div>`));
    }
    const mem = ctx.st.memoria || {};
    if (mem.linha?.length || mem.fatos?.length) {
      const diario = h(`<details class="secao diario" ${lsGet('cronicas:diario', false) ? 'open' : ''}>
        <summary>${iconeHtml('diario', 'mini')} Diário</summary>
        ${mem.resumo ? `<div class="d resumo">${esc(mem.resumo)}</div>` : ''}
        <ul class="linha-tempo">${mem.linha.slice(-12).reverse().map((l) => `<li>${esc(l.replace(/^T\d+ /, ''))}</li>`).join('')}</ul>
        ${mem.fatos?.length ? `<div class="secao-titulo">O que você sabe</div><ul class="fatos">${mem.fatos.slice(-12).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      </details>`);
      diario.addEventListener('toggle', () => lsSet('cronicas:diario', diario.open));
      c.appendChild(diario);
    }
    if (!ctx.st.missoes.length) return c.appendChild(h('<div class="vazia">Nenhuma missão ainda. O mestre registra aqui os objetivos da história.</div>'));
    const grupos = [['ativa', 'Em andamento', iconeHtml('missao', 'mini')], ['concluida', 'Concluídas', iconeHtml('missao-ok', 'mini')], ['falhou', 'Falhas', iconeHtml('missao-falhou', 'mini')]];
    for (const [estado, titulo, ic] of grupos) {
      const ms = ctx.st.missoes.filter((m) => (m.estado || 'ativa') === estado);
      if (!ms.length) continue;
      c.appendChild(h(`<div class="secao-titulo">${titulo}</div>`));
      ms.forEach((m) => c.appendChild(h(`<div class="cartao ${estado}"><div class="t">${ic} ${esc(m.nome)}</div>${m.descricao ? `<div class="d">${esc(m.descricao)}</div>` : ''}</div>`)));
    }
  }

  function renderNpcs(c) {
    if (!ctx.st.npcs.length) return c.appendChild(h('<div class="vazia">Ninguém conhecido ainda.</div>'));
    ctx.st.npcs.forEach((n) => {
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
          </div></div></div>`);
      $('[data-voz-npc]', card).addEventListener('change', async (ev) => {
        try { ctx.st = await api.voz.definirVozNpc(slug, n.id, ev.target.value); renderAbas(); } catch (e) { toast(e.message, 'erro'); }
      });
      $('[data-ouvir]', card).addEventListener('click', () => {
        const atual = ctx.st.npcs.find((x) => x.id === n.id) || n;
        const en = ctx.st.campanha.idioma === 'en';
        ctx.falarComVoz([{ quem: atual.nome, texto: en ? `Greetings, ${ctx.st.personagem.nome}. I am ${atual.nome}.` : `Saudações, ${ctx.st.personagem.nome}. Eu sou ${atual.nome}.`, emocao: 'neutro' }]);
      });
      $('[data-falar]', card).addEventListener('click', () => {
        entrada.value = `Vou até ${n.nome} e digo: "`;
        entrada.focus();
        ctx.autoAltura();
      });
      c.appendChild(card);
    });
  }

  function renderLugares(c) {
    const mapa = urlCena('mapa-mundi');
    if (mapa) {
      const aqui = ctx.st.campanha.mapaLocal;
      const m = h(`<button class="mapa-mini" style="background-image:url('${mapa}')"><span>${iconeHtml('mapa', 'mini')} Mapa do mundo${aqui ? ` · 📍 ${esc(aqui.replace(/-/g, ' '))}` : ''}</span></button>`);
      m.addEventListener('click', () => abrirMapaMundi(ctx));
      c.appendChild(m);
    }
    if (!ctx.st.lugares.length) return c.appendChild(h('<div class="vazia">Nenhum lugar descoberto ainda.</div>'));
    ctx.st.lugares.forEach((l) => {
      const card = h(`<div class="cartao"><div class="t">📍 ${esc(l.nome)}</div>${l.descricao ? `<div class="d">${esc(l.descricao)}</div>` : ''}
        <div style="margin-top:8px"><button class="btn pequeno" data-ir>🧭 Viajar para lá</button></div></div>`);
      $('[data-ir]', card).addEventListener('click', () => ctx.enviar(`Viajo até ${l.nome}.`));
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
      await ctx.animarRolagem(r.lados, r.total - r.bonus, { titulo: expr, total: r.total, mostrarDetalhe: `[${r.dados.join(', ')}]${r.bonus ? ` ${fmtMod(r.bonus)}` : ''}` });
      historicoDados.unshift(r);
      historicoDados.splice(15);
      if (lsGet('cronicas:dadoMestre', false)) ctx.enviar(`Rolei ${expr}: [${r.dados.join(', ')}]${r.bonus ? ` ${fmtMod(r.bonus)}` : ''} = ${r.total}`, 'sistema');
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
    const bons = ctx.st.personagem.status.filter((s) => s.positivo === true || (s.positivo === undefined && !/ca[ií]do|envenen|sangr|atordo|exaust|congel|amaldi|arrepi|ferid|queim/i.test(s.nome)));
    const ruins = ctx.st.personagem.status.filter((s) => !bons.includes(s));
    if (!bons.length && !ruins.length) { box.innerHTML = ''; box.classList.add('oculto'); return; }
    box.classList.remove('oculto');
    const iconeCondicao = (nome) => {
      const n = norm(nome);
      const pares = [
        [/sangr/, 'bleeding'], [/venen/, 'poison'], [/atordo/, 'stunned'],
        [/medo|apavor|aterror/, 'fear'], [/maldi|amald/, 'curse'], [/caido|caído|derrub/, 'downed'],
      ];
      const tipo = pares.find(([re]) => re.test(n))?.[1];
      return tipo ? iconeKitHtml('status', tipo, 'mini') : null;
    };
    const linha = (s, bom) => `<div class="efeito ${bom ? 'bom' : 'ruim'}" title="${esc(s.descricao || '')}">
      <span class="ponto">${iconeCondicao(s.nome) || (bom ? '●' : '◆')}</span><div class="tx"><b>${esc(s.nome)}</b>${s.descricao ? `<small>${esc(s.descricao)}</small>` : ''}</div>
      <span class="turnos">${s.turnos ? `${s.turnos} turno${s.turnos > 1 ? 's' : ''}` : ''}</span></div>`;
    box.innerHTML = `
      ${bons.length ? `<div class="secao-titulo">Efeitos ativos</div>${bons.map((s) => linha(s, true)).join('')}` : ''}
      ${ruins.length ? `<div class="secao-titulo">Condições</div>${ruins.map((s) => linha(s, false)).join('')}` : ''}`;
  }

  return {
    render: renderAbas,
    renderEfeitos,
    /** Abre o inventário já filtrado (carta "Item" do combate). */
    abrirInventario(pasta) {
      aba = 'inv';
      filtroPasta = ctx.st.inventario[pasta] ? pasta : 'todos';
      renderAbas();
    },
    /** Itens ganhos neste turno brilham na mochila. */
    marcarNovo: (nome) => itensNovos.add(nome),
  };
}
