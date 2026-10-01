import { setTema, audio, particulas, ligarSom, limparPalco } from './cenario.js';
import { telaInicio } from './telas/inicio.js';
import { telaJogo } from './telas/jogo.js';
import { telaCriacao } from './telas/criacao.js';
import { telaCompendio } from './telas/compendio.js';
import { toast } from './ui.js';
import { iniciarBarra } from './barra.js';
import { carregarCatalogo } from './arte.js';

export const S = {
  cfg: null,
  tela: null, // função de limpeza da tela atual
};

export const api = window.rpg;

export async function recarregarConfig() {
  S.cfg = await api.config.ler();
  audio.setVolumes({ master: S.cfg.volume ?? 0.6, musica: S.cfg.volMusica ?? 0.5, ambiente: S.cfg.volAmbiente ?? 0.6, efeitos: S.cfg.volEfeitos ?? 0.8, voz: S.cfg.volVoz ?? 0.95 });
  audio.setMusica(S.cfg.musica !== false);
  particulas.ativo = S.cfg.particulas !== false;
  return S.cfg;
}

export function irPara(nome, arg) {
  if (typeof S.tela === 'function') {
    try { S.tela(); } catch (e) { console.error(e); }
  }
  S.tela = null;
  limparPalco();
  document.querySelectorAll('.modal-fundo').forEach((m) => m.remove());
  const app = document.getElementById('app');
  app.innerHTML = '';
  if (nome === 'inicio') S.tela = telaInicio(app);
  if (nome === 'jogo') S.tela = telaJogo(app, arg);
  if (nome === 'criacao') S.tela = telaCriacao(app, arg);
  if (nome === 'compendio') S.tela = telaCompendio(app, arg);
}

async function main() {
  if (!api) {
    document.getElementById('app').innerHTML = '<p style="padding:40px">Abra pelo Electron: <code>npm start</code></p>';
    return;
  }
  iniciarBarra();
  setTema('taverna', { instantaneo: true });
  await carregarCatalogo();
  try {
    await recarregarConfig();
  } catch (e) {
    toast(`Erro ao ler configurações: ${e.message}`, 'erro');
  }
  // o navegador exige um gesto do usuário antes de tocar som
  const destravar = () => {
    if (S.cfg?.som) ligarSom(true);
    window.removeEventListener('pointerdown', destravar);
  };
  window.addEventListener('pointerdown', destravar);
  irPara('inicio');
}

window.addEventListener('unhandledrejection', (e) => toast(e.reason?.message || String(e.reason), 'erro'));
main();
