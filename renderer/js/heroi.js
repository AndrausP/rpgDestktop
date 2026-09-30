// O herói do jogador: imagem própria (upload), galeria de retratos, aparência e voz.
import { $, $$, esc, modal, toast } from './ui.js';
import { catalogo, urlRetrato, slugify } from './arte.js';
import { PRESETS_VOZ, narrador } from './vozes.js';
import { gravarVoz } from './gravador.js';

const MAX_LADO = 1024;

/** URL do retrato do herói: imagem enviada por você → retrato da galeria → arquivo com o nome dele. */
export function urlRetratoHeroi(p, slug) {
  if (p?.retratoCustom && slug) return `arte://campanha/${encodeURIComponent(slug)}/${p.retratoCustom.split('/').map(encodeURIComponent).join('/')}`;
  return urlRetrato(p?.retrato) || urlRetrato(slugify(p?.nome)) || null;
}

/** Abre o seletor de arquivo e devolve a imagem redimensionada como data URL (webp), ou null. */
export function escolherImagem() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/png,image/jpeg,image/webp';
    inp.addEventListener('change', async () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      try {
        resolve(await reduzirImagem(f));
      } catch (e) {
        toast(`Não consegui ler a imagem: ${e.message}`, 'erro');
        resolve(null);
      }
    });
    inp.click();
  });
}

/** Lê o arquivo e reduz para no máximo 1024 px (mantém transparência). */
export async function reduzirImagem(arquivo) {
  if (arquivo.size > 25 * 1024 * 1024) throw new Error('arquivo acima de 25 MB');
  const bmp = await createImageBitmap(arquivo);
  const k = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c.toDataURL('image/webp', 0.9);
}

/**
 * Galeria de retratos com "Enviar minha imagem" em primeiro lugar.
 * Resolve com {retrato: id} | {imagem: dataUrl} | null.
 */
export function escolherRetrato(atual, { atualUrl = null } = {}) {
  const lista = catalogo().retratos;
  const m = modal(`
    <h2>🖼️ Retrato do herói</h2>
    <div class="galeria-retratos">
      <button class="ret enviar" data-enviar title="Use uma imagem sua (PNG, JPG ou WEBP)">
        ${atualUrl ? `<img src="${atualUrl}" alt="">` : ''}
        <span class="ic-enviar">📤</span><span>Enviar minha imagem</span>
      </button>
      ${lista.map((r) => `<button class="ret ${r.id === atual ? 'sel' : ''}" data-id="${esc(r.id)}" title="${esc(r.desc || r.nome)}"><img src="${r.url}" alt="" loading="lazy"><span>${esc(r.nome)}</span></button>`).join('')}
    </div>
    <div class="ajuda">A imagem enviada fica só nesta campanha (pasta <b>artes/heroi/</b>). Retratos que você solta em <b>_artes/retratos/</b> aparecem aqui para todas.</div>
    <div class="modal-acoes"><button class="btn" data-abrir-artes>📁 Abrir pasta de artes</button><button class="btn fantasma" data-fechar>Cancelar</button></div>`, { classe: 'largo' });
  $$('.ret[data-id]', m.el).forEach((b) => b.addEventListener('click', () => m.fechar({ retrato: b.dataset.id })));
  $('[data-enviar]', m.el).addEventListener('click', async () => {
    const imagem = await escolherImagem();
    if (imagem) m.fechar({ imagem });
  });
  $('[data-abrir-artes]', m.el).addEventListener('click', () => window.rpg.catalogo.abrirPasta());
  return m.promessa;
}

/** Opções de voz para o herói. */
export function opcoesVoz(sel) {
  return Object.entries(PRESETS_VOZ).filter(([id]) => !/^narrador/.test(id))
    .map(([id, v]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(v.nome)}</option>`).join('');
}

/** Ouve uma frase com a voz escolhida (Chatterbox ou voz do sistema). */
export function ouvirVoz(preset, { nome = '', slug = null, idioma = 'pt', cfg } = {}) {
  narrador.configurar(cfg || {});
  const texto = idioma === 'en' ? `My name is ${nome || 'unknown'}. And this is my voice.` : `Meu nome é ${nome || 'ninguém'}. E esta é a minha voz.`;
  return narrador.falar([{ quem: 'heroi', texto, emocao: 'neutro' }], { vozHeroi: preset, slug, idioma });
}

/**
 * Editor do herói dentro do jogo: imagem, aparência e voz.
 * @returns {Promise<object|null>} estado novo da campanha (ou null se cancelou)
 */
export function editarHeroi(st, slug, cfg) {
  const p = st.personagem;
  const idioma = st.campanha.idioma || 'pt';
  let novaImagem = null;
  let novoRetrato = null;
  const m = modal(`
    <h2>🛡️ ${esc(p.nome)}</h2>
    <div class="editor-heroi">
      <button class="retrato-editor" data-trocar title="Trocar retrato">
        <img data-prev src="${urlRetratoHeroi(p, slug) || ''}" alt="">
        <span>🖼️ Trocar retrato</span>
      </button>
      <div class="campos-heroi">
        <div class="rotulo" style="margin-top:0"><span class="ic">🪞</span>Aparência <span class="dica">o mestre usa ao descrever você</span></div>
        <textarea class="campo" data-aparencia maxlength="1500" placeholder="Altura, cabelo, olhos, marcas, roupas, jeito de andar...">${esc(p.aparencia || '')}</textarea>
        <div class="rotulo"><span class="ic">🗣️</span>Voz do herói <span class="dica">lê as suas falas, se ligado em Configurações</span></div>
        <div class="linha-flex">
          <select class="campo" data-voz>${opcoesVoz(p.voz || 'homem-jovem')}</select>
          <button class="btn" data-ouvir title="Ouvir">▶</button>
          <button class="btn" data-gravar title="Gravar a sua voz para o herói">🎙️ Gravar</button>
        </div>
      </div>
    </div>
    <div class="modal-acoes"><button class="btn fantasma" data-fechar>Cancelar</button><button class="btn primario" data-salvar>Salvar</button></div>`, { classe: 'largo' });

  $('[data-trocar]', m.el).addEventListener('click', async () => {
    const r = await escolherRetrato(novoRetrato ?? p.retrato, { atualUrl: p.retratoCustom ? urlRetratoHeroi(p, slug) : null });
    if (!r) return;
    if (r.imagem) { novaImagem = r.imagem; novoRetrato = null; $('[data-prev]', m.el).src = r.imagem; }
    else { novoRetrato = r.retrato; novaImagem = null; $('[data-prev]', m.el).src = urlRetrato(r.retrato) || ''; }
  });
  $('[data-ouvir]', m.el).addEventListener('click', () => ouvirVoz($('[data-voz]', m.el).value, { nome: p.nome, slug, idioma, cfg }));
  $('[data-gravar]', m.el).addEventListener('click', async () => {
    const wav = await gravarVoz({ titulo: `Voz de ${p.nome}`, idioma });
    if (!wav) return;
    await window.rpg.voz.salvarRef('heroi', wav, slug);
    toast('🎙️ Voz do herói gravada. Ela vale só nesta campanha.');
  });
  $('[data-salvar]', m.el).addEventListener('click', async () => {
    try {
      const dados = { aparencia: $('[data-aparencia]', m.el).value.trim(), voz: $('[data-voz]', m.el).value };
      if (novaImagem) dados.imagem = novaImagem;
      else if (novoRetrato) dados.retrato = novoRetrato;
      m.fechar(await window.rpg.personagem.atualizar(slug, dados));
    } catch (e) {
      toast(e.message, 'erro');
    }
  });
  return m.promessa;
}
