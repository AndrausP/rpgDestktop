#!/usr/bin/env node
// npm run voz:instalar   → compila o serviço de voz (voz/CronicasVoz, KokoroSharp) no mesmo lugar que o botão "Instalar" do app
// npm run voz:teste      → inicia o serviço compilado e sintetiza uma frase (baixa o modelo na 1ª vez)
//   --destino <pasta>    usa outra pasta de dados (padrão: pasta de dados do app/voz)
const path = require('path');
const os = require('os');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');
const { instalar, EXE } = require('../src/main/voz-instalador');

const NOME_APP = 'Crônicas'; // = app.getPath('userData') (ver main.js)
function dirDadosApp() {
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), NOME_APP);
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', NOME_APP);
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), NOME_APP);
}
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const dirVoz = arg('--destino') ? path.resolve(arg('--destino')) : path.join(dirDadosApp(), 'voz');
const dirBin = path.join(dirVoz, 'bin');

function teste() {
  const exe = path.join(dirBin, EXE);
  if (!fs.existsSync(exe)) { console.error(`Não achei ${exe}. Rode "npm run voz:instalar" antes.`); process.exit(1); }
  const p = spawn(exe, [], { cwd: dirVoz, stdio: ['pipe', 'pipe', 'inherit'] });
  const saida = path.join(dirVoz, 'teste-kokoro.wav');
  const enviar = (m) => p.stdin.write(JSON.stringify(m) + '\n');
  readline.createInterface({ input: p.stdout }).on('line', (l) => {
    console.log(l);
    const m = JSON.parse(l);
    if (m.id === 1 && m.ok) enviar({ id: 2, cmd: 'falar', texto: 'Bem-vindo à taverna, viajante! Sente-se perto do fogo e me conte de onde você vem.', mix: [['pm_santa', 0.75], ['bm_george', 0.25]], velocidade: 0.95, saida });
    else if (m.id) enviar({ cmd: 'sair' });
  });
  enviar({ id: 1, cmd: 'iniciar', dados: dirVoz });
  p.on('close', (c) => { console.log(fs.existsSync(saida) ? `\nOK → ${saida}` : `\nfalhou (${c})`); process.exit(c || 0); });
}

if (process.argv.includes('--teste')) teste();
else {
  console.log(`Compilando a voz Kokoro em ${dirBin}\n`);
  instalar({ dirBin, dirApp: path.join(__dirname, '..'), log: (l) => console.log(l) })
    .then((r) => console.log(`\nPronto: ${r.exe}\nAbra o app → ⚙️ Configurações → Voz → ⚡ Carregar voz.`))
    .catch((e) => { console.error(`\n✖ ${e.message}`); process.exit(1); });
}
