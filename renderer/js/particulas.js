// Motor de partículas em canvas. Ao trocar de tema, as partículas antigas desbotam
// e as novas surgem aos poucos — a transição acontece "dentro" da cena.

const rnd = (a, b) => a + Math.random() * (b - a);

const COMPORTAMENTO = {
  brasas(p, W, H, cfg) {
    p.x = rnd(0, W); p.y = rnd(H * 0.3, H + 20);
    p.vx = rnd(-0.3, 0.3); p.vy = -rnd(0.3, cfg.rapido ? 2.2 : 0.9);
    p.r = rnd(0.8, 2.6); p.vida = rnd(200, 520); p.osc = rnd(0, 6.28); p.brilho = true;
  },
  faiscas(p, W, H) {
    p.x = rnd(0, W); p.y = rnd(H * 0.5, H + 20);
    p.vx = rnd(-1.5, 1.5); p.vy = -rnd(1.5, 4.5);
    p.r = rnd(0.6, 2); p.vida = rnd(80, 220); p.brilho = true; p.rastro = true;
  },
  vagalumes(p, W, H) {
    p.x = rnd(0, W); p.y = rnd(0, H);
    p.vx = rnd(-0.3, 0.3); p.vy = rnd(-0.3, 0.3);
    p.r = rnd(1.2, 2.8); p.vida = rnd(400, 900); p.osc = rnd(0, 6.28); p.pisca = rnd(0.02, 0.06); p.brilho = true; p.vaga = true;
  },
  poeira(p, W, H) {
    p.x = rnd(0, W); p.y = rnd(-20, H);
    p.vx = rnd(-0.08, 0.15); p.vy = rnd(0.03, 0.2);
    p.r = rnd(0.4, 1.6); p.vida = rnd(500, 1200); p.alfaMax = rnd(0.15, 0.45);
  },
  luzes(p, W, H) {
    p.x = rnd(0, W); p.y = rnd(0, H);
    p.vx = rnd(-0.1, 0.1); p.vy = -rnd(0.05, 0.3);
    p.r = rnd(1, 3.5); p.vida = rnd(400, 900); p.osc = rnd(0, 6.28); p.pisca = 0.015; p.brilho = true; p.alfaMax = 0.5;
  },
  nevoa(p, W, H) {
    p.x = rnd(-200, W); p.y = rnd(H * 0.2, H);
    p.vx = rnd(0.1, 0.4); p.vy = rnd(-0.05, 0.05);
    p.r = rnd(90, 220); p.vida = rnd(700, 1400); p.alfaMax = rnd(0.04, 0.1); p.nuvem = true;
  },
  areia(p, W, H) {
    p.x = rnd(-50, W); p.y = rnd(0, H);
    p.vx = rnd(2.5, 6); p.vy = rnd(-0.2, 0.6);
    p.r = rnd(0.5, 1.4); p.vida = rnd(150, 400); p.alfaMax = rnd(0.25, 0.6); p.rastro = true;
  },
  neve(p, W, H) {
    p.x = rnd(0, W); p.y = rnd(-40, H);
    p.vx = rnd(-0.4, 0.4); p.vy = rnd(0.4, 1.6);
    p.r = rnd(0.8, 3); p.vida = rnd(600, 1400); p.osc = rnd(0, 6.28); p.alfaMax = rnd(0.5, 0.95);
  },
  chuva(p, W, H) {
    p.x = rnd(-100, W); p.y = rnd(-100, H);
    p.vx = 1.8; p.vy = rnd(9, 15);
    p.r = rnd(0.6, 1.2); p.vida = rnd(80, 200); p.alfaMax = rnd(0.2, 0.45); p.gota = true;
  },
  runas(p, W, H) {
    p.x = rnd(0, W); p.y = rnd(H * 0.2, H + 20);
    p.vx = rnd(-0.2, 0.2); p.vy = -rnd(0.2, 0.7);
    p.r = rnd(6, 13); p.vida = rnd(300, 700); p.osc = rnd(0, 6.28); p.pisca = 0.04; p.brilho = true;
    p.glifo = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ✧✦'[Math.floor(Math.random() * 26)];
    if (Math.random() < 0.6) { p.glifo = null; p.r = rnd(0.8, 2.2); }
  },
  luz(p, W, H) {
    p.x = rnd(0, W); p.y = rnd(0, H + 20);
    p.vx = rnd(-0.1, 0.1); p.vy = -rnd(0.1, 0.5);
    p.r = rnd(1, 3.2); p.vida = rnd(400, 900); p.osc = rnd(0, 6.28); p.pisca = 0.03; p.brilho = true; p.cruz = Math.random() < 0.25;
  },
  estrelas(p, W, H) {
    p.x = rnd(0, W); p.y = rnd(0, H * 0.85);
    p.vx = 0; p.vy = 0;
    p.r = rnd(0.4, 1.8); p.vida = rnd(900, 2400); p.osc = rnd(0, 6.28); p.pisca = rnd(0.01, 0.05);
    if (Math.random() < 0.004) { p.cadente = true; p.vx = rnd(6, 10); p.vy = rnd(2, 4); p.vida = 70; p.rastro = true; p.r = 1.6; }
  },
};

