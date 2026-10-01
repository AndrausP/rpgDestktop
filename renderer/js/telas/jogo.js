import { $, $$, esc, h, toast, confirmar, ATRIBUTOS, ABREV_ATR, NOME_ATR, mod, fmtMod, FLAMULA } from '../ui.js';
import { S, api, irPara } from '../app.js';
import { TEMAS } from '../temas.js';
import { setTema, setCena, anunciarTexto, efeito, audio, particulas, ligarSom } from '../cenario.js';
import { setBarra } from '../barra.js';
import { carregarCatalogo, urlCena, cenaDoTema, iconeHtml, iconeKitHtml, retratoNpc, corpoNpc, emojiNpc, iconeItem, iconeItemHtml, RARIDADES, itemDoCatalogo } from '../arte.js';
import { abrirConfig } from './config.js';
import { narrador } from '../vozes.js';
import { urlRetratoHeroi, editarHeroi } from '../heroi.js';
import { lsGet, lsSet, norm } from '../jogo/util.js';
import { criarArena } from '../jogo/arena.js';
import { criarLateral } from '../jogo/lateral.js';
import { criarHistorico } from '../jogo/historico.js';
import { criarRolagens } from '../jogo/rolagens.js';
import { criarNarracao } from '../jogo/narracao.js';
import { abrirSalaHost } from '../coop.js';

const ICONE_ATR = Object.fromEntries(Object.entries({ forca: 'str', destreza: 'dex', constituicao: 'constitution', inteligencia: 'int', sabedoria: 'wis', carisma: 'cha' }).map(([atr, ic]) => [atr, iconeKitHtml('attributes', ic)]));
const PERIODO = { amanhecer: ['🌅', 'Amanhecer'], dia: ['☀️', 'Dia'], entardecer: ['🌇', 'Entardecer'], noite: ['🌙', 'Noite'] };
const MODOS = [
  { id: 'acao', ic: '✦', nome: 'Ação', ph: 'O que você faz?' },
  { id: 'fala', ic: '💬', nome: 'Falar', ph: 'O que você diz?' },
  { id: 'ooc', ic: '❔', nome: 'Perguntar ao mestre', ph: 'Pergunte algo ao mestre (fora do jogo)' },
];
const ICONE_SUGESTAO = [
  [/atac|golpe|lut|investir/, iconeKitHtml('actions', 'attack')], [/defend|bloque|proteg|escudo/, '🛡️'], [/magia|feiti|conjur|runa/, iconeKitHtml('actions', 'magic')], [/fug|corr|recu/, iconeKitHtml('actions', 'escape')],
  [/fal|pergunt|convers|dig|negoci|chamar/, iconeKitHtml('actions', 'speak')], [/exami|olh|observ|investig|ler|procur/, iconeKitHtml('actions', 'investigate')], [/segu|ir |ir$|entr|avan|subir|explor|viaj/, iconeKitHtml('actions', 'interact')],
  [/descans|dorm|acamp/, '🏕️'], [/compr|vend|pag/, '🪙'], [/ajud|salv|cur/, '🤝'], [/escond|furtiv|esgueir/, '🥷'], [/beb|us|poç/, '🧪'], [/orar|rez/, '🙏'],
];


