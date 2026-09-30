#!/usr/bin/env node
// npm run voz:instalar  → instala o Chatterbox no mesmo lugar que o botão "Instalar" do app usa.
// npm run voz:teste     → roda o serviço em modo de teste (sem modelos) e sintetiza uma frase.
//   --destino <pasta>   usa outra pasta de dados (padrão: pasta de dados do app/voz)
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');
const { instalar, pythonDoVenv } = require('../../src/main/voz-instalador');

const NOME_APP = 'Crônicas'; // productName do package.json (= app.getPath('userData'))
function dirDadosApp() {
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), NOME_APP);
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', NOME_APP);
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), NOME_APP);
}
const i = process.argv.indexOf('--destino');
const dirVoz = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(dirDadosApp(), 'voz');

async function teste() {
  const py = fs.existsSync(pythonDoVenv(path.join(dirVoz, 'python'))) ? pythonDoVenv(path.join(dirVoz, 'python')) : process.platform === 'win32' ? 'python' : 'python3';
  const falso = !process.argv.includes('--real');
  const p = spawn(py, ['-u', path.join(__dirname, 'servico.py'), ...(falso ? ['--falso'] : [])], { stdio: ['pipe', 'pipe', 'inherit'] });
  const saida = path.join(dirVoz, 'teste.wav');
  p.stdout.on('data', (d) => process.stdout.write(d));
  p.stdin.write(JSON.stringify({ id: 1, cmd: 'iniciar', dados: dirVoz }) + '\n');
  p.stdin.write(JSON.stringify({ id: 2, cmd: 'falar', texto: 'Bem-vindo à taverna, viajante. Sente-se perto do fogo.', idioma: 'pt', saida }) + '\n');
  p.stdin.write(JSON.stringify({ cmd: 'sair' }) + '\n');
  p.on('close', (c) => { console.log(c === 0 ? `\nOK → ${saida}` : `\nfalhou (${c})`); process.exit(c || 0); });
}

if (process.argv.includes('--teste')) teste();
else {
  console.log(`Instalando a voz Chatterbox em ${path.join(dirVoz, 'python')}\n`);
  instalar({ dirVenv: path.join(dirVoz, 'python'), log: (l) => console.log(l) })
    .then((r) => console.log(`\nPronto: ${r.python}\nAbra o app → ⚙️ Configurações → Voz → ⚡ Carregar voz.`))
    .catch((e) => { console.error(`\n✖ ${e.message}`); process.exit(1); });
}
