// Ponte com o serviço de voz em C# (voz/CronicasVoz, KokoroSharp — Kokoro TTS 82M).
// Inicia o processo sob demanda, conversa por JSON-lines e guarda os WAVs em cache
// (mesma fala + mesma voz = arquivo reaproveitado, sem sintetizar de novo).
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const readline = require('readline');
const { PRESETS, parametros } = require('./voz-presets');
const instalador = require('./voz-instalador');

const LIMITE_CACHE = 600; // arquivos .wav

class Voz {
  /**
   * @param {() => Promise<object>} getSettings
   * @param {{dirDados: string, dirApp: string, dirRecursos?: string, avisar: (evento: object) => void}} opts
   */
  constructor(getSettings, { dirDados, dirApp, dirRecursos, avisar }) {
    this.getSettings = getSettings;
    this.dirDados = dirDados; // kokoro.onnx fica aqui
    this.dirCache = path.join(dirDados, 'cache');
    this.dirBin = path.join(dirDados, 'bin'); // serviço compilado pelo botão Instalar
    this.dirApp = dirApp;
    this.dirRecursos = dirRecursos;
    this.avisar = avisar || (() => {});
    this.proc = null;
    this.seq = 0;
    this.pendentes = new Map();
    this.estado = { status: 'parado', pct: 0, erro: null, texto: '' };
    this.iniciando = null;
    this.instalando = null;
    this.emAndamento = new Map(); // hash → promessa (evita sintetizar o mesmo trecho 2x)
  }

  // ───────────────────────── onde está tudo ─────────────────────────

  /** Comando do serviço: manual → compilado pelo Instalar → empacotado → voz/publish do projeto. */
  async localizar() {
    const cfg = await this.getSettings();
    if (cfg.vozComando) {
      const partes = cfg.vozComando.match(/"[^"]+"|\S+/g).map((p) => p.replace(/^"|"$/g, ''));
      return { cmd: partes[0], args: partes.slice(1) };
    }
    const dirs = [this.dirBin, this.dirRecursos && path.join(this.dirRecursos, 'voz', 'bin'), path.join(this.dirApp, 'voz', 'publish')].filter(Boolean);
    for (const d of dirs) {
      const exe = path.join(d, instalador.EXE);
      if (fs.existsSync(exe)) return { cmd: exe, args: [], proprio: true };
      const dll = path.join(d, 'CronicasVoz.dll');
      if (fs.existsSync(dll)) return { cmd: 'dotnet', args: [dll], proprio: true };
    }
    return null;
  }

  /**
   * O KokoroSharp procura a pasta "voices" no diretório atual do processo — a pasta de dados (onde fica o
   * kokoro.onnx), não a do executável — e o publish nem leva essa pasta. Sem ela, toda fala falha.
   * Acha as vozes (ao lado do serviço, no build do projeto ou no cache do NuGet) e copia para a pasta de dados.
   */
  async garantirVozes(onde) {
    const exe = onde.args[0] && /\.dll$/i.test(onde.args[0]) ? onde.args[0] : onde.cmd;
    const origem = instalador.acharVozes({ dirs: [path.dirname(exe), this.dirDados], proj: instalador.projeto(this.dirApp, this.dirRecursos) });
    if (!origem && !onde.proprio) return; // comando de voz próprio (vozComando): ele que se vira
    if (!origem) throw new Error('Pasta de vozes do Kokoro (voices) não encontrada. Clique em 📦 Instalar de novo em Configurações → Voz.');
    await instalador.copiarVozes(this.dirDados, origem);
  }

  async instalado() {
    return !!(await this.localizar());
  }

  setEstado(parcial) {
    Object.assign(this.estado, parcial);
    this.avisar({ tipo: 'estado', ...this.estado });
  }

  async info() {
    return { ...this.estado, motor: 'kokoro', instalado: await this.instalado() };
  }

  // ───────────────────────── instalação ─────────────────────────

