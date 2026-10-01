// Mapa-múndi interativo: rotas (terra/mar), locais, onde o grupo está, lugares visitados e viagem pela rota mais curta.
// Coordenadas no espaço da imagem 4k do JSON (viewBox), então o desenho acompanha qualquer tamanho de tela.
import { $, $$, esc, modal } from '../ui.js';
import { api } from '../app.js';
import { urlCena } from '../arte.js';
import { audio } from '../cenario.js';

let dados = null;
const carregar = async () => (dados ||= await api.mapa.ler());

/** @param {import('./contexto.js').CtxJogo} ctx */
export async function abrirMapaMundi(ctx) {
  const m = await carregar();
  const { width: W, height: H } = m.image;
  const c = ctx.st.campanha;
  const aqui = c.mapaLocal || null;
  const visitados = new Set(c.mapaVisitados || (aqui ? [aqui] : []));
  const caminho = (pts) => `M${pts.map(([x, y]) => `${x} ${y}`).join(' L')}`;
  const porId = new Map(m.locations.map((l) => [l.id, l]));

  const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="mapa-svg">
    <g class="rotas">${m.routes.map((r) => `<path class="rota ${r.mode === 'sea' ? 'mar' : 'terra'}" data-rota="${esc(r.id)}" d="${caminho(r.points)}"><title>${esc(r.name)} — ${r.mode === 'sea' ? 'mar' : 'terra'}, ${r.dias} dia(s)</title></path>`).join('')}</g>
    <path class="trajeto" data-trajeto d=""/>
    <g class="locais">${m.locations.map((l) => `
      <g class="local t-${esc(l.type)} ${l.id === aqui ? 'aqui' : ''} ${visitados.has(l.id) ? 'visitado' : ''}" data-local="${esc(l.id)}" transform="translate(${l.x} ${l.y})">
        ${l.id === aqui ? '<circle class="pulso" r="34"/>' : ''}
        <circle class="ponto" r="${l.type === 'city' ? 22 : 17}"/>
        <text class="nome" ${l.x + 30 + l.name.length * 26 > W ? 'x="0" y="80" text-anchor="middle"' : 'x="30" y="12"'}>${esc(l.name)}</text>
      </g>`).join('')}</g>
  </svg>`;

  const mm = modal(`
    <h2>🗺️ Mapa do mundo</h2>
    <div class="mapa-mundi">
      <img src="${urlCena('mapa-mundi')}" alt="" draggable="false">
      ${svg}
    </div>
    <div class="mapa-rodape">
      <div class="mapa-info" data-mapa-info>${aqui ? `📍 Vocês estão em <b>${esc(porId.get(aqui)?.name || aqui)}</b>. Clique num lugar para ver o caminho.` : 'Clique num lugar para ver o caminho. (O mestre marca no mapa onde vocês estão quando a história chega a um destes lugares.)'}</div>
      <div class="mapa-legenda"><span class="lg terra"></span>terra <span class="lg mar"></span>mar <span class="lg visitado"></span>visitado</div>
      <button class="btn" data-fechar>Fechar</button>
    </div>`, { classe: 'largo mapa-modal' });

  const info = $('[data-mapa-info]', mm.el);
  const trajeto = $('[data-trajeto]', mm.el);
  $$('[data-local]', mm.el).forEach((g) => g.addEventListener('click', async () => {
    audio.clique();
    const l = porId.get(g.dataset.local);
    $$('.local.sel', mm.el).forEach((x) => x.classList.remove('sel'));
    g.classList.add('sel');
    $$('.rota.no-trajeto', mm.el).forEach((x) => x.classList.remove('no-trajeto'));
    trajeto.setAttribute('d', '');
    if (l.id === aqui) {
      info.innerHTML = `📍 <b>${esc(l.name)}</b> (${esc(l.tipo)}) — vocês estão aqui.`;
      return;
    }
    let r = null;
    if (aqui) r = await api.mapa.rota(aqui, l.id).catch(() => null);
    if (r?.trechos?.length) {
      // desenha o trajeto inteiro (na ordem certa de cada trecho) e acende as rotas usadas
      const pts = [];
      for (const t of r.trechos) {
        const rota = m.routes.find((x) => x.id === t.rota);
        $(`[data-rota="${t.rota}"]`, mm.el)?.classList.add('no-trajeto');
        const p = rota.from === t.de ? rota.points : [...rota.points].reverse();
        pts.push(...(pts.length ? p.slice(1) : p));
      }
      trajeto.setAttribute('d', caminho(pts));
    }
    const podeIr = !ctx.ocupado;
    info.innerHTML = `
      <div><b>${esc(l.name)}</b> <span class="suave">(${esc(l.tipo)})</span>${visitados.has(l.id) ? ' · <span class="suave">já visitado</span>' : ''}</div>
      ${r?.texto ? `<div class="suave">${esc(r.texto)}</div>` : aqui ? '<div class="suave">Não há rota conhecida até lá.</div>' : ''}
      ${podeIr ? `<button class="btn primario pequeno" data-ir>🧭 Viajar ${r?.dias ? `(~${r.dias} dia${r.dias === 1 ? '' : 's'})` : ''}</button>` : '<div class="suave">Espere o mestre terminar para viajar.</div>'}`;
    $('[data-ir]', info)?.addEventListener('click', () => {
      mm.fechar();
      ctx.enviar(r?.texto ? `Viajo até ${l.name}. Caminho: ${r.texto}.` : `Viajo até ${l.name}.`);
    });
  }));
  // abre já mostrando onde estão
  if (aqui) $(`[data-local="${aqui}"]`, mm.el)?.scrollIntoView?.({ block: 'center' });
  return mm.promessa;
}
