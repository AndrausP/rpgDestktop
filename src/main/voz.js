// Ponte com o serviço de voz em Python (voz/chatterbox/servico.py, Chatterbox da Resemble AI).
// Inicia o processo sob demanda, conversa por JSON-lines, resolve a voz de cada personagem
// (clipe de referência) e guarda os WAVs em cache (mesma fala + mesma voz = arquivo reaproveitado).
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const readline = require('readline');
const { PRESETS, parametros } = require('./voz-presets');
const instalador = require('./voz-instalador');
const { slugify } = require('./util');

const LIMITE_CACHE = 600; // arquivos .wav
const EXT_AUDIO = ['.wav', '.flac', '.mp3', '.ogg'];

class Voz {
  /**
   * @param {() => Promise<object>} getSettings
   * @param {{dirDados: string, dirApp: string, dirRecursos?: string, getRaiz: () => string, dirCampanha: (slug: string) => string, avisar: (evento: object) => void}} opts
   */
  constructor(getSettings, { dirDados, dirApp, dirRecursos, getRaiz, dirCampanha, avisar }) {
    this.getSettings = getSettings;
    this.dirDados = dirDados;
    this.dirCache = path.join(dirDados, 'cache');
    this.dirVozesBase = path.join(dirDados, 'vozes'); // referências geradas (sementes)
    this.dirVenv = path.join(dirDados, 'python');
    this.dirApp = dirApp;
    this.dirRecursos = dirRecursos;
    this.getRaiz = getRaiz;
    this.dirCampanha = dirCampanha;
    this.avisar = avisar || (() => {});
    this.proc = null;
    this.seq = 0;
    this.pendentes = new Map();
    this.estado = { status: 'parado', pct: 0, erro: null, texto: '' };
    this.iniciando = null;
    this.instalando = null;
    this.emAndamento = new Map(); // hash → promessa (evita sintetizar o mesmo trecho 2x)
    this.cfgCarregada = null; // dispositivo/inglês com que o serviço subiu
  }

  // ───────────────────────── onde está tudo ─────────────────────────

  script() {
    const c = [
      this.dirRecursos && path.join(this.dirRecursos, 'voz', 'chatterbox', 'servico.py'),
      path.join(this.dirApp, 'voz', 'chatterbox', 'servico.py'),
    ].filter(Boolean);
    return c.find((f) => fs.existsSync(f)) || null;
  }

  async python() {
    const cfg = await this.getSettings();
    if (cfg.vozPython && fs.existsSync(cfg.vozPython)) return cfg.vozPython;
    const venv = instalador.pythonDoVenv(this.dirVenv);
    return fs.existsSync(venv) ? venv : null;
  }

  async instalado() {
    return !!(this.script() && ((await this.python()) || process.env.CRONICAS_VOZ_FALSO === '1'));
  }

  setEstado(parcial) {
    Object.assign(this.estado, parcial);
    this.avisar({ tipo: 'estado', ...this.estado });
  }

  async info() {
    return { ...this.estado, instalado: await this.instalado(), python: await this.python(), dirVozes: this.pastaVozesUsuario() };
  }

  // ───────────────────────── instalação ─────────────────────────

  async instalar() {
    if (this.instalando) return this.instalando;
    this.parar();
    this.instalando = (async () => {
      this.setEstado({ status: 'instalando', pct: 0, erro: null, texto: 'Preparando a instalação…' });
      const cfg = await this.getSettings();
      try {
        const r = await instalador.instalar({
          dirVenv: this.dirVenv,
          pythonBase: cfg.vozPython && !cfg.vozPython.includes(this.dirVenv) ? cfg.vozPython : undefined,
          log: (linha) => this.avisar({ tipo: 'instalacao', linha }),
          etapa: ({ n, total, texto }) => this.setEstado({ status: 'instalando', pct: (n - 1) / total, texto }),
        });
        this.setEstado({ status: 'parado', pct: 1, texto: `Instalado (${r.detalhe}).` });
        return r;
      } catch (e) {
        this.setEstado({ status: 'erro', erro: e.message, texto: '' });
        throw e;
      }
    })();
    try {
      return await this.instalando;
    } finally {
      this.instalando = null;
    }
  }

  // ───────────────────────── processo ─────────────────────────

