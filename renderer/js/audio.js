// ═══════════════════════════════════════════════════════════════════════
//  Motor de som do Crônicas — 100% procedural (Web Audio), sem arquivos.
//
//  master ─ compressor ─ saída
//    ├─ música    (melodia generativa por tema: alaúde, flauta, sinos, coro, metais, tambores)
//    ├─ ambiente  (texturas contínuas: fogo, vento, ondas, multidão + eventos: pássaros, gotas, corujas…)
//    ├─ efeitos   (dados, golpes, cura, moedas, fanfarras de item/nível)
//    └─ reverb    (sala gerada por convolução; cada canal manda um pouco pra cá)
// ═══════════════════════════════════════════════════════════════════════

const ESCALAS = {
  maior: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10], dorico: [0, 2, 3, 5, 7, 9, 10],
  frigio: [0, 1, 3, 5, 7, 8, 10], lidio: [0, 2, 4, 6, 7, 9, 11], harmonica: [0, 2, 3, 5, 7, 8, 11],
  penta: [0, 2, 4, 7, 9], pentaMenor: [0, 3, 5, 7, 10],
};

// Receita sonora de cada tema.
const PRESETS = {
  taverna: { raiz: 57, escala: 'dorico', bpm: 104, voz: 'alaude', baixo: 'alaude', ritmo: 'danca', densidade: 0.75, texturas: ['fogo', 'murmurio'], eventos: [['caneca', 5000], ['risada', 11000]] },
  floresta: { raiz: 62, escala: 'penta', bpm: 72, voz: 'flauta', pad: 'suave', densidade: 0.45, texturas: ['folhas'], eventos: [['passaro', 2600], ['passaro2', 7000]] },
  masmorra: { raiz: 45, escala: 'frigio', bpm: 52, voz: 'sinoGrave', pad: 'escuro', densidade: 0.3, texturas: ['caverna'], eventos: [['gota', 1800], ['corrente', 13000]] },
  cidade: { raiz: 60, escala: 'maior', bpm: 96, voz: 'alaude', baixo: 'alaude', ritmo: 'marcha', densidade: 0.6, texturas: ['multidao'], eventos: [['sinoIgreja', 22000], ['caneca', 9000]] },
  batalha: { raiz: 50, escala: 'harmonica', bpm: 138, voz: 'metal', pad: 'tenso', tambores: 'guerra', densidade: 0.55, texturas: ['tensao'], eventos: [['aco', 3500]] },
  horror: { raiz: 46, escala: 'frigio', bpm: 44, voz: 'caixinha', pad: 'dissonante', densidade: 0.28, texturas: ['vazio'], eventos: [['batimento', 6000], ['sussurro', 9000], ['rangido', 14000]] },
  deserto: { raiz: 52, escala: 'harmonica', bpm: 76, voz: 'alaude', pad: 'escuro', tambores: 'mao', densidade: 0.5, texturas: ['ventoForte'], eventos: [] },
  neve: { raiz: 64, escala: 'menor', bpm: 58, voz: 'sino', pad: 'suave', densidade: 0.35, texturas: ['ventoFrio'], eventos: [['gelo', 7000]] },
  mar: { raiz: 55, escala: 'dorico', bpm: 80, voz: 'flauta', baixo: 'alaude', ritmo: 'balanco', densidade: 0.5, texturas: ['ondas'], eventos: [['gaivota', 6500], ['rangido', 9000]] },
  arcano: { raiz: 62, escala: 'lidio', bpm: 64, voz: 'sino', pad: 'brilho', densidade: 0.5, texturas: ['zumbido'], eventos: [['cintilar', 3200]] },
  celestial: { raiz: 60, escala: 'maior', bpm: 56, voz: 'sino', pad: 'coro', densidade: 0.4, texturas: ['ar'], eventos: [['sinoIgreja', 16000], ['cintilar', 5000]] },
  inferno: { raiz: 40, escala: 'frigio', bpm: 92, voz: 'metal', pad: 'escuro', tambores: 'guerra', densidade: 0.4, texturas: ['rugido'], eventos: [['estalos', 2500]] },
  noite: { raiz: 57, escala: 'pentaMenor', bpm: 60, voz: 'alaude', pad: 'suave', densidade: 0.35, texturas: ['brisa'], eventos: [['grilos', 2200], ['coruja', 12000]] },
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Faixas gravadas por tema (renderer/assets/audio). Temas sem faixa usam a música gerada. */
const TRILHAS = {
  taverna: ['assets/audio/taverna-1.mp3', 'assets/audio/taverna-2.mp3'],
  mar: ['assets/audio/mar-1.mp3'],
  cidade: ['assets/audio/cidade-1.mp3'],
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.ligado = false;
    this.musicaLigada = true;
    this.vol = { master: 0.6, musica: 0.5, ambiente: 0.6, efeitos: 0.8, voz: 0.95 };
    this.abafado = false;
    this.temaId = null;
    this.camada = null;
    this.timers = [];
    this.cachePluck = new Map();
    this.ultimaPena = 0;
  }

  // ───────────── infraestrutura ─────────────
  garantir() {
    if (!this.ctx) {
      const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -16;
      this.comp.ratio.value = 3;
      this.master = ctx.createGain();
      this.master.gain.value = this.vol.master;
      this.saidaFinal = ctx.createGain();
      this.saidaFinal.gain.value = 1.6; // ganho de compensação pós-compressor
      this.master.connect(this.comp).connect(this.saidaFinal).connect(ctx.destination);
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.criarSala(2.8, 2.4);
      this.reverbVol = ctx.createGain();
      this.reverbVol.gain.value = 0.9;
      // a resposta ao impulso é ruído branco: sem corte, todo agudo que entra vira uma cauda de chiado
      this.reverbEntrada = ctx.createBiquadFilter();
      this.reverbEntrada.type = 'lowpass';
      this.reverbEntrada.frequency.value = 4200;
      this.reverbEntrada.connect(this.reverb);
      this.reverb.connect(this.reverbVol).connect(this.master);
      this.bus = {};
      for (const k of ['musica', 'ambiente', 'efeitos', 'voz']) {
        const g = ctx.createGain();
        g.gain.value = this.vol[k];
        g.connect(this.master);
        this.bus[k] = g;
      }
      this.ruidoBranco = this.criarRuido('branco');
      this.ruidoMarrom = this.criarRuido('marrom');
      this.ruidoRosa = this.criarRuido('rosa');
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  criarRuido(tipo) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let ult = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (tipo === 'marrom') { ult = (ult + 0.02 * w) / 1.02; d[i] = ult * 3.5; }
      else if (tipo === 'rosa') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else d[i] = w;
    }
    return buf;
  }

  /** Resposta ao impulso sintética: ruído estéreo com decaimento exponencial. */
  criarSala(seg, decai) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seg);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decai);
    }
    return buf;
  }

  /** Saída com volume, pan e envio de reverb. */
  saida(bus, { vol = 1, pan = 0, rev = 0.2 } = {}) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = vol;
    let ult = g;
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      ult = p;
    }
    ult.connect(this.bus[bus]);
    if (rev > 0) {
      const r = ctx.createGain();
      r.gain.value = rev;
      ult.connect(r).connect(this.reverbEntrada);
    }
    return g;
  }

  /**
   * Fonte de ruído em loop. `quando` = instante (ctx.currentTime) em que começa a soar: notas agendadas no futuro
   * TÊM que passar o instante, senão o ruído toca desde já pelo ganho ainda em 1 (era o chiado antes de cada tambor).
   */
  ruido(tipo = 'branco', inicio = 0, quando = null) {
    const src = this.ctx.createBufferSource();
    src.buffer = tipo === 'marrom' ? this.ruidoMarrom : tipo === 'rosa' ? this.ruidoRosa : this.ruidoBranco;
    src.loop = true;
    src.loopStart = 0;
    src.playbackRate.value = 1;
    src.start(Math.max(this.ctx.currentTime, quando ?? 0), inicio || Math.random() * 3);
    return src;
  }

  // ───────────── controles ─────────────
  setVolumes(v = {}) {
    Object.assign(this.vol, Object.fromEntries(Object.entries(v).filter(([, x]) => Number.isFinite(x))));
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.08);
    for (const k of ['musica', 'ambiente', 'efeitos', 'voz']) {
      let v = k === 'musica' && !this.musicaLigada ? 0 : this.vol[k];
      if (this.abafado && (k === 'musica' || k === 'ambiente')) v *= 0.3; // "ducking" enquanto alguém fala
      this.bus[k].gain.setTargetAtTime(v, t, this.abafado ? 0.25 : 0.6);
    }
  }
  /** Abaixa música e ambiente enquanto o mestre/NPC fala. */
  abafar(on) {
    if (this.abafado === on) return;
    this.abafado = on;
    this.setVolumes({});
  }

  /** Toca um WAV (ArrayBuffer) no canal de voz, independente do som ambiente estar ligado. */
  async tocarVoz(arrayBuffer, { eco = 0 } = {}) {
    const ctx = this.garantir();
    this.setVolumes({});
    const buf = await ctx.decodeAudioData(arrayBuffer);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 1;
    src.connect(g).connect(this.bus.voz);
    if (eco > 0) {
      const r = ctx.createGain();
      r.gain.value = eco;
      g.connect(r).connect(this.reverbEntrada);
    }
    let fim;
    const promessa = new Promise((res) => (fim = res));
    src.onended = () => fim();
    src.start();
    return { promessa, duracao: buf.duration, parar: () => { try { src.stop(); } catch { /* já parou */ } fim(); } };
  }
  setVolume(v) { this.setVolumes({ master: v }); }
  setMusica(on) {
    this.musicaLigada = on;
    this.setVolumes({});
  }

  setLigado(on, temaId) {
    this.ligado = on;
    if (on) {
      this.garantir();
      this.setVolumes({});
      if (temaId || this.temaId) this.tema(temaId || this.temaId, true);
    } else this.parar();
  }

  parar() {
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];
    if (this.camada && this.ctx) {
      const { subs, nos } = this.camada;
      const t = this.ctx.currentTime;
      subs.forEach((g) => { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.6); });
      setTimeout(() => {
        nos.forEach((n) => { try { n.stop(); } catch { /* já parou */ } });
        subs.forEach((g) => { try { g.disconnect(); } catch { /* ok */ } });
      }, 4000);
    }
    this.camada = null;
  }

  /** Troca a trilha e o ambiente para o tema (crossfade). */
  tema(id, forcar = false) {
    if (typeof id !== 'string' || !PRESETS[id]) id = 'taverna';
    if (id === this.temaId && this.camada && !forcar) return;
    this.temaId = id;
    if (!this.ligado) return;
    this.garantir();
    this.parar();
    const ctx = this.ctx;
    const p = PRESETS[id];
    const sub = {};
    for (const k of ['musica', 'ambiente']) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
      g.connect(this.bus[k]);
      const r = ctx.createGain();
      r.gain.value = k === 'musica' ? 0.35 : 0.22;
      g.connect(r).connect(this.reverbEntrada);
      sub[k] = g;
    }
    const nos = [];
    this.camada = { subs: [sub.musica, sub.ambiente], nos, p };

    for (const tx of p.texturas || []) this.textura(tx, sub.ambiente, nos);
    for (const [ev, cada] of p.eventos || []) {
      const disparar = () => this.ligado && this.camada?.p === p && this.evento(ev, sub.ambiente);
      this.timers.push(setInterval(() => Math.random() < 0.6 && disparar(), cada * rnd(0.7, 1.3)));
      this.timers.push(setTimeout(disparar, rnd(800, cada)));
    }
    if (TRILHAS[id]?.length) this.tocarTrilha(TRILHAS[id], sub.musica, nos);
    else this.iniciarMusica(p, sub.musica);
  }

  /** Trilha gravada (mp3) no lugar da música gerada: toca as faixas do tema em sequência, em loop. */
  tocarTrilha(faixas, destino, nos) {
    const ctx = this.ctx;
    let i = Math.floor(Math.random() * faixas.length);
    let atual = null;
    let parado = false;
    const tocar = () => {
      if (parado) return;
      const el = new window.Audio(faixas[i % faixas.length]);
      i++;
      el.crossOrigin = 'anonymous';
      const src = ctx.createMediaElementSource(el);
      const g = ctx.createGain();
      g.gain.value = 0.9; // as faixas vêm masterizadas: um pouco abaixo para caber com o ambiente
      src.connect(g).connect(destino);
      el.addEventListener('ended', () => { try { src.disconnect(); } catch { /* ok */ } tocar(); });
      el.addEventListener('error', () => { parado = true; }); // arquivo ausente: fica só o ambiente
      el.play().catch(() => {});
      atual = el;
    };
    tocar();
    nos.push({ stop: () => { parado = true; if (atual) { const a = atual; setTimeout(() => a.pause(), 3500); } } });
  }

  // ───────────── ambiente: texturas contínuas ─────────────
  textura(tipo, destino, nos) {
    const ctx = this.ctx;
    const lfo = (freq, prof, alvo, base = 0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      g.gain.value = prof;
      o.connect(g).connect(alvo);
      if (base) alvo.value = base;
      o.start();
      nos.push(o);
      return o;
    };
    const ruidoFiltrado = (cor, tipoF, freq, q, vol) => {
      const src = this.ruido(cor);
      const f = ctx.createBiquadFilter();
      f.type = tipoF;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(f).connect(g).connect(destino);
      nos.push(src);
      return { src, f, g };
    };
    const zumbido = (freqs, forma, vol, corte = 800) => {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = corte;
      const g = ctx.createGain();
      g.gain.value = vol;
      f.connect(g).connect(destino);
      freqs.forEach((fr, i) => {
        [-5, 5].forEach((dt) => {
          const o = ctx.createOscillator();
          o.type = forma;
          o.frequency.value = fr;
          o.detune.value = dt + i;
          o.connect(f);
          o.start();
          nos.push(o);
        });
      });
      return { f, g };
    };

    switch (tipo) {
      case 'fogo': {
        const { g } = ruidoFiltrado('marrom', 'lowpass', 500, 0.7, 0.35);
        lfo(0.3, 0.08, g.gain, 0.35);
        this.timers.push(setInterval(() => Math.random() < 0.55 && this.estalo(destino, rnd(0.04, 0.14), rnd(2000, 5000)), 140));
        break;
      }
      case 'murmurio':
      case 'multidao': {
        const vol = tipo === 'multidao' ? 0.22 : 0.12;
        for (let i = 0; i < 3; i++) {
          const { f, g } = ruidoFiltrado('rosa', 'bandpass', rnd(350, 900), 3, vol);
          lfo(rnd(0.6, 1.8), rnd(150, 300), f.frequency, rnd(400, 800));
          lfo(rnd(0.2, 0.5), vol * 0.6, g.gain, vol);
        }
        break;
      }
      case 'folhas': {
        const { f, g } = ruidoFiltrado('rosa', 'bandpass', 2600, 0.8, 0.05);
        lfo(0.09, 0.035, g.gain, 0.05);
        lfo(0.05, 900, f.frequency, 2600);
        break;
      }
      case 'caverna': {
        zumbido([55, 82.4], 'sine', 0.09, 300);
        ruidoFiltrado('marrom', 'lowpass', 180, 1, 0.3);
        break;
      }
      case 'tensao': {
        const { g } = zumbido([mtof(38), mtof(45), mtof(50)], 'sawtooth', 0.035, 900);
        lfo(7, 0.02, g.gain, 0.035);
        ruidoFiltrado('marrom', 'lowpass', 120, 1, 0.3);
        break;
      }
      case 'vazio': {
        const { f } = zumbido([46.2, 49, 65.4], 'sine', 0.1, 400);
        lfo(0.04, 250, f.frequency, 400);
        const { g } = ruidoFiltrado('rosa', 'bandpass', 700, 6, 0.04);
        lfo(0.13, 0.03, g.gain, 0.04);
        break;
      }
      case 'ventoForte':
      case 'ventoFrio':
      case 'brisa': {
        const vol = tipo === 'ventoForte' ? 0.4 : tipo === 'ventoFrio' ? 0.3 : 0.1;
        const base = tipo === 'ventoFrio' ? 1100 : 700;
        const { f, g } = ruidoFiltrado('rosa', 'bandpass', base, 1.8, vol);
        lfo(0.07, base * 0.6, f.frequency, base);
        lfo(0.11, vol * 0.7, g.gain, vol);
        if (tipo !== 'brisa') {
          const { f: f2 } = ruidoFiltrado('rosa', 'bandpass', base * 2.2, 8, vol * 0.2); // assobio
          lfo(0.05, base * 0.8, f2.frequency, base * 2.2);
        }
        break;
      }
      case 'ondas': {
        for (let i = 0; i < 2; i++) {
          const { g, f } = ruidoFiltrado('marrom', 'lowpass', 900, 0.5, 0.0);
          lfo(0.085 + i * 0.03, 0.45, g.gain, 0.45);
          lfo(0.085 + i * 0.03, 500, f.frequency, 900);
        }
        break;
      }
      case 'zumbido': {
        const { g } = zumbido([mtof(62), mtof(69), mtof(74)], 'sine', 0.035, 3000);
        lfo(0.2, 0.02, g.gain, 0.035);
        break;
      }
      case 'ar': {
        const { g } = ruidoFiltrado('rosa', 'highpass', 4000, 0.5, 0.03);
        lfo(0.1, 0.02, g.gain, 0.03);
        break;
      }
      case 'rugido': {
        const { g } = ruidoFiltrado('marrom', 'lowpass', 260, 0.9, 0.7);
        lfo(0.25, 0.25, g.gain, 0.7);
        zumbido([41.2, 43.6], 'sawtooth', 0.04, 160);
        break;
      }
    }
  }

  // ───────────── ambiente: eventos pontuais ─────────────
  evento(tipo, destino) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = rnd(-0.8, 0.8);
    const out = (vol, rev = 0.3) => {
      const g = ctx.createGain();
      g.gain.value = vol;
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(destino);
      const r = ctx.createGain();
      r.gain.value = rev;
      p.connect(r).connect(this.reverbEntrada);
      return g;
    };
    switch (tipo) {
      case 'passaro':
      case 'passaro2': {
        const base = tipo === 'passaro' ? rnd(2400, 3600) : rnd(1500, 2200);
        const n = tipo === 'passaro' ? Math.floor(rnd(2, 5)) : 2;
        for (let i = 0; i < n; i++) {
          const t0 = t + i * rnd(0.09, 0.16);
          const o = ctx.createOscillator();
          const m = ctx.createOscillator();
          const mg = ctx.createGain();
          m.frequency.value = rnd(30, 60);
          mg.gain.value = base * 0.08;
          m.connect(mg).connect(o.frequency);
          o.frequency.setValueAtTime(base, t0);
          o.frequency.exponentialRampToValueAtTime(base * rnd(1.15, 1.5), t0 + 0.06);
          o.frequency.exponentialRampToValueAtTime(base * 0.9, t0 + 0.11);
          const g = out(0);
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.05, t0 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
          o.connect(g);
          o.start(t0); m.start(t0);
          o.stop(t0 + 0.14); m.stop(t0 + 0.14);
        }
        break;
      }
      case 'grilos': {
        for (let i = 0; i < 3; i++) {
          const t0 = t + i * 0.18;
          const o = ctx.createOscillator();
          o.frequency.value = 4400;
          const am = ctx.createOscillator();
          am.frequency.value = 55;
          const amg = ctx.createGain();
          amg.gain.value = 0.5;
          const g = out(0, 0.15);
          am.connect(amg).connect(g.gain);
          g.gain.setValueAtTime(0.012, t0);
          g.gain.setValueAtTime(0, t0 + 0.12);
          o.connect(g);
          o.start(t0); am.start(t0);
          o.stop(t0 + 0.13); am.stop(t0 + 0.13);
        }
        break;
      }
      case 'coruja': {
        [0, 0.45, 0.62].forEach((dt, i) => {
          const o = ctx.createOscillator();
          o.frequency.setValueAtTime(i === 0 ? 390 : 360, t + dt);
          o.frequency.linearRampToValueAtTime(i === 0 ? 350 : 330, t + dt + 0.3);
          const g = out(0, 0.5);
          g.gain.setValueAtTime(0, t + dt);
          g.gain.linearRampToValueAtTime(0.05, t + dt + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dt + (i === 0 ? 0.4 : 0.3));
          o.connect(g);
          o.start(t + dt);
          o.stop(t + dt + 0.45);
        });
        break;
      }
      case 'gota': {
        const f0 = rnd(900, 1800);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.05);
        const g = out(0, 0.9);
        g.gain.setValueAtTime(0.07, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.14);
        break;
      }
      case 'corrente':
      case 'aco': {
        const n = tipo === 'aco' ? 1 : 4;
        for (let i = 0; i < n; i++) this.metal(t + i * rnd(0.08, 0.2), out(tipo === 'aco' ? 0.2 : 0.08, 0.6), rnd(1800, 3200));
        break;
      }
      case 'sinoIgreja':
        this.sino(t, mtof(pick([48, 50, 52])), 4, out(0.14, 0.8));
        break;
      case 'caneca':
        this.sino(t, rnd(1800, 2600), 0.4, out(0.05, 0.3));
        this.sino(t + 0.05, rnd(2000, 2800), 0.3, out(0.04, 0.3));
        break;
      case 'risada': {
        const g = out(0.06, 0.4);
        for (let i = 0; i < 5; i++) {
          const t0 = t + i * 0.13;
          const src = this.ruido('rosa', 0, t0);
          const f = ctx.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.value = rnd(600, 900);
          f.Q.value = 5;
          const e = ctx.createGain();
          e.gain.setValueAtTime(0, t0);
          e.gain.linearRampToValueAtTime(1, t0 + 0.03);
          e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11);
          src.connect(f).connect(e).connect(g);
          src.stop(t0 + 0.13);
        }
        break;
      }
      case 'batimento':
        [0, 0.28].forEach((dt, i) => this.tambor(t + dt, 50, i ? 0.35 : 0.5, out(0.6, 0.3), 0.3, 0));
        break;
      case 'sussurro': {
        const src = this.ruido('rosa', 0, t);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 9;
        f.frequency.setValueAtTime(rnd(1200, 2000), t);
        f.frequency.linearRampToValueAtTime(rnd(2500, 3500), t + 1.2);
        const g = out(0, 0.9);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.4);
        g.gain.linearRampToValueAtTime(0, t + 1.4);
        src.connect(f).connect(g);
        src.stop(t + 1.5);
        break;
      }
      case 'rangido': {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(rnd(90, 140), t);
        o.frequency.linearRampToValueAtTime(rnd(60, 110), t + 0.8);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 900;
        f.Q.value = 7;
        const g = out(0, 0.5);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.2);
        g.gain.linearRampToValueAtTime(0, t + 0.9);
        o.connect(f).connect(g);
        o.start(t);
        o.stop(t + 1);
        break;
      }
      case 'gaivota': {
        [0, 0.35].forEach((dt) => {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.setValueAtTime(1300, t + dt);
          o.frequency.exponentialRampToValueAtTime(800, t + dt + 0.3);
          const g = out(0, 0.4);
          g.gain.setValueAtTime(0, t + dt);
          g.gain.linearRampToValueAtTime(0.04, t + dt + 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.32);
          o.connect(g);
          o.start(t + dt);
          o.stop(t + dt + 0.34);
        });
        break;
      }
      case 'gelo':
        for (let i = 0; i < 3; i++) this.estalo(out(1, 0.6), rnd(0.05, 0.12), rnd(5000, 8000), t + i * 0.04);
        break;
      case 'cintilar': {
        const p = this.camada?.p || PRESETS.arcano;
        const esc = ESCALAS[p.escala];
        for (let i = 0; i < 4; i++) this.sino(t + i * 0.08, mtof(p.raiz + 24 + esc[(i * 2) % esc.length]), 1.2, out(0.025, 0.8));
        break;
      }
      case 'estalos':
        for (let i = 0; i < 4; i++) this.estalo(out(1, 0.2), rnd(0.08, 0.2), rnd(1500, 4000), t + i * rnd(0.03, 0.09));
        break;
    }
  }

  // ───────────── instrumentos ─────────────
  /** Corda dedilhada (Karplus-Strong), pré-renderizada e em cache por nota. */
  pluckBuffer(midi, brilho = 0.5) {
    const chave = `${midi}:${brilho}`;
    if (this.cachePluck.has(chave)) return this.cachePluck.get(chave);
    const sr = this.ctx.sampleRate;
    const f = mtof(midi);
    const len = Math.floor(sr * 2.2);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const n = Math.max(2, Math.round(sr / f));
    const linha = new Float32Array(n);
    for (let i = 0; i < n; i++) linha[i] = (Math.random() * 2 - 1) * (1 - brilho * 0.5);
    let idx = 0;
    const dec = 0.996 - (midi > 72 ? 0.004 : 0);
    for (let i = 0; i < len; i++) {
      const prox = (idx + 1) % n;
      const v = (linha[idx] + linha[prox]) * 0.5 * dec;
      d[i] = linha[idx];
      linha[idx] = v;
      idx = prox;
    }
    this.cachePluck.set(chave, buf);
    return buf;
  }

  nota(voz, t, midi, dur, destino, vol = 1) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const g = ctx.createGain();
    g.connect(destino);
    switch (voz) {
      case 'alaude': {
        const src = ctx.createBufferSource();
        src.buffer = this.pluckBuffer(midi);
        const fl = ctx.createBiquadFilter();
        fl.type = 'lowpass';
        fl.frequency.value = 3200;
        g.gain.value = 0.32 * vol;
        src.connect(fl).connect(g);
        src.start(t);
        src.stop(t + 2.2);
        break;
      }
      case 'flauta': {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const vib = ctx.createOscillator();
        const vg = ctx.createGain();
        vib.frequency.value = 5;
        vg.gain.setValueAtTime(0, t);
        vg.gain.linearRampToValueAtTime(f * 0.008, t + dur * 0.6);
        vib.connect(vg).connect(o.frequency);
        const sopro = this.ruido('branco', 0, t);
        const sf = ctx.createBiquadFilter();
        sf.type = 'bandpass';
        sf.frequency.value = f * 2;
        sf.Q.value = 2;
        const sg = ctx.createGain();
        sg.gain.value = 0.05;
        sopro.connect(sf).connect(sg).connect(g);
        o.connect(g);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.17 * vol, t + 0.08);
        g.gain.setValueAtTime(0.15 * vol, t + dur * 0.8);
        g.gain.linearRampToValueAtTime(0, t + dur + 0.15);
        o.start(t); vib.start(t);
        o.stop(t + dur + 0.2); vib.stop(t + dur + 0.2); sopro.stop(t + dur + 0.2);
        break;
      }
      case 'sino':
      case 'sinoGrave':
        this.sino(t, voz === 'sinoGrave' ? f / 2 : f, voz === 'sinoGrave' ? 3.5 : 2.4, g);
        g.gain.value = 0.55 * vol;
        break;
      case 'caixinha': {
        [1, 3.01, 5.2].forEach((r, i) => {
          const o = ctx.createOscillator();
          o.frequency.value = f * 2 * r;
          o.detune.value = rnd(-12, 12);
          const e = ctx.createGain();
          e.gain.setValueAtTime(0.09 / (i + 1), t);
          e.gain.exponentialRampToValueAtTime(0.0001, t + 1.4 / (i + 1));
          o.connect(e).connect(g);
          o.start(t);
          o.stop(t + 1.5);
        });
        g.gain.value = vol;
        break;
      }
      case 'metal': {
        const fl = ctx.createBiquadFilter();
        fl.type = 'lowpass';
        fl.Q.value = 3;
        fl.frequency.setValueAtTime(300, t);
        fl.frequency.linearRampToValueAtTime(1800, t + 0.08);
        fl.frequency.exponentialRampToValueAtTime(700, t + dur);
        [0, 7].forEach((dt) => {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f;
          o.detune.value = dt;
          o.connect(fl);
          o.start(t);
          o.stop(t + dur + 0.2);
        });
        fl.connect(g);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.08 * vol, t + 0.05);
        g.gain.setValueAtTime(0.07 * vol, t + dur * 0.7);
        g.gain.linearRampToValueAtTime(0, t + dur + 0.15);
        break;
      }
    }
  }

  sino(t, f, dur, destino) {
    const ctx = this.ctx;
    [[1, 1], [2.76, 0.45], [5.4, 0.25], [8.93, 0.12]].forEach(([r, a]) => {
      if (f * r > 18000) return; // acima disso não se ouve (e o Web Audio reclama)
      const o = ctx.createOscillator();
      o.frequency.value = f * r;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(0.12 * a, t + 0.005);
      e.gain.exponentialRampToValueAtTime(0.0001, t + dur / (r * 0.6 + 0.4));
      o.connect(e).connect(destino);
      o.start(t);
      o.stop(t + dur + 0.1);
    });
  }

  tambor(t, f, vol, destino, dur = 0.35, ruido = 0.35) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const e = ctx.createGain();
    e.gain.setValueAtTime(vol, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e).connect(destino);
    o.start(t);
    o.stop(t + dur + 0.05);
    if (!ruido) return;
    const src = this.ruido('branco', 0, t);
    const f2 = ctx.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.value = 1200;
    const e2 = ctx.createGain();
    e2.gain.setValueAtTime(vol * ruido, t);
    e2.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(f2).connect(e2).connect(destino);
    src.stop(t + 0.1);
  }

  metal(t, destino, f = 2500) {
    const ctx = this.ctx;
    [1, 1.47, 2.09, 2.56].forEach((r, i) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f * r;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * r;
      bp.Q.value = 12;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.25 / (i + 1), t);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 / (i + 1));
      o.connect(bp).connect(e).connect(destino);
      o.start(t);
      o.stop(t + 0.55);
    });
  }

  estalo(destino, vol = 0.2, freq = 2500, t = null, dur = 0.03) {
    const ctx = this.ctx;
    t = t ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.ruidoBranco;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(destino);
    src.start(t, Math.random() * 3);
    src.stop(t + dur + 0.02);
  }

  // ───────────── música generativa ─────────────
  iniciarMusica(p, destino) {
    const ctx = this.ctx;
    const esc = ESCALAS[p.escala];
    const passo = 60 / p.bpm / 2; // colcheias
    let proximo = ctx.currentTime + 0.3;
    let tick = 0;
    let grau = 0;
    let frase = 0;
    const acordes = [0, 3, 4, 0, 5, 3, 4, 0]; // graus da harmonia
    let acorde = 0;

    const notaDoGrau = (g, oitava = 0) => {
      const n = esc.length;
      const o = Math.floor(g / n);
      const idx = ((g % n) + n) % n;
      return p.raiz + esc[idx] + 12 * (o + oitava);
    };

    const agendar = () => {
      if (!this.ligado || this.camada?.p !== p) return;
      while (proximo < ctx.currentTime + 0.4) {
        const t = proximo;
        const compasso = Math.floor(tick / 8);
        const pos = tick % 8;
        if (pos === 0) acorde = acordes[compasso % acordes.length];

        // pad / drone
        if (pos === 0 && p.pad && compasso % 2 === 0) this.pad(t, p, notaDoGrau(acorde, -1), passo * 16, destino);

        // baixo / ritmo
        if (p.baixo) {
          const padroes = { danca: [1, 0, 0, 1, 1, 0, 1, 0], marcha: [1, 0, 1, 0, 1, 0, 1, 1], balanco: [1, 0, 0, 0, 1, 0, 1, 0] };
          if ((padroes[p.ritmo] || padroes.danca)[pos]) this.nota(p.baixo, t, notaDoGrau(acorde + (pos % 4 === 0 ? 0 : 4), -1), passo * 2, destino, 0.7);
        }
        if (p.tambores) {
          const pad = p.tambores === 'guerra' ? [1, 0, 0, 1, 0, 0, 1, 0] : [1, 0, 1, 1, 0, 1, 0, 0];
          if (pad[pos]) this.tambor(t, p.tambores === 'guerra' ? 58 : 110, pos === 0 ? 0.55 : 0.32, destino, p.tambores === 'guerra' ? 0.45 : 0.2, 0.15);
          if (p.tambores === 'guerra' && pos === 4) this.estalo(destino, 0.1, 1800, t, 0.06);
        }

        // melodia: passeio aleatório na escala, com frases e respiros
        const emFrase = frase % 4 !== 3; // a cada 4 frases, uma pausa
        if (emFrase && Math.random() < p.densidade * (pos % 2 === 0 ? 1 : 0.5)) {
          const salto = pick([-2, -1, -1, 0, 1, 1, 2, 3]);
          grau = Math.max(-2, Math.min(9, grau + salto));
          if (pos === 0 && Math.random() < 0.5) grau = acorde + pick([0, 2, 4]); // âncora na harmonia
          const dur = passo * pick([1, 2, 2, 3, 4]);
          this.nota(p.voz, t, notaDoGrau(grau, 1), dur, destino, 0.9);
        }
        if (pos === 7) frase++;

        tick++;
        proximo += passo * (pos % 2 === 0 ? 1.03 : 0.97); // leve swing humano
      }
    };
    this.timers.push(setInterval(agendar, 100));
    agendar();
  }

  pad(t, p, raiz, dur, destino) {
    const ctx = this.ctx;
    const tipo = p.pad;
    const intervalos = tipo === 'dissonante' ? [0, 1, 6] : tipo === 'tenso' ? [0, 7, 13] : tipo === 'coro' ? [0, 4, 7, 12] : tipo === 'brilho' ? [0, 7, 11, 16] : [0, 7, 12];
    const g = ctx.createGain();
    const fl = ctx.createBiquadFilter();
    const coro = tipo === 'coro';
    fl.type = coro ? 'bandpass' : 'lowpass';
    fl.frequency.value = coro ? 900 : tipo === 'escuro' ? 500 : 1400;
    fl.Q.value = coro ? 1.2 : 0.5;
    fl.connect(g).connect(destino);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(coro ? 0.13 : tipo === 'dissonante' || tipo === 'tenso' ? 0.05 : 0.075, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, t + dur);
    intervalos.forEach((iv) => {
      [-7, 7].forEach((dt) => {
        const o = ctx.createOscillator();
        o.type = coro || tipo === 'tenso' ? 'sawtooth' : 'triangle';
        o.frequency.value = mtof(raiz + iv + (coro ? 12 : 0));
        o.detune.value = dt;
        o.connect(fl);
        o.start(t);
        o.stop(t + dur + 0.1);
      });
    });
  }

  // ───────────── efeitos de jogo ─────────────
  fx(vol = 1, pan = 0, rev = 0.25) {
    if (!this.ligado) return null;
    this.garantir();
    return this.saida('efeitos', { vol, pan, rev });
  }

  clique() {
    const o = this.fx(0.5, 0, 0.05);
    if (o) this.estalo(o, 0.25, 2500, null, 0.02);
  }

  /** Dado rolando na mesa de madeira: batidas cada vez mais próximas e um "toc" final. */
  dado() {
    const o = this.fx(1, rnd(-0.3, 0.3), 0.15);
    if (!o) return;
    const t = this.ctx.currentTime;
    let dt = 0;
    let intervalo = 0.11;
    for (let i = 0; i < 9; i++) {
      const tt = t + dt;
      this.estalo(o, 0.5 * (1 - i * 0.07), rnd(1200, 2600), tt, 0.035);
      this.tambor(tt, rnd(240, 320), 0.12 * (1 - i * 0.08), o, 0.06);
      dt += intervalo;
      intervalo *= 0.82;
    }
  }
  pousarDado() {
    const o = this.fx(1, 0, 0.2);
    if (!o) return;
    const t = this.ctx.currentTime;
    this.tambor(t, 200, 0.35, o, 0.12);
    this.estalo(o, 0.3, 1800, t, 0.05);
  }

  dano() {
    const o = this.fx(1, 0, 0.2);
    if (!o) return;
    const t = this.ctx.currentTime;
    this.tambor(t, 48, 0.9, o, 0.5);
    this.metal(t + 0.01, o, rnd(1400, 2000));
    const src = this.ruido('branco');
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(3000, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.25);
    const e = this.ctx.createGain();
    e.gain.setValueAtTime(0.4, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    src.connect(f).connect(e).connect(o);
    src.stop(t + 0.3);
  }
  golpeInimigo() {
    const o = this.fx(0.9, rnd(0.2, 0.6), 0.25);
    if (!o) return;
    const t = this.ctx.currentTime;
    this.woosh(o, t, 0.18);
    this.tambor(t + 0.12, 70, 0.7, o, 0.3);
    this.metal(t + 0.12, o, 2200);
  }

  woosh(destino, t, dur = 0.5, de = 400, ate = 3000) {
    const src = this.ruido('rosa', 0, t);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.5;
    f.frequency.setValueAtTime(de, t);
    f.frequency.exponentialRampToValueAtTime(ate, t + dur);
    const e = this.ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(0.6, t + dur * 0.6);
    e.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f).connect(e).connect(destino);
    src.stop(t + dur + 0.05);
  }

  cura() {
    const o = this.fx(0.8, 0, 0.7);
    if (!o) return;
    const t = this.ctx.currentTime;
    [72, 76, 79, 84, 88].forEach((m, i) => this.sino(t + i * 0.07, mtof(m), 1.6, o));
    this.woosh(o, t, 0.8, 800, 6000);
  }
  mana() {
    const o = this.fx(0.6, 0, 0.8);
    if (!o) return;
    const t = this.ctx.currentTime;
    [79, 83, 86, 91].forEach((m, i) => this.sino(t + i * 0.05, mtof(m), 1.2, o));
  }
  moedas(n = 4) {
    const o = this.fx(0.7, rnd(-0.2, 0.2), 0.25);
    if (!o) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < n; i++) {
      const tt = t + i * rnd(0.05, 0.1);
      this.sino(tt, rnd(3000, 4200), 0.35, o);
      this.estalo(o, 0.12, 5000, tt, 0.02);
    }
  }
  xp() {
    const o = this.fx(0.5, 0, 0.6);
    if (!o) return;
    const t = this.ctx.currentTime;
    this.sino(t, mtof(84), 1.2, o);
    this.sino(t + 0.09, mtof(91), 1.4, o);
  }
  item(raridade = 'comum') {
    const o = this.fx(0.8, 0, 0.5);
    if (!o) return;
    const t = this.ctx.currentTime;
    const seq = { comum: [76, 83], incomum: [76, 81, 88], raro: [74, 78, 81, 86], epico: [72, 76, 79, 83, 88], lendario: [67, 72, 76, 79, 84, 91], mitico: [60, 67, 72, 75, 79, 84, 87, 96] }[raridade] || [76, 83];
    seq.forEach((m, i) => this.sino(t + i * 0.08, mtof(m), 1.5 + i * 0.1, o));
    if (['epico', 'lendario', 'mitico'].includes(raridade)) this.fanfarra(raridade);
  }
  fanfarra(raridade = 'lendario') {
    const o = this.fx(0.9, 0, 0.6);
    if (!o) return;
    const t = this.ctx.currentTime + 0.1;
    const base = raridade === 'mitico' ? 55 : 60;
    const acordes = raridade === 'mitico' ? [[0, 3, 7], [1, 5, 8], [0, 4, 7, 12]] : [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7, 12]];
    acordes.forEach((ac, i) => ac.forEach((iv) => this.nota('metal', t + i * 0.22, base + iv, i === acordes.length - 1 ? 1.4 : 0.2, o, 1)));
    this.tambor(t, 60, 0.6, o, 0.6);
    this.tambor(t + 0.22 * (acordes.length - 1), 55, 0.8, o, 0.9);
    if (raridade === 'mitico') this.woosh(o, t, 1.2, 200, 8000);
  }
  nivel() {
    const o = this.fx(0.9, 0, 0.5);
    if (!o) return;
    this.fanfarra('lendario');
    const t = this.ctx.currentTime;
    [72, 76, 79, 84, 88, 91].forEach((m, i) => this.sino(t + 0.8 + i * 0.06, mtof(m), 2, o));
  }
  missao() {
    const o = this.fx(0.7, 0, 0.6);
    if (!o) return;
    const t = this.ctx.currentTime;
    [[62, 0.25], [67, 0.25], [71, 0.7]].forEach(([m, d], i) => this.nota('metal', t + i * 0.2, m, d, o, 0.8));
  }
  inimigo() {
    const o = this.fx(0.9, 0, 0.5);
    if (!o) return;
    const t = this.ctx.currentTime;
    [[38, 44], [37, 43]].forEach(([a, b], i) => { this.nota('metal', t + i * 0.3, a, 0.5, o, 1.2); this.nota('metal', t + i * 0.3, b, 0.5, o, 1); });
    this.tambor(t, 45, 0.9, o, 0.7);
    this.tambor(t + 0.3, 42, 0.9, o, 0.9);
  }
  derrota() {
    const o = this.fx(0.8, 0, 0.6);
    if (!o) return;
    const t = this.ctx.currentTime;
    this.tambor(t, 40, 1, o, 1.2);
    this.woosh(o, t, 0.9, 3000, 200);
  }
  critico() {
    const o = this.fx(0.9, 0, 0.6);
    if (!o) return;
    this.fanfarra('epico');
    const t = this.ctx.currentTime;
    [84, 88, 91, 96].forEach((m, i) => this.sino(t + i * 0.05, mtof(m), 1.6, o));
  }
  falhaCritica() {
    const o = this.fx(0.8, 0, 0.5);
    if (!o) return;
    const t = this.ctx.currentTime;
    [[50, 56], [49, 55], [47, 53]].forEach(([a, b], i) => { this.nota('metal', t + i * 0.25, a, 0.4, o); this.nota('metal', t + i * 0.25, b, 0.4, o); });
    this.tambor(t + 0.75, 40, 0.8, o, 0.8);
  }
  transicao() {
    const o = this.fx(0.6, 0, 0.8);
    if (!o) return;
    const t = this.ctx.currentTime;
    this.woosh(o, t, 1.1, 300, 5000);
    this.sino(t + 0.5, mtof(79), 2.4, o);
    this.sino(t + 0.62, mtof(86), 2.4, o);
  }
  enviar() {
    const o = this.fx(0.35, 0, 0.2);
    if (o) this.woosh(o, this.ctx.currentTime, 0.25, 600, 2500);
  }
  /** Pena riscando o pergaminho enquanto o mestre escreve (bem baixinho). */
  pena() {
    if (!this.ligado) return;
    const agora = performance.now();
    if (agora - this.ultimaPena < 55) return;
    this.ultimaPena = agora;
    const o = this.fx(0.12, rnd(-0.1, 0.1), 0.05);
    if (!o) return;
    const t = this.ctx.currentTime;
    const src = this.ruido('branco');
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = rnd(3500, 6000);
    f.Q.value = 3;
    const e = this.ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(0.5, t + 0.01);
    e.gain.exponentialRampToValueAtTime(0.001, t + rnd(0.03, 0.06));
    src.connect(f).connect(e).connect(o);
    src.stop(t + 0.08);
  }
}