export function telaJogo(raiz, { slug, novo, papel = 'solo' }) {
  let st = null;
  let aplicados = 0; // turnos já mostrados (no co-op o resultado pode chegar antes da resposta do pedido)
  let ocupado = false;
  let vivo = true; // vira false quando a tela é destruída (Home, trocar de campanha)
  let modo = 'acao';
  let digitacao = null;
  let vidaAnterior = null;
  const secoes = lsGet('cronicas:secoes', { equip: true, hist: false });
  let bannerVisivel = lsGet('cronicas:banner', true);

  const el = h(`
    <div class="jogo">
      <aside class="moldura col-heroi" data-ficha></aside>

      <section class="col-centro ${bannerVisivel ? '' : 'sem-banner'}">
        <div class="moldura cena-banner" data-banner>
          <div class="arte" data-arte></div>
          <div class="arena" data-arena></div>
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
          <button class="btn icone ic-img" data-dado title="Rolar d20 livre">${iconeKitHtml('menu', 'dice')}</button>
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
    <button class="btn icone ${papel === 'convidado' ? 'on' : ''}" data-coop title="${papel === 'convidado' ? 'Você está na sala de outro jogador' : 'Jogar em grupo (co-op)'}">🤝</button>
    <button class="btn icone ${bannerVisivel ? 'on' : ''}" data-recolher title="Mostrar/ocultar a arte da cena">🖼️</button>
    <button class="btn icone ic-img" data-cronica title="Abrir a crônica">${iconeHtml('diario')}</button>
    <button class="btn icone ic-img" data-pasta title="Abrir pasta da campanha">${iconeHtml('mochila')}</button>
    <button class="btn icone" data-voz title="Voz do mestre e dos personagens (Kokoro)">🗣️</button>
    <button class="btn icone" data-som title="Som ambiente">🔈</button>
    <button class="btn icone ic-img" data-cfg title="Configurações">${iconeKitHtml('menu', 'settings')}</button>
  </div>`);

  // ─────────────────────────── módulos da tela ───────────────────────────
  // Cada parte da tela é um módulo (renderer/js/jogo/*) que conversa com esta por um contexto:
  // o estado (st) e as ações (enviar, turno...) ficam aqui; o resto só desenha e reage.
  const ctx = {
    slug, el, hist, entrada, extra, api,
    papel, // 'solo' | 'host' | 'convidado' (co-op) — o host vira 'host' ao abrir a sala
    coop: null, // última rodada recebida: {jogadores, acoes, prazo, resolvendo}
    get st() { return st; },
    set st(v) { st = v; },
    get ocupado() { return ocupado; },
    get vivo() { return vivo; },
    enviar: (...a) => enviar(...a),
    turno: (...a) => turno(...a),
    autoAltura: () => autoAltura(),
    renderFicha: () => renderFicha(),
    renderGrupo: () => renderGrupo(),
    renderBarra: () => renderBarra(),
    renderNpc: (nome) => renderNpc(nome),
    renderAcoes: (s) => renderAcoes(s),
    npcEmCena: () => npcEmCena(),
    emCombate: () => emCombate(),
    falarComVoz: (segs) => narracao.falar(segs),
    narrarMsg: (m, e) => narracao.narrarMsg(m, e),
    mostrarCardRolagem: (r) => rolagens.mostrarCard(r),
    animarRolagem: (...a) => rolagens.animar(...a),
    rolarFim: (f) => historico.rolarFim(f),
  };
  const arena = criarArena(ctx);
  const lateral = criarLateral(ctx);
  const historico = criarHistorico(ctx);
  const rolagens = criarRolagens(ctx);
  const narracao = criarNarracao(ctx);

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
    historico.renderCompleta();
    if (ctx.papel === 'convidado') {
      // convidado: quem abre a aventura e repete turnos é o host
      if (!st.mensagens.length) historico.mostrarPensando();
      const i = await api.coop.info().catch(() => null); // presença do grupo (o 1º aviso chegou antes da tela)
      if (vivo && i?.rodada && !ctx.coop) await eventoCoop(i.rodada);
    } else if (novo || st.mensagens.length === 0) iniciar();
    else if (st.mensagens.at(-1)?.papel !== 'mestre') historico.mostrarErro('O último turno não recebeu resposta do mestre.');
    entrada.focus();
  }
  const iniciar = () => turno(() => api.jogo.iniciar(slug));

  function renderTudo() {
    renderBarra();
    renderFicha();
    arena.render();
    renderNpc();
    lateral.render();
    lateral.renderEfeitos();
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
    $('[data-rotulo-cena]', el).innerHTML = c.local ? `<span><img class="ic-ui mini" src="assets/ui/Decoration/location-marker.png" alt=""> ${esc(c.local)}</span>` : cena ? `<span>${esc(cena)}</span>` : '';
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
      <div class="retrato-heroi ${caido ? 'caido' : ''}" data-editar-heroi role="button" tabindex="0" aria-label="Editar retrato, aparência e voz do herói" title="Retrato, aparência e voz do herói">
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
           ${barra('vida', iconeKitHtml('status', 'health', 'mini'), p.vida, p.vidaMax, p.vida / p.vidaMax <= 0.25 ? 'critica' : '')}
           ${p.manaMax > 0 ? barra('mana', iconeKitHtml('status', 'mana', 'mini'), p.mana, p.manaMax) : ''}
          ${barra('xp', iconeHtml('xp', 'mini'), p.xp, p.xpProximo)}
        </div>
        <div class="ouro">${iconeHtml('ouro', 'mini')} <b>${p.ouro}</b> <span class="suave">moedas de ouro</span></div>
        <div class="grupo-mini" data-grupo></div>
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
    $('[data-editar-heroi]', box).addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); }
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
    $$('[data-atr]', box).forEach((a) => a.addEventListener('click', () => rolagens.testeLivre(a.dataset.atr)));
    renderGrupo();
    $$('details[data-sec]', box).forEach((d) => d.addEventListener('toggle', () => {
      secoes[d.dataset.sec] = d.open;
      lsSet('cronicas:secoes', secoes);
    }));
  }

  /** Co-op: os outros heróis do grupo (vida e se já mandaram a ação desta rodada). */
  function renderGrupo() {
    const box = $('[data-grupo]', el);
    if (!box) return;
    const meu = st.heroi || 'principal';
    const outros = (st.grupo || []).filter((g) => g.id !== meu);
    if (!outros.length) { box.innerHTML = ''; return; }
    const pres = ctx.coop?.jogadores || {};
    box.innerHTML = `<div class="secao-titulo" style="margin:4px 0 0">Grupo</div>` + outros.map((g) => {
      const ret = urlRetratoHeroi(g, slug);
      const pc = Math.max(0, Math.min(100, (g.vida / g.vidaMax) * 100));
      const j = pres[g.id];
      const icone = !j ? '' : !j.online ? '🔌' : j.enviou ? '✅' : '⌛';
      const dica = !j ? '' : !j.online ? 'desconectado' : j.enviou ? 'já mandou a ação da rodada' : 'pensando na ação';
      return `<div class="gm ${j && !j.online ? 'off' : ''} ${g.vida <= 0 ? 'caido' : ''}" title="${esc(g.nome)} — ${g.vida}/${g.vidaMax}${g.jogador ? ` · ${esc(g.jogador)}` : ''}${dica ? ` · ${dica}` : ''}">
        ${ret ? `<img src="${ret}" alt="">` : `<span class="av">${esc(g.icone || '⚔️')}</span>`}
        <div class="n">${esc(g.nome)}<small>${esc(g.classe || '')}${g.jogador ? ` · ${esc(g.jogador)}` : ''}</small><div class="hp"><i style="width:${pc}%"></i></div></div>
        <span class="estado">${icone}</span></div>`;
    }).join('');
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
      box.tabIndex = -1;
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
    box.setAttribute('role', 'button');
    box.setAttribute('aria-label', `Interagir com ${n.nome}`);
    box.tabIndex = 0;
    box.onclick = () => {
      if (ocupado) return;
      entrada.value = n.relacao === 'hostil' ? `Ataco ${n.nome} ` : `Digo a ${n.nome}: "`;
      entrada.focus();
      autoAltura();
    };
    box.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); box.click(); }
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
        { ic: iconeKitHtml('actions', 'attack'), t: 'Atacar', d: 'Tentar um golpe contra o inimigo', acao: `Ataco ${alvo}${arma ? ` com ${arma.nome}` : ''}.`, destaque: true, estilo: 'perigo' },
        { ic: iconeHtml('armaduras'), t: 'Defender', d: 'Reduz o dano do próximo ataque', acao: `Assumo postura defensiva contra ${alvo}.` },
        temMagia
          ? { ic: iconeKitHtml('actions', 'magic'), t: 'Magia', d: 'Usar um feitiço do seu grimório', acao: `Conjuro um feitiço contra ${alvo}.`, estilo: 'magia' }
          : { ic: '🌀', t: 'Manobra', d: 'Empurrar, derrubar ou desarmar', acao: `Tento uma manobra para desarmar ${alvo}.` },
        { ic: iconeHtml('pocao'), t: 'Item', d: 'Usar item do inventário', item: true },
      ];
    } else {
      cartas = (sugestoes || []).slice(0, 4).map((s) => ({ ic: ICONE_SUGESTAO.find(([re]) => re.test(norm(s)))?.[1] || '✦', t: s, acao: s }));
    }
    cartas.forEach((c, i) => {
      const b = h(`<button class="carta-acao ${c.destaque ? 'destaque' : ''} ${c.estilo || ''} ${c.d ? '' : 'simples'}" style="animation-delay:${i * 70}ms">
        <span class="ic">${c.ic}</span><span class="tx"><b>${esc(c.t)}</b>${c.d ? `<small>${esc(c.d)}</small>` : ''}</span></button>`);
      b.addEventListener('click', () => {
        if (c.item) {
          lateral.abrirInventario('consumiveis');
          toast('Escolha um item e clique em "Usar"');
        } else enviar(c.acao);
      });
      box.appendChild(b);
    });
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
        narracao.falar([{ quem: 'heroi', texto: fala, emocao: 'neutro' }]);
      }
    }
    const e = historico.msgEl({ papel, texto, autor: st.heroi, autorNome: st.personagem.nome });
    if (e) { e.classList.add('provisoria'); e.dataset.autor = st.heroi || 'principal'; hist.appendChild(e); }
    historico.rolarFim(true);
    await turno(() => api.jogo.acao(slug, texto, papel), { manterVoz: papel === 'jogador' && !!S.cfg?.vozLerJogador });
  }

  /** Tela em modo "o mestre está pensando": trava a entrada, some com as cartas e os cards de rolagem. */
  function prepararTurno({ manterVoz = false } = {}) {
    if (!manterVoz) narrador.parar();
    digitacao?.pular();
    $$('.card-rolagem', hist).forEach((x) => x.remove());
    setOcupado(true);
    renderAcoes([]);
    historico.mostrarPensando();
  }

  async function turno(chamada, { manterVoz = false } = {}) {
    if (ocupado) return;
    prepararTurno({ manterVoz });
    const vez = aplicados;
    let r;
    try {
      r = await chamada();
    } catch (err) {
      if (!vivo) return; // saiu da tela: o turno foi cancelado de propósito
      $('[data-pensando]', hist)?.remove();
      $$('.provisoria', hist).forEach((x) => x.remove());
      setOcupado(false);
      historico.mostrarErro(err.message);
      return;
    }
    if (!vivo || aplicados !== vez) return; // co-op: o resultado da rodada já chegou pelo evento
    // co-op: a ação entrou na rodada; o resultado chega para todos pelo evento 'turno'
    if (r?.aguardando) return esperarGrupo(r);
    await aplicarResultado(r);
  }

  /** Mostra o resultado de um turno (o seu, ou a rodada do grupo que chegou pela rede). */
  async function aplicarResultado(r) {
    if (!vivo) return;
    aplicados++;
    $('[data-pensando]', hist)?.remove();
    $('[data-aguardando]', hist)?.remove();
    const antes = st;
    st = r.state;
    const ultimaMestre = st.mensagens.at(-1);
    // as ações desta rodada (a sua e as dos outros heróis) entram no histórico como o host gravou:
    // são as mensagens entre a fala anterior do mestre e esta
    $$('.provisoria', hist).forEach((x) => x.remove());
    let k = st.mensagens.length - 1;
    while (k > 0 && st.mensagens[k - 1].papel !== 'mestre') k--;
    for (const m of st.mensagens.slice(k, -1)) {
      const e = historico.msgEl(m);
      if (e) hist.appendChild(e);
    }

    // o palco muda ANTES do texto: lugar, clima, quem está em cena
    if (r.temaMudou) setTema(r.turno.tema, { anunciar: true });
    aplicarCena();
    arena.render();
    if (r.capituloNovo) setTimeout(() => vivo && anunciarTexto('Capítulo', r.capituloNovo, 3400), r.temaMudou ? 1400 : 0);
    renderBarra();
    renderNpc();

    const primeira = !antes.mensagens.some((m) => m.papel === 'mestre');
    const frag = historico.msgEl({ ...ultimaMestre, logs: [] }, { primeira });
    const msgMestre = frag.lastElementChild || frag;
    hist.appendChild(frag);
    digitacao = historico.digitar($('.texto', msgMestre), historico.htmlMestre(ultimaMestre));
    narracao.narrarMsg(ultimaMestre, msgMestre);
    msgMestre.addEventListener('click', () => digitacao?.pular(), { once: true });
    await digitacao.promessa;
    digitacao = null;
    if (!vivo) return;

    if (r.logs?.length) {
      $('.conteudo', msgMestre).appendChild(historico.logsEl(r.logs));
      await tocarConsequencias(r);
      if (!vivo) return;
    }
    renderFicha();
    arena.render();
    renderNpc();
    lateral.render();
    lateral.renderEfeitos();
    if (r.turno.rolagem) rolagens.mostrarCard(r.turno.rolagem);
    setOcupado(false);
    renderAcoes(r.turno.sugestoes);
    historico.rolarFim();
    entrada.focus();
  }

  // ─────────────────────────── co-op: rodada do grupo ───────────────────────────
  /** Sua ação entrou na rodada. Se o mestre já está narrando, o "pensando" fica; senão, mostra quem falta. */
  function esperarGrupo(r) {
    if (r.resolvendo) return;
    $('[data-pensando]', hist)?.remove();
    mostrarAguardando();
  }

  let relogio = null;
  /** Quadro "aguardando o grupo": quem já agiu, quem falta, o prazo e (para o host) "Resolver agora". */
  function mostrarAguardando() {
    const c = ctx.coop;
    let box = $('[data-aguardando]', hist);
    if (!c || c.resolvendo || !c.acoes?.length) {
      box?.remove();
      clearInterval(relogio);
      relogio = null;
      return;
    }
    const meu = st.heroi || 'principal';
    const nomeHeroi = (id) => st.grupo.find((g) => g.id === id)?.nome || c.jogadores[id]?.nome || id;
    const lista = Object.entries(c.jogadores).filter(([, j]) => j.online).map(([id, j]) => `<span class="${j.enviou ? 'ok' : ''}">${j.enviou ? '✅' : '⌛'} ${esc(id === meu ? 'você' : nomeHeroi(id))}</span>`).join('');
    if (!box) box = h('<div class="aguardando-grupo" data-aguardando></div>');
    box.innerHTML = `<div class="ag-titulo">${ocupado ? 'Aguardando o grupo' : 'O grupo espera a sua ação'} <span class="ag-prazo" data-prazo></span></div>
      <div class="ag-lista">${lista}</div>
      ${ctx.papel === 'host' ? '<button class="btn pequeno" data-resolver title="O mestre narra agora com as ações que já chegaram">⚡ Resolver agora</button>' : ''}`;
    $('[data-resolver]', box)?.addEventListener('click', () => api.coop.resolver().catch((e) => toast(e.message, 'erro')));
    hist.appendChild(box); // sempre por último
    const tic = () => {
      const p = $('[data-prazo]', box);
      if (!p || !c.prazo) return;
      const seg = Math.max(0, Math.round((c.prazo - Date.now()) / 1000));
      p.textContent = `· ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
    };
    tic();
    clearInterval(relogio);
    relogio = setInterval(tic, 1000);
    historico.rolarFim();
  }

  /** Eventos da sala (host: do processo principal; convidado: da rede, repassados pelo processo principal). */
  async function eventoCoop(ev) {
    if (!vivo || !st) return;
    const meu = st.heroi || 'principal';
    if (ev.t === 'rodada') {
      ctx.coop = ev;
      // ações dos outros já aparecem (provisórias) enquanto a rodada não fecha
      for (const a of ev.acoes || []) {
        if (a.heroi === meu || $(`.provisoria[data-autor="${CSS.escape(a.heroi)}"]`, hist)) continue;
        const nome = st.grupo.find((g) => g.id === a.heroi)?.nome;
        const e = historico.msgEl({ papel: a.papel, texto: a.texto, autor: a.heroi, autorNome: nome });
        if (!e) continue;
        e.classList.add('provisoria');
        e.dataset.autor = a.heroi;
        hist.insertBefore(e, $('[data-pensando]', hist) || $('[data-aguardando]', hist) || null);
      }
      renderGrupo();
      mostrarAguardando();
    } else if (ev.t === 'pensando') {
      $('[data-aguardando]', hist)?.remove();
      if (!ocupado) prepararTurno();
      else if (!$('[data-pensando]', hist)) historico.mostrarPensando();
    } else if (ev.t === 'turno') {
      await aplicarResultado(ev.r);
    } else if (ev.t === 'erro') {
      $('[data-pensando]', hist)?.remove();
      $('[data-aguardando]', hist)?.remove();
      try { st = await api.campanhas.carregar(slug); } catch { /* sem conexão: fica o que tinha */ }
      if (!vivo) return;
      historico.renderCompleta();
      setOcupado(false);
      if (ev.cancelado) toast('Turno cancelado');
      else historico.mostrarErro(ev.erro);
    } else if (ev.t === 'estado') {
      // (re)conectou: o estado do host manda — inclusive se uma rodada terminou enquanto você estava fora
      if (ocupado && ev.state.mensagens.at(-1)?.papel !== 'mestre') return;
      st = ev.state;
      historico.renderCompleta();
      renderTudo();
      if (ocupado && st.mensagens.at(-1)?.papel === 'mestre') { setOcupado(false); renderAcoes(st.mensagens.at(-1).sugestoes); }
    } else if (ev.t === 'grupo') {
      st.grupo = ev.grupo;
      renderGrupo();
      arena.render();
    } else if (ev.t === 'combate') {
      st.combate = ev.combate;
      arena.render();
    } else if (ev.t === 'conexao') {
      toast(ev.ok ? '🤝 Reconectado ao host' : '🔌 Conexão com o host caiu — tentando reconectar…', ev.ok ? undefined : 'erro');
    } else if (ev.t === 'fim' && ctx.papel === 'convidado') {
      toast(ev.motivo || 'O host fechou a sala.', 'erro');
      irPara('inicio');
    }
  }

  /** Som e efeitos visuais de cada consequência, em sequência (sem virar cacofonia). */
  async function tocarConsequencias(r) {
    const esperar = (ms) => new Promise((res) => setTimeout(res, ms));
    const fila = [];
    const tipos = new Set(r.logs.map((l) => l.tipo));
    if (tipos.has('npc') && r.logs.some((l) => l.tipo === 'npc' && l.icone === '👹')) fila.push(() => efeito('inimigo'));
    const golpeados = r.turno.eventos.filter((e) => e.tipo === 'npc' && e.vida != null).map((e) => e.nome);
    const meuId = st.heroi || 'principal';
    const meu = (l) => !l.heroi || l.heroi === meuId; // efeitos de tela só para o que aconteceu com o SEU herói
    if (tipos.has('npc_dano')) fila.push(() => { audio.golpeInimigo(); golpeados.forEach((n) => arena.golpear(n)); $('[data-npc]', el).classList.add('atingido'); setTimeout(() => $('[data-npc]', el)?.classList.remove('atingido'), 600); });
    if (tipos.has('npc_derrotado')) fila.push(() => { audio.derrota(); $('[data-npc]', el).classList.add('atingido'); setTimeout(() => $('[data-npc]', el)?.classList.remove('atingido'), 600); });
    const danos = r.logs.filter((l) => l.tipo === 'dano' || l.tipo === 'morte');
    if (danos.length) fila.push(() => { if (danos.some(meu)) efeito('dano'); danos.forEach((l) => arena.golpear(null, l.heroi)); });
    if (r.logs.some((l) => l.tipo === 'cura' && meu(l))) fila.push(() => efeito('cura'));
    if (r.logs.some((l) => l.tipo === 'mana' && meu(l) && /^(\S+: )?\+/.test(l.texto))) fila.push(() => efeito('mana'));
    if (r.logs.some((l) => l.tipo === 'ouro' && meu(l) && /^(\S+: )?\+/.test(l.texto))) fila.push(() => efeito('moedas'));
    if (r.logs.some((l) => l.tipo === 'xp' && meu(l)) && !tipos.has('nivel')) fila.push(() => efeito('xp'));
    if (r.logs.some((l) => l.tipo === 'missao' && /^Nova|conclu/i.test(l.texto))) fila.push(() => efeito('missao'));
    const ganhos = r.turno.eventos.filter((e) => e.tipo === 'item_ganho');
    ganhos.forEach((e) => lateral.marcarNovo(e.nome));
    const especiais = ganhos.filter((e) => ['raro', 'epico', 'lendario', 'mitico'].includes(e.raridade || itemDoCatalogo(e.nome)?.raridade));
    const simples = ganhos.filter((e) => !especiais.includes(e));
    if (simples.length) fila.push(() => audio.item(simples[0].raridade || 'comum'));
    for (const f of fila) { if (!vivo) return; f(); await esperar(260); }
    for (const e of especiais) { if (!vivo) return; await mostrarItemObtido(e); }
    if (r.logs.some((l) => l.tipo === 'nivel' && meu(l))) setTimeout(() => vivo && efeito('nivel'), 300);
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
  $('[data-dado]', el).addEventListener('click', () => rolagens.testeLivre(null));
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
  $('[data-coop]', extra).addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (ctx.papel === 'convidado') {
      if (await confirmar('Sair da sala?', 'Seu herói fica salvo na campanha do host — dá para voltar depois com o mesmo código.', { ok: 'Sair da sala' })) irPara('inicio');
      return;
    }
    await abrirSalaHost(ctx);
    if (!vivo) return;
    btn.classList.toggle('on', ctx.papel === 'host');
    renderGrupo();
  });
  const desligarCoop = api.coop.onEvento((ev) => eventoCoop(ev).catch((err) => console.error('coop', err)));
  $('[data-pasta]', extra).addEventListener('click', () => api.campanhas.abrirPasta(slug));
  $('[data-cronica]', extra).addEventListener('click', () => api.campanhas.abrirPasta(slug, 'historia/cronica.md'));
  $('[data-cfg]', extra).addEventListener('click', async () => { if (await abrirConfig()) { renderBarra(); narracao.renderBotao(); narrador.configurar(S.cfg); } });
  $('[data-som]', extra).addEventListener('click', async () => {
    const som = !S.cfg?.som;
    S.cfg = await api.config.salvar({ som });
    ligarSom(som);
    renderBarra();
  });
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
    desligarCoop();
    clearInterval(relogio);
    if (ctx.papel === 'host') api.coop.parar().catch(() => {});
    if (ctx.papel === 'convidado') api.coop.sair().catch(() => {});
    document.removeEventListener('keydown', teclaGlobal);
    arena.destruir();
    api.campanhas.fechar().catch(() => {});
  };
}
