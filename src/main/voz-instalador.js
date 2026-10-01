// Compila o serviço de voz (voz/CronicasVoz, C# + KokoroSharp) com o .NET 8 SDK.
//   1. acha o `dotnet` com um SDK 8 ou mais novo (no Windows tenta instalar pelo winget se faltar)
//   2. dotnet publish → <dados>/voz/bin/CronicasVoz(.exe)
// Usado pelo botão "Instalar" em Configurações e por `npm run voz:instalar`.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const os = require('os');

const WIN = process.platform === 'win32';
const EXE = WIN ? 'CronicasVoz.exe' : 'CronicasVoz';

function rodar(cmd, args, { log = () => {}, cwd, timeoutMs = 0 } = {}) {
  return new Promise((resolve) => {
    let out = '';
    let proc;
    try {
      proc = spawn(cmd, args, { cwd, windowsHide: true, env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' } });
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

/** Caminho do dotnet com SDK ≥ 8, ou null. */
async function acharDotnet() {
  const cands = ['dotnet'];
  if (WIN) cands.push(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'dotnet', 'dotnet.exe'));
  else cands.push('/usr/local/share/dotnet/dotnet', '/usr/share/dotnet/dotnet', path.join(process.env.HOME || '', '.dotnet', 'dotnet'));
  for (const c of cands) {
    if (path.isAbsolute(c) && !fs.existsSync(c)) continue;
    const r = await rodar(c, ['--list-sdks'], { timeoutMs: 20000 });
    const versoes = (r.out.match(/^\d+\.\d+\.\d+/gm) || []).map((v) => +v.split('.')[0]);
    if (r.code === 0 && versoes.some((v) => v >= 8)) return c;
  }
  return null;
}

/** Onde está o projeto C# (no app empacotado ele vai em resources/voz/CronicasVoz). */
function projeto(dirApp, dirRecursos) {
  const c = [dirRecursos && path.join(dirRecursos, 'voz', 'CronicasVoz'), path.join(dirApp, 'voz', 'CronicasVoz')].filter(Boolean);
  return c.find((d) => fs.existsSync(path.join(d, 'CronicasVoz.csproj'))) || null;
}

const temVozes = (d) => { try { return fs.readdirSync(d).some((f) => /\.npy$/i.test(f)); } catch { return false; } };

/**
 * Pasta "voices" do Kokoro (os .npy de cada voz). O pacote KokoroSharp copia as vozes só no build, não no
 * publish — então elas podem estar ao lado do serviço, na saída do build do projeto ou no cache do NuGet.
 * @param {{dirs?: string[], proj?: string|null}} o
 */
function acharVozes({ dirs = [], proj = null } = {}) {
  const c = dirs.filter(Boolean).map((d) => path.join(d, 'voices'));
  if (proj) for (const cfg of ['Release', 'Debug']) c.push(path.join(proj, 'bin', cfg, 'net8.0', 'voices'));
  const pkgs = path.join(process.env.NUGET_PACKAGES || path.join(os.homedir(), '.nuget', 'packages'), 'kokorosharp');
  try {
    const versoes = fs.readdirSync(pkgs).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const v of versoes) c.push(path.join(pkgs, v, 'content', 'voices'));
  } catch { /* sem cache do NuGet */ }
  return c.find(temVozes) || null;
}

/** Garante as vozes em <destino>/voices (copia da 1ª origem encontrada). Devolve a pasta, ou null. */
async function copiarVozes(destino, origem) {
  const alvo = path.join(destino, 'voices');
  if (!origem || path.resolve(origem) === path.resolve(alvo)) return temVozes(alvo) ? alvo : null;
  const lista = (d) => { try { return fs.readdirSync(d).filter((f) => /\.npy$/i.test(f)).sort().join('|'); } catch { return ''; } };
  if (lista(origem) !== lista(alvo)) await fs.promises.cp(origem, alvo, { recursive: true, force: true });
  return alvo;
}

/**
 * @param {{dirBin: string, dirApp: string, dirRecursos?: string, log?: (l: string) => void, etapa?: (e: {n:number,total:number,texto:string}) => void}} o
 */
async function instalar({ dirBin, dirApp, dirRecursos, log = () => {}, etapa = () => {} }) {
  const TOTAL = 3;
  const passo = (n, texto) => { etapa({ n, total: TOTAL, texto }); log(`▶ ${texto}`); };

  const proj = projeto(dirApp, dirRecursos);
  if (!proj) throw new Error('Projeto voz/CronicasVoz não encontrado.');

  passo(1, 'Procurando o .NET 8 SDK');
  let dotnet = await acharDotnet();
  if (!dotnet && WIN) {
    log('.NET 8 SDK não encontrado — tentando instalar pelo winget (pode levar alguns minutos)...');
    const w = await rodar('winget', ['install', '--id', 'Microsoft.DotNet.SDK.8', '-e', '--silent',
      '--accept-package-agreements', '--accept-source-agreements'], { log, timeoutMs: 15 * 60 * 1000 });
    if (w.code === 0) dotnet = await acharDotnet();
    else log('winget falhou ou não existe neste PC.');
  }
  if (!dotnet) {
    throw new Error('.NET 8 SDK não encontrado. Instale em https://dotnet.microsoft.com/download/dotnet/8.0 (SDK) e clique em Instalar de novo.');
  }
  log(`dotnet: ${dotnet}`);

  passo(2, 'Compilando o serviço de voz (baixa o KokoroSharp do NuGet na 1ª vez)');
  fs.mkdirSync(dirBin, { recursive: true });
  const r = await rodar(dotnet, ['publish', proj, '-c', 'Release', '-o', dirBin, '--nologo'], { log, timeoutMs: 20 * 60 * 1000 });
  if (r.code !== 0) throw new Error(`Falha ao compilar o serviço de voz.\n${r.out.trim().split(/\r?\n/).filter((l) => /error|erro/i.test(l)).slice(-6).join('\n')}`);

  passo(3, 'Conferindo');
  const exe = path.join(dirBin, EXE);
  const dll = path.join(dirBin, 'CronicasVoz.dll');
  if (!fs.existsSync(exe) && !fs.existsSync(dll)) throw new Error('A compilação terminou, mas o CronicasVoz não apareceu.');
  // o publish não leva a pasta de vozes do KokoroSharp: copia do build/cache do NuGet
  if (!temVozes(path.join(dirBin, 'voices'))) {
    const origem = acharVozes({ proj });
    if (!origem) throw new Error('A compilação terminou, mas a pasta de vozes do Kokoro (voices) não apareceu. Rode o Instalar de novo.');
    log(`vozes: ${origem}`);
    await copiarVozes(dirBin, origem);
  }
  log('✔ Voz instalada. O modelo Kokoro (~320 MB) é baixado na primeira vez que a voz carregar.');
  return { exe: fs.existsSync(exe) ? exe : dll, detalhe: 'KokoroSharp' };
}

module.exports = { instalar, acharDotnet, projeto, acharVozes, copiarVozes, EXE };