export class Particulas {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.lista = [];
    this.cfg = null;
    this.ativo = true;
    this.intensidade = 1;
    this.redimensionar();
    window.addEventListener('resize', () => this.redimensionar());
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  redimensionar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.cv.width = this.W * dpr;
    this.cv.height = this.H * dpr;
    this.cv.style.width = this.W + 'px';
    this.cv.style.height = this.H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  definir(cfg) {
    // partículas antigas morrem suavemente
    for (const p of this.lista) p.morrendo = true;
    this.cfg = cfg;
  }

  /** Explosão pontual (dano, nível, crítico). */
  rajada(cor, qtd = 60, x = this.W / 2, y = this.H / 2) {
    for (let i = 0; i < qtd; i++) {
      const ang = rnd(0, Math.PI * 2);
      const vel = rnd(2, 9);
      this.lista.push({ x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, r: rnd(1, 3.2), vida: rnd(40, 90), idade: 0, alfa: 1, alfaMax: 1, cor, brilho: true, atrito: 0.94, rajada: true });
    }
  }

  novo() {
    const p = { idade: 0, alfa: 0, alfaMax: 0.9, cor: this.cfg.cor };
    (COMPORTAMENTO[this.cfg.tipo] || COMPORTAMENTO.poeira)(p, this.W, this.H, this.cfg);
    return p;
  }

  loop() {
    requestAnimationFrame(this.loop);
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);
    if (!this.ativo || !this.cfg) return;

    const alvo = Math.round(this.cfg.qtd * this.intensidade * Math.min(1.4, (W * H) / (1440 * 900)));
    const vivos = this.lista.filter((p) => !p.morrendo && !p.rajada).length;
    for (let i = 0; i < Math.min(3, alvo - vivos); i++) this.lista.push(this.novo());

    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.lista) {
      p.idade++;
      if (p.vaga) { p.vx += rnd(-0.03, 0.03); p.vy += rnd(-0.03, 0.03); p.vx *= 0.98; p.vy *= 0.98; }
      if (p.osc !== undefined && !p.vaga) p.x += Math.sin(p.idade * 0.02 + p.osc) * 0.3;
      if (p.atrito) { p.vx *= p.atrito; p.vy *= p.atrito; }
      p.x += p.vx; p.y += p.vy;

      // alfa: nasce, vive, morre
      const fimNatural = p.idade > p.vida;
      if (p.morrendo || fimNatural) p.alfa -= p.rajada ? 0.03 : 0.012;
      else p.alfa = Math.min(p.alfaMax, p.alfa + 0.015);
      let a = Math.max(0, p.alfa);
      if (p.pisca) a *= 0.55 + 0.45 * Math.sin(p.idade * p.pisca + (p.osc || 0));
      if (a <= 0.003) continue;

      const [r, g, b] = p.cor;
      if (p.nuvem) {
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        gr.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gr;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        continue;
      }
      if (p.gota || p.rastro) {
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
        ctx.lineWidth = p.r;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * (p.gota ? 1.6 : 3), p.y - p.vy * (p.gota ? 1.6 : 3));
        ctx.stroke();
        continue;
      }
      if (p.glifo) {
        ctx.font = `${p.r * 1.6}px serif`;
        ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.8})`;
        ctx.fillText(p.glifo, p.x, p.y);
        continue;
      }
      if (p.brilho) {
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        gr.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        gr.addColorStop(0.3, `rgba(${r},${g},${b},${a * 0.35})`);
        gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gr;
        ctx.fillRect(p.x - p.r * 4, p.y - p.r * 4, p.r * 8, p.r * 8);
      }
      if (p.cruz) {
        ctx.strokeStyle = `rgba(${r},${g},${b},${a * 0.6})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(p.x - p.r * 5, p.y); ctx.lineTo(p.x + p.r * 5, p.y);
        ctx.moveTo(p.x, p.y - p.r * 5); ctx.lineTo(p.x, p.y + p.r * 5);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, a * 1.2)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    this.lista = this.lista.filter(
      (p) => p.alfa > 0 || (p.idade < 5 && !p.morrendo)
    ).filter((p) => p.x > -300 && p.x < W + 300 && p.y > -300 && p.y < H + 300);
  }
}
