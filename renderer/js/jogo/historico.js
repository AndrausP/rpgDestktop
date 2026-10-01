// Histórico da conversa: mensagens do jogador/sistema/mestre, roteiro com retratos, digitação e erros de turno.
import { $, $$, esc, md, h } from '../ui.js';
import { S, api } from '../app.js';
import { audio } from '../cenario.js';
import { urlRetrato, retratoNpc, emojiNpc } from '../arte.js';
import { EMOCOES } from '../vozes.js';
import { urlRetratoHeroi } from '../heroi.js';
import { abrirConfig } from '../telas/config.js';

/** @param {import('./contexto.js').CtxJogo} ctx */
export function criarHistorico(ctx) {
  const { slug, hist } = ctx;
  // ─────────────────────────── história ───────────────────────────
  function rolarFim(forcar = false) {
    const perto = hist.scrollHeight - hist.scrollTop - hist.clientHeight < 180;
    if (forcar || perto) hist.scrollTop = hist.scrollHeight;
  }

  function msgEl(m, { primeira = false } = {}) {
    if (m.papel === 'jogador') {
      // co-op: a ação de outro herói aparece do outro lado, com o nome dele
      const outro = m.autor && m.autor !== (ctx.st.heroi || 'principal');
      return h(`<div class="msg jogador ${outro ? 'outro' : ''}"><div class="bolha"><div class="quem">${esc(m.autorNome || ctx.st.personagem.nome)}</div>${esc(m.texto)}</div></div>`);
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
    $('.ouvir-msg', e).addEventListener('click', (ev) => { ev.stopPropagation(); ctx.narrarMsg(m, e); });
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
      if (r.quem === 'heroi' || r.quem.startsWith('heroi:')) {
        const nome = r.quem.slice(6);
        const p = (nome && (ctx.st.grupo || []).find((x) => x.nome === nome)) || ctx.st.personagem;
        const ret = urlRetratoHeroi(p, slug);
        return `<div class="seg fala-npc fala-heroi emo-${esc(r.emocao || 'neutro')}" data-seg="${i}">
        <div class="fala-av">${ret ? `<img src="${ret}" alt="">` : `<span>${esc(p.icone || '⚔️')}</span>`}</div>
        <div class="fala-corpo"><div class="fala-quem">${esc(p.nome)}</div><div class="fala-txt">${inline(r.texto)}</div></div></div>`;
      }
      const npc = ctx.st.npcs.find((n) => n.nome === r.quem) || { nome: r.quem };
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
    for (const m of ctx.st.mensagens) {
      const e = msgEl(m, { primeira: primeira && m.papel === 'mestre' });
      if (m.papel === 'mestre') primeira = false;
      if (e) hist.appendChild(e);
    }
    const ultima = ctx.st.mensagens.at(-1);
    if (ultima?.papel === 'mestre') {
      if (ultima.rolagem) ctx.mostrarCardRolagem(ultima.rolagem);
      ctx.renderAcoes(ultima.sugestoes);
    } else ctx.renderAcoes([]);
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
    $('[data-repetir]', e).addEventListener('click', () => { e.remove(); ctx.turno(() => api.jogo.repetir(slug)); });
    $('[data-desfazer]', e).addEventListener('click', async () => { e.remove(); ctx.st = await api.jogo.desfazerUltima(slug); renderHistoriaCompleta(); });
    $('[data-cfg2]', e).addEventListener('click', async () => { if (await abrirConfig()) ctx.renderBarra(); });
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

  return { rolarFim, msgEl, htmlMestre, logsEl, renderCompleta: renderHistoriaCompleta, mostrarPensando, mostrarErro, digitar };
}
