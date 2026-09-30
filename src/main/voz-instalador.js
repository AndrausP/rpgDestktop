// Instala o Chatterbox num ambiente Python só do app (venv), sem mexer no Python do sistema.
//   1. acha um Python 3.10–3.13 (prefere 3.11)
//   2. cria o venv em <dados>/voz/python
//   3. PyTorch 2.6 — CUDA 12.4 se houver placa NVIDIA, senão CPU
//   4. chatterbox-tts + soundfile
// Usado pelo botão "Instalar" em Configurações e por `npm run voz:instalar`.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VERSAO_CHATTERBOX = '0.1.7';
const VERSAO_TORCH = '2.6.0';
const WIN = process.platform === 'win32';

function pythonDoVenv(dirVenv) {
  return WIN ? path.join(dirVenv, 'Scripts', 'python.exe') : path.join(dirVenv, 'bin', 'python');
}

function rodar(cmd, args, { log = () => {}, env, timeoutMs = 0 } = {}) {
  return new Promise((resolve) => {
    let out = '';
    let proc;
    try {
      proc = spawn(cmd, args, { windowsHide: true, env: { ...process.env, PYTHONUTF8: '1', PIP_DISABLE_PIP_VERSION_CHECK: '1', ...env } });
    } catch (e) {
      return resolve({ code: -1, out: e.message });
    }
    const timer = timeoutMs ? setTimeout(() => proc.kill(), timeoutMs) : null;
    const linhas = (d) => {
      const t = d.toString('utf8');
      out += t;
      t.split(/\r?\n|\r/).map((l) => l.trim()).filter(Boolean).forEach((l) => log(l));
    };
    proc.stdout.on('data', linhas);
    proc.stderr.on('data', linhas);
    proc.on('error', (e) => { if (timer) clearTimeout(timer); resolve({ code: -1, out: e.message }); });
    proc.on('close', (code) => { if (timer) clearTimeout(timer); resolve({ code, out }); });
  });
}

async function versaoPython(cmd, args) {
  const r = await rodar(cmd, [...args, '-c', 'import sys;print("%d.%d" % sys.version_info[:2])'], { timeoutMs: 20000 });
  const m = r.code === 0 && r.out.match(/(\d+)\.(\d+)/);
  return m ? [+m[1], +m[2]] : null;
}

/** Procura um Python compatível. Retorna {cmd, args, versao} ou null. */
async function acharPython(preferido) {
  const cands = [];
  if (preferido) cands.push([preferido, []]);
  if (WIN) {
    for (const v of ['3.11', '3.12', '3.10', '3.13']) cands.push(['py', [`-${v}`]]);
    cands.push(['python', []], ['python3', []]);
    const local = process.env.LOCALAPPDATA;
    if (local) for (const v of ['311', '312', '310', '313']) cands.push([path.join(local, 'Programs', 'Python', `Python${v}`, 'python.exe'), []]);
  } else {
    cands.push(['python3.11', []], ['python3.12', []], ['python3.10', []], ['python3.13', []], ['python3', []]);
  }
  for (const [cmd, args] of cands) {
    if (path.isAbsolute(cmd) && !fs.existsSync(cmd)) continue;
    const v = await versaoPython(cmd, args);
    if (v && v[0] === 3 && v[1] >= 10 && v[1] <= 13) return { cmd, args, versao: v.join('.') };
  }
  return null;
}

async function temNvidia() {
  const r = await rodar('nvidia-smi', ['-L'], { timeoutMs: 15000 });
  return r.code === 0 && /GPU/i.test(r.out);
}

/**
 * @param {{dirVenv: string, pythonBase?: string, log?: (linha: string) => void, etapa?: (e: {n:number,total:number,texto:string}) => void}} o
 */
async function instalar({ dirVenv, pythonBase, log = () => {}, etapa = () => {} }) {
  const TOTAL = 5;
  const passo = (n, texto) => { etapa({ n, total: TOTAL, texto }); log(`▶ ${texto}`); };
  const exigir = (r, msg) => {
    if (r.code !== 0) throw new Error(`${msg}\n${r.out.trim().split(/\r?\n/).slice(-6).join('\n')}`);
  };

  passo(1, 'Procurando o Python 3.10–3.13');
  const py = await acharPython(pythonBase);
  if (!py) {
    throw new Error(WIN
      ? 'Python 3.11 não encontrado. Instale em python.org (marque "Add python.exe to PATH") ou pela Microsoft Store e tente de novo.'
      : 'Python 3.11 não encontrado. Instale python3.11 (e python3.11-venv) e tente de novo.');
  }
  log(`Python ${py.versao}: ${[py.cmd, ...py.args].join(' ')}`);

  const pyVenv = pythonDoVenv(dirVenv);
  if (!fs.existsSync(pyVenv)) {
    passo(2, 'Criando o ambiente Python do app');
    fs.mkdirSync(path.dirname(dirVenv), { recursive: true });
    exigir(await rodar(py.cmd, [...py.args, '-m', 'venv', dirVenv], { log }), 'Não consegui criar o ambiente virtual.');
  } else {
    passo(2, 'Ambiente Python já existe');
  }
  exigir(await rodar(pyVenv, ['-m', 'pip', 'install', '--upgrade', 'pip', 'wheel', '--progress-bar', 'off'], { log }), 'Falha ao atualizar o pip.');

  const nvidia = process.platform !== 'darwin' && (await temNvidia());
  passo(3, nvidia ? 'Instalando PyTorch com CUDA (placa NVIDIA encontrada, ~2,5 GB)' : 'Instalando PyTorch (CPU)');
  const torchArgs = ['-m', 'pip', 'install', `torch==${VERSAO_TORCH}`, `torchaudio==${VERSAO_TORCH}`, '--progress-bar', 'off'];
  if (nvidia) torchArgs.push('--index-url', 'https://download.pytorch.org/whl/cu124');
  else if (process.platform !== 'darwin') torchArgs.push('--index-url', 'https://download.pytorch.org/whl/cpu');
  exigir(await rodar(pyVenv, torchArgs, { log }), 'Falha ao instalar o PyTorch.');

  passo(4, `Instalando Chatterbox ${VERSAO_CHATTERBOX}`);
  exigir(await rodar(pyVenv, ['-m', 'pip', 'install', `chatterbox-tts==${VERSAO_CHATTERBOX}`, 'soundfile', '--progress-bar', 'off'], { log }), 'Falha ao instalar o chatterbox-tts.');

  passo(5, 'Conferindo a instalação');
  const r = await rodar(pyVenv, ['-c', 'import torch, soundfile, librosa, chatterbox.mtl_tts, chatterbox.tts_turbo; print("ok", torch.__version__, "cuda" if torch.cuda.is_available() else "cpu")'], { log });
  exigir(r, 'O Chatterbox foi instalado, mas não carregou.');
  log('✔ Voz instalada. Os modelos (~3 GB) são baixados na primeira vez que a voz carregar.');
  return { python: pyVenv, gpu: nvidia, detalhe: r.out.trim().split(/\r?\n/).pop() };
}

module.exports = { instalar, acharPython, pythonDoVenv, temNvidia, VERSAO_CHATTERBOX };
