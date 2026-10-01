// Co-op na tela: abrir a sala (host) e entrar numa sala (convidado), com a escolha/criação do herói.
import { $, $$, esc, modal, toast, ATRIBUTOS } from './ui.js';
import { api, irPara } from './app.js';
import { urlRetratoHeroi } from './heroi.js';
import { RACAS, CLASSES, RETRATO_RACA } from './telas/criacao.js';
import { lsGet, lsSet } from './jogo/util.js';

const nomeSalvo = () => lsGet('cronicas:coop-nome', '');

/** Host: abre a sala da campanha aberta (ou mostra a que já está aberta). Devolve true se a sala está aberta. */
export async function abrirSalaHost(ctx) {
  let info = await api.coop.info().catch(() => null);
  const mm = modal(`<h2>🤝 Jogar em grupo</h2><div data-corpo></div>`, { classe: 'coop-modal' });
  const corpo = $('[data-corpo]', mm.el);

  function telaAbrir() {
    corpo.innerHTML = `
      <p class="suave">Até <b>3 jogadores</b>: você é o host (a campanha e o mestre ficam no seu PC) e mais 2 convidados na mesma rede (casa, LAN ou VPN tipo Radmin/ZeroTier).
      Cada um manda a ação do seu herói; quando todos mandarem, o mestre narra a rodada para o grupo.</p>
      <label class="rotulo">Seu nome (para os outros verem)</label>
      <input class="campo" data-nome maxlength="30" value="${esc(nomeSalvo() || ctx.st.personagem.jogador || '')}" placeholder="Ex.: Felipe">
      <div class="modal-acoes"><button class="btn fantasma" data-fechar>Cancelar</button><button class="btn primario" data-abrir>Abrir sala</button></div>`;
    $$('[data-fechar]', corpo).forEach((b) => b.addEventListener('click', () => mm.fechar(false)));
    $('[data-abrir]', corpo).addEventListener('click', async (e) => {
      const nome = $('[data-nome]', corpo).value.trim() || 'Host';
      lsSet('cronicas:coop-nome', nome);
      e.currentTarget.disabled = true;
      try {
        info = await api.coop.hospedar(ctx.slug, nome);
        ctx.papel = 'host';
        telaInfo();
      } catch (err) {
        toast(err.message, 'erro');
        e.currentTarget.disabled = false;
      }
    });
  }

  function telaInfo() {
    const jog = Object.entries(info.jogadores || ctx.coop?.jogadores || {});
    corpo.innerHTML = `
      <div class="coop-codigo"><span class="suave">Código da sala</span><b data-codigo>${esc(info.codigo)}</b></div>
      <label class="rotulo">Endereço para os convidados digitarem</label>
      <div class="coop-enderecos">${info.enderecos.map((e) => `<code>${esc(e)}</code>`).join('')}</div>
      <p class="suave pequeno">No Windows, na primeira vez aparece o aviso do Firewall: permita em <b>Redes privadas</b>, senão os convidados não conseguem entrar.</p>
      <label class="rotulo">Na mesa</label>
      <div class="coop-jogadores">${jog.map(([id, j]) => {
        const h = (ctx.st.grupo || []).find((g) => g.id === id);
        return `<div class="${j.online ? '' : 'off'}">${j.host ? '👑' : j.online ? '🟢' : '🔌'} <b>${esc(j.nome)}</b>${h ? ` — ${esc(h.nome)}` : ''}</div>`;
      }).join('') || '<div class="suave">Ninguém ainda.</div>'}</div>
      <div class="modal-acoes"><button class="btn perigo" data-parar>Fechar sala</button><button class="btn primario" data-fechar>Ok</button></div>`;
    $$('[data-fechar]', corpo).forEach((b) => b.addEventListener('click', () => mm.fechar(true)));
    $('[data-parar]', corpo).addEventListener('click', async () => {
      await api.coop.parar().catch(() => {});
      ctx.papel = 'solo';
      ctx.coop = null;
      ctx.renderGrupo();
      toast('Sala fechada — de volta ao modo solo');
      mm.fechar(false);
    });
  }

  if (info) telaInfo();
  else telaAbrir();
  return mm.promessa;
}

