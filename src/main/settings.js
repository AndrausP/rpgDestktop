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
  // voz (Chatterbox / voz do sistema)
  vozMotor: 'chatterbox', // 'chatterbox' | 'sistema' | 'desligado'
  vozAtiva: true,
  vozNarrador: 'narrador-grave',
  vozVelocidade: 1,
  vozLerJogador: false,
  volVoz: 0.95,
  vozDispositivo: 'auto', // 'auto' | 'cuda' | 'mps' | 'cpu'
  vozIngles: 'turbo', // 'turbo' (rápido, aceita [laugh] [sigh]…) | 'multilingual'
  vozEmocao: true, // o tom de cada fala segue a emoção indicada pelo mestre
  vozPython: '', // opcional: python de um ambiente que já tenha o chatterbox-tts
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
  if (cfg.vozMotor === 'kokoro') cfg.vozMotor = 'chatterbox'; // versões antigas usavam KokoroSharp
  delete cfg.vozComando;
  delete cfg.vozModelo;
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
