const path = require('path');
const { app, safeStorage } = require('electron');
const { readJson, writeJson } = require('./util');

const PADRAO = {
  provedor: 'demo', // 'api' | 'claude-code' | 'demo'
  apiKey: '',
  modelo: 'claude-sonnet-5-5',
  claudePath: 'claude',
  claudeModelo: '',
  pastaCampanhas: '',
  velocidadeTexto: 14, // ms por caractere (0 = instantâneo)
  som: true,
  musica: true,
  volume: 0.6,
  volMusica: 0.5,
  volAmbiente: 0.6,
  volEfeitos: 0.8,
  particulas: true,
  // voz (KokoroSharp / voz do sistema)
  vozMotor: 'kokoro', // 'kokoro' | 'sistema' | 'desligado'
  vozAtiva: true,
  vozNarrador: 'narrador-grave',
  vozVelocidade: 1,
  vozLerJogador: false,
  volVoz: 0.95,
  vozEmocao: true, // a emoção de cada fala muda o ritmo da voz
  vozMixes: {}, // preset → mistura de vozes do Kokoro escolhida pelo jogador
  vozComando: '', // opcional: comando manual para iniciar o serviço (ex.: "dotnet C:\\...\\CronicasVoz.dll")
  vozModelo: '', // opcional: caminho de um kokoro.onnx já baixado
};

function arquivo() {
  return path.join(app.getPath('userData'), 'config.json');
}

function podeCriptografar() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

async function carregar() {
  const raw = (await readJson(arquivo(), {})) || {};
  const cfg = { ...PADRAO, ...raw };
  if (!cfg.pastaCampanhas) cfg.pastaCampanhas = path.join(app.getPath('documents'), 'Cronicas RPG');
  // A chave de API fica criptografada pelo cofre do sistema (DPAPI no Windows / Keychain no mac).
  if (raw.apiKeyEnc && podeCriptografar()) {
    try {
      cfg.apiKey = safeStorage.decryptString(Buffer.from(raw.apiKeyEnc, 'base64'));
    } catch {
      cfg.apiKey = '';
    }
  }
  delete cfg.apiKeyEnc;
  // versões que passaram por Chatterbox/Qwen3-TTS voltam para o KokoroSharp
  if (!['kokoro', 'sistema', 'desligado'].includes(cfg.vozMotor)) cfg.vozMotor = 'kokoro';
  for (const k of ['vozDispositivo', 'vozIngles', 'vozPython', 'vozPythonQwen', 'vozQwenModelo', 'vozQwenFalantes', 'vozMigrouQwen']) delete cfg[k];
  return cfg;
}

async function salvar(novo) {
  const atual = await carregar();
  const cfg = { ...atual, ...novo };
  const gravar = { ...cfg };
  if (cfg.apiKey && podeCriptografar()) {
    gravar.apiKeyEnc = safeStorage.encryptString(cfg.apiKey).toString('base64');
    delete gravar.apiKey;
  }
  await writeJson(arquivo(), gravar);
  return cfg;
}

module.exports = { carregar, salvar, PADRAO };
