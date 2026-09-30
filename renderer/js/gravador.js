// Grava uma voz pelo microfone e devolve um WAV (PCM 16 bits, mono).
// Usado para dar a um personagem uma voz de verdade: o Chatterbox clona o timbre
// a partir de 10–20 segundos de fala limpa.
import { $, esc, modal, toast } from './ui.js';
import { audio } from './cenario.js';

const TEXTO_LEITURA = {
  pt: 'Era noite de tempestade quando cheguei à taverna. Sacudi a capa molhada, pedi vinho quente e me sentei perto do fogo. Então olhei para todos e comecei a contar a minha história — uma história de reinos perdidos, de amigos leais e de um preço alto demais.',
  en: 'It was a stormy night when I reached the tavern. I shook off my wet cloak, asked for hot wine and sat by the fire. Then I looked at everyone and began to tell my story — a tale of lost kingdoms, loyal friends and a price far too high.',
};

/** Float32 mono → WAV 16 bits. */
export function wavDe(amostras, taxa) {
  const n = amostras.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const txt = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true); v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, amostras[i])) * 0x7fff, true);
  return new Uint8Array(buf);
}

/** Tira o silêncio do começo e do fim e normaliza o pico. */
function aparar(x, taxa) {
  const jan = Math.floor(taxa * 0.02);
  let pico = 0;
  for (const s of x) pico = Math.max(pico, Math.abs(s));
  const lim = Math.max(0.01, pico * 0.06);
  const ativo = (i) => { let m = 0; for (let k = i; k < Math.min(x.length, i + jan); k++) m = Math.max(m, Math.abs(x[k])); return m > lim; };
  let a = 0; while (a < x.length && !ativo(a)) a += jan;
  let b = x.length - jan; while (b > a && !ativo(b)) b -= jan;
  a = Math.max(0, a - Math.floor(taxa * 0.15));
  b = Math.min(x.length, b + jan + Math.floor(taxa * 0.25));
  const y = x.slice(a, b);
  const g = pico > 0 ? 0.9 / pico : 1;
  for (let i = 0; i < y.length; i++) y[i] *= g;
  return y;
}

/**
 * Abre o gravador. Resolve com Uint8Array (WAV) ou null.
 * @param {{titulo?: string, idioma?: 'pt'|'en'}} o
 */
export function gravarVoz({ titulo = 'Gravar voz', idioma = 'pt' } = {}) {
  const MAX = 20;
  const MIN = 7;
  const m = modal(`
    <h2>🎙️ ${esc(titulo)}</h2>
    <p class="suave">Leia o texto abaixo com a voz do personagem, num lugar silencioso (10 a 20 segundos). O Chatterbox copia o timbre, o sotaque e o jeito de falar.</p>
    <blockquote class="texto-leitura">${esc(TEXTO_LEITURA[idioma] || TEXTO_LEITURA.pt)}</blockquote>
    <div class="gravador">
      <button class="btn primario grande" data-rec>● Gravar</button>
      <div class="medidor"><div data-nivel></div></div>
      <span class="tempo" data-tempo>0,0 s</span>
    </div>
    <div class="modal-acoes">
      <button class="btn" data-ouvir disabled>▶ Ouvir</button>
      <button class="btn fantasma" data-fechar>Cancelar</button>
      <button class="btn primario" data-salvar disabled>Usar esta voz</button>
    </div>`, { classe: 'medio', fecharFora: false });

  let stream = null, ctx = null, proc = null, fonte = null, gravando = false, pedacos = [], taxa = 48000, t0 = 0, raf = 0, wav = null, tocando = null;
  const btnRec = $('[data-rec]', m.el);
  const nivel = $('[data-nivel]', m.el);
  const tempo = $('[data-tempo]', m.el);

  const desligar = () => {
    cancelAnimationFrame(raf);
    try { proc?.disconnect(); fonte?.disconnect(); } catch { /* ok */ }
    stream?.getTracks().forEach((t) => t.stop());
    ctx?.close().catch(() => {});
    stream = ctx = proc = fonte = null;
  };

  async function comecar() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false, channelCount: 1 } });
    } catch (e) {
      toast(`Microfone indisponível: ${e.message}`, 'erro');
      return;
    }
    ctx = new AudioContext();
    taxa = ctx.sampleRate;
    fonte = ctx.createMediaStreamSource(stream);
    proc = ctx.createScriptProcessor(4096, 1, 1);
    pedacos = [];
    let ultimoNivel = 0;
    proc.onaudioprocess = (e) => {
      if (!gravando) return;
      const d = e.inputBuffer.getChannelData(0);
      pedacos.push(new Float32Array(d));
      let p = 0;
      for (let i = 0; i < d.length; i += 8) p = Math.max(p, Math.abs(d[i]));
      ultimoNivel = Math.max(p, ultimoNivel * 0.85);
    };
    fonte.connect(proc);
    proc.connect(ctx.destination);
    gravando = true;
    t0 = performance.now();
    btnRec.textContent = '■ Parar';
    btnRec.classList.add('gravando');
    const passo = () => {
      const s = (performance.now() - t0) / 1000;
      tempo.textContent = `${s.toFixed(1).replace('.', ',')} s`;
      nivel.style.width = `${Math.min(100, ultimoNivel * 140)}%`;
      nivel.classList.toggle('alto', ultimoNivel > 0.95);
      if (s >= MAX) return parar();
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
  }

  function parar() {
    gravando = false;
    const s = (performance.now() - t0) / 1000;
    desligar();
    btnRec.textContent = '● Gravar de novo';
    btnRec.classList.remove('gravando');
    nivel.style.width = '0%';
    const total = pedacos.reduce((n, p) => n + p.length, 0);
    const tudo = new Float32Array(total);
    let o = 0;
    for (const p of pedacos) { tudo.set(p, o); o += p.length; }
    const limpo = aparar(tudo, taxa);
    const dur = limpo.length / taxa;
    tempo.textContent = `${dur.toFixed(1).replace('.', ',')} s de fala`;
    if (dur < MIN) {
      wav = null;
      toast(`Grave pelo menos ${MIN} segundos de fala (foram ${dur.toFixed(1)} s).`, 'erro');
    } else wav = wavDe(limpo, taxa);
    $('[data-ouvir]', m.el).disabled = !wav;
    $('[data-salvar]', m.el).disabled = !wav;
  }

  btnRec.addEventListener('click', () => (gravando ? parar() : comecar()));
  $('[data-ouvir]', m.el).addEventListener('click', async () => {
    if (!wav) return;
    tocando?.parar();
    tocando = await audio.tocarVoz(wav.slice().buffer);
  });
  $('[data-salvar]', m.el).addEventListener('click', () => m.fechar(wav));
  return m.promessa.finally(() => { gravando = false; desligar(); tocando?.parar(); });
}