/** Convidado: entra na sala de alguém, escolhe (ou cria) o herói e vai para o jogo. */
export function entrarNaSala() {
  const mm = modal(`<h2>🤝 Entrar numa sala</h2><div data-corpo></div>`, { classe: 'coop-modal' });
  const corpo = $('[data-corpo]', mm.el);

  function telaConectar() {
    corpo.innerHTML = `
      <p class="suave">Peça ao host o <b>endereço</b> e o <b>código</b> que aparecem quando ele abre a sala (🤝 no jogo dele).</p>
      <label class="rotulo">Endereço do host</label>
      <input class="campo" data-end placeholder="192.168.0.10:47800" value="${esc(lsGet('cronicas:coop-end', ''))}">
      <label class="rotulo">Código da sala</label>
      <input class="campo" data-cod maxlength="6" placeholder="ABC123" style="text-transform:uppercase;letter-spacing:4px">
      <label class="rotulo">Seu nome</label>
      <input class="campo" data-nome maxlength="30" value="${esc(nomeSalvo())}" placeholder="Ex.: Ana">
      <div class="modal-acoes"><button class="btn fantasma" data-fechar>Cancelar</button><button class="btn primario" data-entrar>Entrar</button></div>`;
    $$('[data-fechar]', corpo).forEach((b) => b.addEventListener('click', () => mm.fechar(null)));
    $('[data-entrar]', corpo).addEventListener('click', async (e) => {
      const endereco = $('[data-end]', corpo).value.trim();
      const nome = $('[data-nome]', corpo).value.trim() || 'Convidado';
      lsSet('cronicas:coop-end', endereco);
      lsSet('cronicas:coop-nome', nome);
      e.currentTarget.disabled = true;
      try {
        const sala = await api.coop.conectar({ endereco, codigo: $('[data-cod]', corpo).value.trim(), nome });
        telaHeroi(sala, nome);
      } catch (err) {
        toast(err.message, 'erro');
        e.currentTarget.disabled = false;
      }
    });
    $('[data-end]', corpo).focus();
  }

  function telaHeroi(sala, nome) {
    const livres = sala.herois.filter((x) => !x.ocupado);
    corpo.innerHTML = `
      <p>Campanha <b>${esc(sala.campanha.nome)}</b> <span class="suave">· ${esc(sala.campanha.capitulo || '')}</span></p>
      ${sala.herois.length ? `<label class="rotulo">Assumir um herói do grupo</label>
      <div class="coop-herois">${sala.herois.map((x) => {
        const ret = urlRetratoHeroi(x, sala.slug);
        return `<button class="coop-heroi" data-heroi="${esc(x.id)}" ${x.ocupado ? 'disabled' : ''}>
          ${ret ? `<img src="${ret}" alt="">` : `<span class="av">${esc(x.icone || '⚔️')}</span>`}
          <span><b>${esc(x.nome)}</b><small>${esc(x.raca || '')} ${esc(x.classe || '')} · Nv ${x.nivel || 1}${x.ocupado ? ' · em uso' : x.jogador ? ` · ${esc(x.jogador)}` : ''}</small></span></button>`;
      }).join('')}</div>` : ''}
      <label class="rotulo">${livres.length ? 'Ou crie um herói novo' : 'Crie o seu herói'}</label>
      <div class="coop-novo">
        <input class="campo" data-h="nome" maxlength="40" placeholder="Nome do herói">
        <div class="linha-flex" style="gap:8px">
          <select class="campo" data-h="raca">${Object.keys(RACAS).map((r) => `<option>${r}</option>`).join('')}</select>
          <select class="campo" data-h="classe">${Object.entries(CLASSES).map(([n, c]) => `<option value="${n}">${c.ic} ${n} — ${c.d}</option>`).join('')}</select>
        </div>
        <textarea class="campo" data-h="historia" rows="2" maxlength="800" placeholder="Uma linha sobre quem ele é (opcional)"></textarea>
      </div>
      <div class="modal-acoes"><button class="btn fantasma" data-fechar>Cancelar</button><button class="btn primario" data-criar>Criar e entrar</button></div>`;
    $$('[data-fechar]', corpo).forEach((b) => b.addEventListener('click', () => { api.coop.sair().catch(() => {}); mm.fechar(null); }));
    const entrar = async (fn) => {
      try {
        const r = await fn();
        mm.fechar(r);
        irPara('jogo', { slug: r.slug, papel: 'convidado' });
      } catch (err) {
        toast(err.message, 'erro');
      }
    };
    $$('[data-heroi]', corpo).forEach((b) => b.addEventListener('click', () => entrar(() => api.coop.escolherHeroi(b.dataset.heroi))));
    $('[data-criar]', corpo).addEventListener('click', () => {
      const v = (k) => $(`[data-h="${k}"]`, corpo).value.trim();
      if (!v('nome')) return toast('Dê um nome ao herói', 'erro');
      const raca = v('raca');
      const classe = v('classe');
      const c = CLASSES[classe];
      const atributos = {};
      for (const a of ATRIBUTOS) atributos[a] = c.base[a] + (RACAS[raca][a] || 0);
      const retrato = RETRATO_RACA[raca] || (classe === 'Mago' && raca !== 'Elfo' ? 'mago-anciao' : c.retrato);
      entrar(() => api.coop.criarHeroi({ nome: v('nome'), raca, classe, icone: c.ic, retrato, historia: v('historia'), atributos,
        vidaBase: c.vida, manaBase: c.mana, ouro: c.ouro, itensIniciais: c.itens, jogador: nome }));
    });
  }

  telaConectar();
  return mm.promessa;
}