  async instalar() {
    if (this.instalando) return this.instalando;
    this.parar();
    this.instalando = (async () => {
      this.setEstado({ status: 'instalando', pct: 0, erro: null, texto: 'Preparando a instalação…' });
      try {
        const r = await instalador.instalar({
          dirBin: this.dirBin,
          dirApp: this.dirApp,
          dirRecursos: this.dirRecursos,
          log: (linha) => this.avisar({ tipo: 'instalacao', linha }),
          etapa: ({ n, total, texto }) => this.setEstado({ status: 'instalando', pct: (n - 1) / total, texto }),
        });
        this.setEstado({ status: 'parado', pct: 1, texto: 'Instalada. Clique em ⚡ Carregar voz.' });
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
    if (this.estado.status === 'pronto' && this.proc) return this.estado;
    if (this.iniciando) return this.iniciando;
    if (this.instalando) {
      const e = new Error('A voz está sendo instalada. Aguarde terminar e clique em ⚡ Carregar voz.');
      e.ausente = true;
      throw e;
    }
    this.iniciando = (async () => {
      const onde = await this.localizar();
      if (!onde) {
        this.setEstado({ status: 'ausente', erro: 'A voz Kokoro ainda não foi instalada. Vá em ⚙️ Configurações → Voz → 📦 Instalar.' });
        const e = new Error(this.estado.erro);
        e.ausente = true;
        throw e;
      }
      this.setEstado({ status: 'iniciando', erro: null, pct: 0, texto: 'Abrindo o serviço de voz…' });
      await fsp.mkdir(this.dirCache, { recursive: true });
      try {
        await this.garantirVozes(onde);
      } catch (e) {
        this.setEstado({ status: 'erro', erro: e.message });
        throw e;
      }
      const proc = spawn(onde.cmd, onde.args, { cwd: this.dirDados, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      this.proc = proc;
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); if (process.env.CRONICAS_VOZ_DEBUG) process.stderr.write(d); });
      proc.on('error', (e) => this.falhou(e.code === 'ENOENT' ? `Não achei "${onde.cmd}". Reinstale a voz em Configurações.` : e.message));
      proc.on('exit', (code) => {
        if (this.proc !== proc) return;
        const fim = stderr.trim().split(/\r?\n/).filter((l) => !/^\s+at /.test(l)).slice(-2).join(' ');
        this.falhou(code ? `O serviço de voz parou (código ${code}). ${fim}` : 'O serviço de voz foi encerrado.');
      });
      proc.stdin.on('error', () => {});
      readline.createInterface({ input: proc.stdout }).on('line', (l) => this.receber(l));
      const cfg = await this.getSettings();
      // o processo pode ter falhado ao abrir (arquivo não existe) enquanto lia as configurações
      if (this.proc !== proc) {
        const e = new Error(this.estado.erro || 'O serviço de voz não abriu.');
        e.ausente = true;
        throw e;
      }
      await this.enviar({ cmd: 'iniciar', dados: this.dirDados, modelo: cfg.vozModelo || '' }, 30 * 60 * 1000);
      this.setEstado({ status: 'pronto', pct: 1, texto: 'Kokoro pronto.' });
      return this.estado;
    })();
    try {
      return await this.iniciando;
    } finally {
      this.iniciando = null;
    }
  }

  falhou(msg) {
    this.proc = null;
    for (const { rejeitar, timer } of this.pendentes.values()) { clearTimeout(timer); rejeitar(new Error(msg)); }
    this.pendentes.clear();
    this.setEstado({ status: 'erro', erro: msg });
  }

  receber(linha) {
    if (process.env.CRONICAS_VOZ_DEBUG) console.log('[voz<]', linha.slice(0, 200));
    let m;
    try { m = JSON.parse(linha); } catch { return; } // ignora qualquer saída que não seja JSON
    if (m.evento === 'progresso') return this.setEstado({ status: 'baixando', pct: m.pct, texto: `Baixando o modelo Kokoro (~320 MB): ${Math.round((m.pct || 0) * 100)}%` });
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

  enviar(msg, timeoutMs = 3 * 60 * 1000) {
    if (!this.proc) return Promise.reject(new Error('Serviço de voz parado.'));
    const id = ++this.seq;
    return new Promise((resolver, rejeitar) => {
      const timer = setTimeout(() => {
        this.pendentes.delete(id);
        rejeitar(new Error('O serviço de voz demorou demais.'));
      }, timeoutMs);
      this.pendentes.set(id, { resolver, rejeitar, timer });
      this.proc.stdin.write(JSON.stringify({ id, ...msg }) + '\n', 'utf8');
    });
  }

  // ───────────────────────── vozes ─────────────────────────

  /** As 16 vozes com a mistura em uso (a sua, se trocou em Configurações). */
  async listarVozes() {
    const cfg = await this.getSettings();
    return Object.entries(PRESETS).map(([id, p]) => ({
      id, nome: p.nome, mix: (cfg.vozMixes || {})[id] || p.mix.pt, padrao: p.mix.pt, trocada: !!(cfg.vozMixes || {})[id],
    }));
  }

  // ───────────────────────── fala ─────────────────────────

  /**
   * Sintetiza (ou reaproveita do cache).
   * @param {{texto: string, preset: string, idioma?: 'pt'|'en', emocao?: string, velocidade?: number, lote?: string}} p
   */
  async falar({ texto, preset, idioma = 'pt', emocao = 'neutro', velocidade = 1, lote }) {
    texto = String(texto || '').trim();
    if (!texto) throw new Error('Texto vazio.');
    const cfg = await this.getSettings();
    idioma = idioma === 'en' ? 'en' : 'pt';
    const par = parametros(preset, { idioma, emocao, usarEmocao: cfg.vozEmocao !== false, velocidade });
    const trocada = idioma === 'pt' && (cfg.vozMixes || {})[preset];
    const mix = trocada || par.mix;
    const hash = crypto.createHash('sha1').update(JSON.stringify(['k1', texto, mix, par.velocidade])).digest('hex').slice(0, 20);
    const arquivo = path.join(this.dirCache, `${hash}.wav`);
    if (fs.existsSync(arquivo)) return { arquivo: `${hash}.wav`, cache: true };
    if (this.emAndamento.has(hash)) return this.emAndamento.get(hash);
    const p = (async () => {
      await this.iniciar();
      const r = await this.enviar({ cmd: 'falar', texto, mix, velocidade: par.velocidade, saida: arquivo, lote });
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
    for (const { rejeitar, timer } of this.pendentes.values()) { clearTimeout(timer); rejeitar(Object.assign(new Error('cancelado'), { cancelado: true })); }
    this.pendentes.clear();
    setTimeout(() => { try { p.kill(); } catch { /* ok */ } }, 1500);
    this.setEstado({ status: 'parado', texto: '' });
  }
}

module.exports = { Voz };
