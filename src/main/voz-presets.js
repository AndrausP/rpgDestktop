// Vozes dos personagens (Chatterbox).
// Cada preset vira um clipe de referência de ~10 s: a voz embutida do Chatterbox é gravada uma vez
// e transposta para a altura (f0) e o ritmo do personagem. Você pode trocar qualquer um por uma
// gravação de verdade em Configurações → Voz (🎙️ gravar / 📂 importar) ou soltando
// `_artes/vozes/<id>.wav`. Os ids são os mesmos de renderer/js/vozes.js.

const PRESETS = {
  'narrador-grave': { nome: 'Narrador grave', f0: 95, ritmo: 0.95, estilo: 'neutro', exagero: -0.05 },
  'narrador-classico': { nome: 'Narrador clássico', f0: 115, ritmo: 1, estilo: 'neutro', exagero: 0 },
  narradora: { nome: 'Narradora', f0: 195, ritmo: 0.97, estilo: 'neutro', exagero: 0 },
  'homem-jovem': { nome: 'Homem jovem', f0: 130, ritmo: 1.04, estilo: 'intenso', exagero: 0.05 },
  'homem-maduro': { nome: 'Homem maduro', f0: 110, ritmo: 0.98, estilo: 'neutro', exagero: 0 },
  'velho-sabio': { nome: 'Velho sábio', f0: 100, ritmo: 0.88, estilo: 'neutro', exagero: -0.1 },
  brutamontes: { nome: 'Brutamontes', f0: 85, ritmo: 0.92, estilo: 'intenso', efeito: 'rouco', exagero: 0.15 },
  malandro: { nome: 'Malandro', f0: 135, ritmo: 1.1, estilo: 'intenso', exagero: 0.1 },
  nobre: { nome: 'Nobre', f0: 115, ritmo: 0.94, estilo: 'neutro', exagero: -0.05 },
  sombrio: { nome: 'Sombrio', f0: 90, ritmo: 0.86, estilo: 'neutro', efeito: 'rouco', exagero: 0 },
  'mulher-jovem': { nome: 'Mulher jovem', f0: 225, ritmo: 1.05, estilo: 'intenso', exagero: 0.05 },
  'mulher-madura': { nome: 'Mulher madura', f0: 190, ritmo: 0.97, estilo: 'neutro', exagero: 0 },
  sussurrante: { nome: 'Sussurrante', f0: 205, ritmo: 0.9, estilo: 'neutro', efeito: 'sopro', exagero: -0.15 },
  rainha: { nome: 'Rainha', f0: 200, ritmo: 0.92, estilo: 'neutro', exagero: -0.05 },
  criatura: { nome: 'Criatura', f0: 70, ritmo: 0.8, estilo: 'intenso', efeito: 'rouco', exagero: 0.2 },
  goblin: { nome: 'Goblin', f0: 260, ritmo: 1.18, estilo: 'intenso', exagero: 0.2 },
};

/**
 * Emoção da fala → parâmetros do Chatterbox.
 * exagero (exaggeration): intensidade emocional. cfg (cfg_weight): menor = fala mais solta/rápida,
 * maior = mais fiel e pausada. temperatura: variação.
 */
const EMOCOES = {
  neutro: { exagero: 0.5, cfg: 0.5, temperatura: 0.8 },
  calmo: { exagero: 0.35, cfg: 0.5, temperatura: 0.7 },
  alegre: { exagero: 0.65, cfg: 0.45, temperatura: 0.85 },
  raiva: { exagero: 0.85, cfg: 0.35, temperatura: 0.9 },
  medo: { exagero: 0.7, cfg: 0.4, temperatura: 0.9 },
  triste: { exagero: 0.45, cfg: 0.55, temperatura: 0.75 },
  sussurro: { exagero: 0.3, cfg: 0.6, temperatura: 0.7 },
  grito: { exagero: 1.0, cfg: 0.3, temperatura: 0.95 },
  sarcastico: { exagero: 0.6, cfg: 0.45, temperatura: 0.85 },
  misterioso: { exagero: 0.4, cfg: 0.55, temperatura: 0.75 },
};

function parametros(preset, emocao, usarEmocao = true) {
  const e = (usarEmocao && EMOCOES[emocao]) || EMOCOES.neutro;
  const p = PRESETS[preset] || {};
  const exagero = Math.max(0.25, Math.min(1.2, e.exagero + (p.exagero || 0)));
  return { exagero: +exagero.toFixed(2), cfg: e.cfg, temperatura: e.temperatura };
}

module.exports = { PRESETS, EMOCOES, parametros };