  async iniciar() {
    const cfg = await this.getSettings();
    const assinatura = `${cfg.vozDispositivo || 'auto'}|${cfg.vozIngles || 'turbo'}|${cfg.vozPython || ''}`;
    if (this.proc && this.cfgCarregada && this.cfgCarregada !== assinatura && !this.iniciando) this.parar();
    if (this.estado.status === 'pronto' && this.proc) return this.estado;
    if (this.iniciando) return this.iniciando;
    this.iniciando = (async () => {
      const script = this.script();
      const falso = process.env.CRONICAS_VOZ_FALSO === '1';
      const py = (await this.python()) || (falso ? (process.platform === 'win32' ? 'python' : 'python3') : null);
      if (!script || !py) {
        this.setEstado({ status: 'ausente', erro: 'A voz Chatterbox ainda não foi instalada. Vá em ⚙️ Configurações → Voz → Instalar.' });
        const e = new Error(this.estado.erro);
        e.ausente = true;
        throw e;
      }
      this.setEstado({ status: 'iniciando', erro: null, pct: 0, texto: 'Abrindo o serviço de voz…' });
      await fsp.mkdir(this.dirCache, { recursive: true });
      const args = ['-u', script, ...(falso ? ['--falso'] : [])];
      const proc = spawn(py, args, {
        cwd: this.dirDados,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', HF_HOME: path.join(this.dirDados, 'modelos') },
      });
      this.proc = proc;
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); if (process.env.CRONICAS_VOZ_DEBUG) process.stderr.write(d); });
      proc.on('error', (e) => this.falhou(e.code === 'ENOENT' ? `Não achei o Python em "${py}". Reinstale a voz em Configurações.` : e.message));
      proc.on('exit', (code) => {
        if (this.proc !== proc) return;
        const fim = stderr.trim().split(/\r?\n/).filter((l) => !/^\s*(File|\^|~)/.test(l)).slice(-2).join(' ');
        this.falhou(code ? `O serviço de voz parou (código ${code}). ${fim}` : 'O serviço de voz foi encerrado.');
      });
      proc.stdin.on('error', () => {});
      readline.createInterface({ input: proc.stdout }).on('line', (l) => this.receber(l));
      await fsp.mkdir(path.join(this.dirDados, 'modelos'), { recursive: true });
      const r = await this.enviar({
        cmd: 'iniciar',
        dados: this.dirDados,
        dispositivo: cfg.vozDispositivo || 'auto',
        ingles: cfg.vozIngles || 'turbo',
        idiomas: ['pt'],
      }, 60 * 60 * 1000);
      this.cfgCarregada = assinatura;
      this.dispositivo = r.dispositivo;
      await this.semear();
      this.setEstado({ status: 'pronto', pct: 1, texto: `Pronto (${r.dispositivo === 'cuda' ? 'GPU NVIDIA' : r.dispositivo === 'mps' ? 'GPU Apple' : r.dispositivo === 'falso' ? 'modo de teste' : 'CPU'}).`, dispositivo: r.dispositivo });
      return this.estado;
    })();
    try {
      return await this.iniciando;
    } finally {
      this.iniciando = null;
    }
  }

  /** Cria as vozes-base que ainda não existem (uma vez; ficam em <dados>/voz/vozes). */
  async semear() {
    const faltando = Object.keys(PRESETS).filter((k) => !fs.existsSync(path.join(this.dirVozesBase, `${k}.wav`)));
    if (!faltando.length) return;
    this.setEstado({ status: 'semeando', pct: 0, texto: 'Criando as vozes dos personagens (só na primeira vez)…' });
    const presets = Object.fromEntries(faltando.map((k) => [k, PRESETS[k]]));
    await this.enviar({ cmd: 'semear', pasta: this.dirVozesBase, presets }, 60 * 60 * 1000);
  }

  falhou(msg) {
    this.proc = null;
    this.cfgCarregada = null;
    for (const { rejeitar, timer } of this.pendentes.values()) { clearTimeout(timer); rejeitar(new Error(msg)); }
    this.pendentes.clear();
    this.setEstado({ status: 'erro', erro: msg });
  }

  receber(linha) {
    if (process.env.CRONICAS_VOZ_DEBUG) console.log('[voz<]', linha.slice(0, 200));
    let m;
    try { m = JSON.parse(linha); } catch { return; }
    if (m.evento === 'progresso') {
      const status = m.etapa === 'baixando' ? 'baixando' : m.etapa === 'semeando' ? 'semeando' : this.estado.status === 'pronto' ? 'pronto' : 'iniciando';
      return this.setEstado({ status, pct: m.pct ?? this.estado.pct, texto: m.texto || '' });
    }
    if (m.evento) return;
    const p = this.pendentes.get(m.id);
    if (!p) return;
    this.pendentes.delete(m.id);
    clearTimeout(p.timer);
    if (m.ok) p.resolver(m);
    else {
      const e = new Error(m.erro || 'erro no serviço de voz');
      e.cancelado = !!m.cancelado;
      p.rejeitar(e);
    }
  }

  enviar(msg, timeoutMs = 10 * 60 * 1000) {
    if (!this.proc) return Promise.reject(new Error('Serviço de voz parado.'));
    const id = ++this.seq;
    return new Promise((resolver, rejeitar) => {
      const timer = setTimeout(() => {
        this.pendentes.delete(id);
        rejeitar(new Error('O serviço de voz demorou demais.'));
      }, timeoutMs);
      this.pendentes.set(id, { resolver, rejeitar, timer });
      if (process.env.CRONICAS_VOZ_DEBUG) console.log('[voz>]', JSON.stringify({ id, ...msg }).slice(0, 200));
      this.proc.stdin.write(JSON.stringify({ id, ...msg }) + '\n', 'utf8');
    });
  }

  // ───────────────────────── vozes (referências) ─────────────────────────

  pastaVozesUsuario() {
    return path.join(this.getRaiz(), '_artes', 'vozes');
  }

  acharAudio(dir, nome) {
    for (const ext of EXT_AUDIO) {
      const f = path.join(dir, `${nome}${ext}`);
      if (fs.existsSync(f)) return f;
    }
    return null;
  }

  /**
   * Clipe de referência de um personagem, do mais específico ao mais geral:
   * <campanha>/artes/vozes/<npc>  →  _artes/vozes/<npc>  →  _artes/vozes/<preset>  →  voz-base gerada  →  voz embutida.
   */
  resolverRef({ slug, npc, preset }) {
    const id = npc ? slugify(npc) : null;
    const cands = [];
    if (id && slug) cands.push([path.join(this.dirCampanha(slug), 'artes', 'vozes'), id]);
    if (id) cands.push([this.pastaVozesUsuario(), id]);
    if (preset) cands.push([this.pastaVozesUsuario(), preset], [this.dirVozesBase, preset]);
    for (const [dir, nome] of cands) {
      const f = this.acharAudio(dir, nome);
      if (f) return f;
    }
    return null;
  }

  /** Lista dos presets com a origem da voz de cada um (sua gravação, gerada ou nenhuma ainda). */
  listarVozes() {
    return Object.entries(PRESETS).map(([id, p]) => {
      const sua = this.acharAudio(this.pastaVozesUsuario(), id);
      const gerada = fs.existsSync(path.join(this.dirVozesBase, `${id}.wav`));
      return { id, nome: p.nome, fonte: sua ? 'sua' : gerada ? 'gerada' : 'nenhuma', arquivo: sua || null };
    });
  }

  /** Grava a referência de um preset (ou de um NPC, numa campanha). dados = bytes do áudio. */
  async salvarReferencia({ id, slug, dados, ext = '.wav' }) {
    if (!id || !/^[a-z0-9-]+$/.test(id)) throw new Error('Nome de voz inválido.');
    ext = EXT_AUDIO.includes(ext) ? ext : '.wav';
    const dir = slug ? path.join(this.dirCampanha(slug), 'artes', 'vozes') : this.pastaVozesUsuario();
    await fsp.mkdir(dir, { recursive: true });
    for (const e of EXT_AUDIO) await fsp.unlink(path.join(dir, `${id}${e}`)).catch(() => {});
    const f = path.join(dir, `${id}${ext}`);
    await fsp.writeFile(f, Buffer.from(dados));
    return f;
  }

  async importarReferencia({ id, slug, origem }) {
    const ext = path.extname(origem).toLowerCase();
    if (!EXT_AUDIO.includes(ext)) throw new Error('Use um arquivo .wav, .flac, .mp3 ou .ogg.');
    return this.salvarReferencia({ id, slug, dados: await fsp.readFile(origem), ext });
  }

  async removerReferencia({ id, slug }) {
    const dir = slug ? path.join(this.dirCampanha(slug), 'artes', 'vozes') : this.pastaVozesUsuario();
    for (const e of EXT_AUDIO) await fsp.unlink(path.join(dir, `${id}${e}`)).catch(() => {});
  }

  // ───────────────────────── fala ─────────────────────────

  /**
   * Sintetiza (ou reaproveita do cache).
   * @param {{texto: string, preset: string, npc?: string, slug?: string, idioma?: 'pt'|'en', emocao?: string, velocidade?: number, lote?: string}} p
   */
  async falar({ texto, preset, npc, slug, idioma = 'pt', emocao = 'neutro', velocidade = 1, lote }) {
    texto = String(texto || '').trim();
    if (!texto) throw new Error('Texto vazio.');
    const cfg = await this.getSettings();
    const ref = this.resolverRef({ slug, npc, preset });
    const mtime = ref ? fs.statSync(ref).mtimeMs : 0;
    const params = parametros(preset, emocao, cfg.vozEmocao !== false);
    idioma = idioma === 'en' ? 'en' : 'pt';
    const motorEn = idioma === 'en' ? cfg.vozIngles || 'turbo' : '';
    const hash = crypto.createHash('sha1')
      .update(JSON.stringify(['cb1', texto, idioma, motorEn, ref, mtime, params, +velocidade.toFixed(2)]))
      .digest('hex').slice(0, 20);
    const arquivo = path.join(this.dirCache, `${hash}.wav`);
    if (fs.existsSync(arquivo)) return { arquivo: `${hash}.wav`, cache: true };
    if (this.emAndamento.has(hash)) return this.emAndamento.get(hash);
    const p = (async () => {
      await this.iniciar();
      const r = await this.enviar({ cmd: 'falar', texto, idioma, ref, ...params, velocidade, saida: arquivo, lote });
      this.limparCache().catch(() => {});
      return { arquivo: `${hash}.wav`, segundos: r.segundos };
    })();
    this.emAndamento.set(hash, p);
    try {
      return await p;
    } finally {
      this.emAndamento.delete(hash);
    }
  }

  /** Descarta as falas ainda na fila daquele lote (narração pulada, jogador saiu da tela). */
  cancelar(lote) {
    if (!this.proc || !lote) return;
    try { this.proc.stdin.write(JSON.stringify({ id: 0, cmd: 'cancelar', lote }) + '\n'); } catch { /* fechado */ }
  }

  async limparCache() {
    const arquivos = (await fsp.readdir(this.dirCache)).filter((f) => f.endsWith('.wav'));
    if (arquivos.length <= LIMITE_CACHE) return;
    const info = await Promise.all(arquivos.map(async (f) => ({ f, t: (await fsp.stat(path.join(this.dirCache, f))).mtimeMs })));
    info.sort((a, b) => a.t - b.t);
    for (const { f } of info.slice(0, info.length - LIMITE_CACHE)) await fsp.unlink(path.join(this.dirCache, f)).catch(() => {});
  }

  /** Caminho real de um arquivo de cache (usado pelo protocolo arte://voz/...). */
  arquivoCache(nome) {
    if (!/^[a-f0-9]{20}\.wav$/.test(nome)) return null;
    return path.join(this.dirCache, nome);
  }

  parar() {
    if (!this.proc) return;
    try { this.proc.stdin.write(JSON.stringify({ id: 0, cmd: 'sair' }) + '\n'); } catch { /* já fechou */ }
    const p = this.proc;
    this.proc = null;
    this.cfgCarregada = null;
    for (const { rejeitar, timer } of this.pendentes.values()) { clearTimeout(timer); rejeitar(Object.assign(new Error('cancelado'), { cancelado: true })); }
    this.pendentes.clear();
    setTimeout(() => { try { p.kill(); } catch { /* ok */ } }, 1500);
    this.setEstado({ status: 'parado', texto: '' });
  }
}

module.exports = { Voz };
