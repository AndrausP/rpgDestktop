import { $, esc, h, toast, confirmar, tempoRelativo, FLAMULA } from '../ui.js';
import { S, api, irPara } from '../app.js';
import { TEMAS } from '../temas.js';
import { setTema, setCena } from '../cenario.js';
import { setBarra } from '../barra.js';
import { urlCena, urlRetrato, cenaDoTema, iconeHtml } from '../arte.js';
import { abrirConfig } from './config.js';
import { urlRetratoHeroi } from '../heroi.js';
import { entrarNaSala } from '../coop.js';

const NOME_PROV = { api: '🧠 Claude API', 'claude-code': '⌨️ Claude Code', demo: '🎭 Demonstração' };

export function telaInicio(raiz) {
  setTema('taverna');
  document.documentElement.classList.add('fundo-nitido');
  setCena(urlCena('mapa-mundi') || cenaDoTema('taverna'));

  const el = h(`
    <div class="tela-inicio">
      <div class="marca">
        <div class="logo">Crônicas</div>
        <div class="sub">histórias contadas por um Mestre que nunca dorme</div>
        <div class="ornamento">✦</div>
      </div>
      <div class="grade-campanhas" data-grade></div>
    </div>`);
  raiz.appendChild(el);

  const extra = h(`<div class="linha-flex" style="gap:10px">
    <div class="info-barra" data-prov title="Quem narra suas histórias"><span class="sol">🪶</span><div><div class="l1">Mestre</div><div class="l2" data-prov-nome></div></div></div>
    <button class="btn inicio-compendio" data-compendio title="Consultar fichas de itens e monstros">${iconeHtml('bestiario', 'mini')} <span>Compêndio</span></button>
    <button class="btn" data-coop title="Entrar na sala co-op de um amigo">🤝 Entrar numa sala</button>
    <button class="btn icone" data-artes title="Pasta das suas artes">🖼️</button>
    <button class="btn icone" data-pasta title="Pasta das campanhas">📁</button>
    <button class="btn icone" data-cfg title="Configurações">⚙️</button>
  </div>`);
  setBarra({ t1: 'Crônicas', t2: 'RPG com Mestre IA', extra });
  const atualizarProv = () => ($('[data-prov-nome]', extra).textContent = NOME_PROV[S.cfg?.provedor] || '—');
  atualizarProv();

  async function carregar() {
    const grade = $('[data-grade]', el);
    let lista = [];
    try {
      lista = await api.campanhas.listar();
    } catch (e) {
      toast(e.message, 'erro');
    }
    grade.innerHTML = '';
    const nova = h(`<button class="moldura card-nova">${FLAMULA}<div class="mais">✚</div><div class="t">Nova campanha</div><div class="suave">Forje um mundo e um herói</div></button>`);
    nova.addEventListener('click', () => irPara('criacao'));
    grade.appendChild(nova);

    lista.forEach((c, i) => {
      const t = TEMAS[c.tema] || TEMAS.taverna;
      const p = c.personagem || {};
      const pct = p.vidaMax ? Math.max(0, Math.min(100, (p.vida / p.vidaMax) * 100)) : 0;
      const arte = urlCena(c.cena) || cenaDoTema(c.tema);
      const ret = urlRetratoHeroi(p, c.slug);
      const card = h(`
        <div class="moldura card-campanha" style="animation-delay:${i * 60}ms; --cor-tema:${t.cores.acento}">
          <div class="arte" style="background-image:url('${arte}')"><span class="tema-card" title="${esc(t.nome)}">${t.icone}</span></div>
          <div class="info">
            <div class="av">${ret ? `<img src="${ret}" alt="">` : esc(p.icone || '⚔️')}</div>
            <div class="nome">${esc(c.nome)}</div>
            <div class="cap">${esc(c.capitulo || '')}${c.local ? ` · ${esc(c.local)}` : ''}${c.idioma === 'en' ? ' · EN' : ''}</div>
            <div class="heroi"><b>${esc(p.nome || '?')}</b> <span class="suave">· ${esc(p.raca || '')} ${esc(p.classe || '')} · Nv ${p.nivel || 1}</span></div>
            <div class="mini-vida"><i style="width:${pct}%"></i></div>
            <div class="rodape"><span>Dia ${c.dia || 1} · ${c.turno} turnos</span><span>${tempoRelativo(c.atualizadaEm)}</span></div>
          </div>
          <button class="btn icone pequeno fantasma excluir" title="Mover para a lixeira">🗑️</button>
        </div>`);
      card.addEventListener('mouseenter', () => { setTema(c.tema); setCena(arte); });
      card.addEventListener('click', () => irPara('jogo', { slug: c.slug }));
      $('.excluir', card).addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await confirmar('Excluir campanha?', `"${c.nome}" vai para a lixeira do sistema (dá para recuperar de lá).`, { ok: 'Mover para a lixeira', perigo: true })) {
          try {
            await api.campanhas.excluir(c.slug);
            toast('Campanha movida para a lixeira');
            carregar();
          } catch (err) {
            toast(err.message, 'erro');
          }
        }
      });
      grade.appendChild(card);
    });
  }
  $('[data-grade]', el).addEventListener('mouseleave', () => { setTema('taverna'); setCena(urlCena('mapa-mundi')); });

  $('[data-cfg]', extra).addEventListener('click', async () => {
    if (await abrirConfig()) { atualizarProv(); carregar(); }
  });
  $('[data-coop]', extra).addEventListener('click', () => entrarNaSala());
  $('[data-compendio]', extra).addEventListener('click', () => irPara('compendio'));
  $('[data-pasta]', extra).addEventListener('click', () => api.campanhas.abrirPasta(null));
  $('[data-artes]', extra).addEventListener('click', () => api.catalogo.abrirPasta());
  carregar();
  return () => document.documentElement.classList.remove('fundo-nitido');
}
