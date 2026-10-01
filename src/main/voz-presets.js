// Vozes dos personagens (KokoroSharp). Cada voz é uma MISTURA de vozes do Kokoro:
// a 1ª da lista define o idioma (pt: pf_dora, pm_alex, pm_santa) e as outras colorem o timbre.
// Os ids são os mesmos de renderer/js/vozes.js.

const PRESETS = {
  'narrador-grave': { nome: 'Narrador grave', vel: 0.93, mix: { pt: [['pm_santa', 0.75], ['bm_george', 0.25]], en: [['bm_george', 0.7], ['am_onyx', 0.3]] } },
  'narrador-classico': { nome: 'Narrador clássico', vel: 0.98, mix: { pt: [['pm_alex', 1]], en: [['bm_fable', 1]] } },
  narradora: { nome: 'Narradora', vel: 0.96, mix: { pt: [['pf_dora', 0.8], ['bf_emma', 0.2]], en: [['bf_emma', 0.7], ['af_heart', 0.3]] } },
  'homem-jovem': { nome: 'Homem jovem', vel: 1.04, mix: { pt: [['pm_alex', 0.75], ['am_michael', 0.25]], en: [['am_michael', 1]] } },
  'homem-maduro': { nome: 'Homem maduro', vel: 0.97, mix: { pt: [['pm_alex', 0.6], ['pm_santa', 0.4]], en: [['am_adam', 0.7], ['bm_lewis', 0.3]] } },
  'velho-sabio': { nome: 'Velho sábio', vel: 0.86, mix: { pt: [['pm_santa', 0.7], ['bm_fable', 0.3]], en: [['bm_fable', 0.6], ['bm_daniel', 0.4]] } },
  brutamontes: { nome: 'Brutamontes', vel: 0.88, mix: { pt: [['pm_santa', 0.6], ['am_onyx', 0.4]], en: [['am_onyx', 0.7], ['am_eric', 0.3]] } },
  malandro: { nome: 'Malandro', vel: 1.1, mix: { pt: [['pm_alex', 0.7], ['am_puck', 0.3]], en: [['am_puck', 1]] } },
  nobre: { nome: 'Nobre', vel: 0.93, mix: { pt: [['pm_alex', 0.65], ['bm_george', 0.35]], en: [['bm_george', 1]] } },
  sombrio: { nome: 'Sombrio', vel: 0.85, mix: { pt: [['pm_santa', 0.6], ['am_fenrir', 0.4]], en: [['am_fenrir', 0.7], ['am_onyx', 0.3]] } },
  'mulher-jovem': { nome: 'Mulher jovem', vel: 1.04, mix: { pt: [['pf_dora', 0.75], ['af_bella', 0.25]], en: [['af_bella', 1]] } },
  'mulher-madura': { nome: 'Mulher madura', vel: 0.96, mix: { pt: [['pf_dora', 0.7], ['bf_isabella', 0.3]], en: [['bf_isabella', 1]] } },
  sussurrante: { nome: 'Sussurrante', vel: 0.9, mix: { pt: [['pf_dora', 0.7], ['af_nicole', 0.3]], en: [['af_nicole', 1]] } },
  rainha: { nome: 'Rainha', vel: 0.92, mix: { pt: [['pf_dora', 0.65], ['bf_emma', 0.35]], en: [['bf_emma', 0.6], ['af_kore', 0.4]] } },
  criatura: { nome: 'Criatura', vel: 0.78, mix: { pt: [['pm_santa', 0.5], ['am_onyx', 0.5]], en: [['am_onyx', 0.6], ['am_fenrir', 0.4]] } },
  goblin: { nome: 'Goblin', vel: 1.2, mix: { pt: [['pm_alex', 0.6], ['am_puck', 0.4]], en: [['am_puck', 0.7], ['af_sky', 0.3]] } },
};

/** O Kokoro não tem controle de emoção: a emoção muda o ritmo da fala. */
const EMOCOES = {
  neutro: 1, calmo: 0.94, alegre: 1.06, raiva: 1.08, medo: 1.12, triste: 0.88,
  sussurro: 0.9, grito: 1.1, sarcastico: 0.98, misterioso: 0.9,
};

/** Mistura e velocidade de um preset num idioma, com a emoção da fala. */
function parametros(preset, { idioma = 'pt', emocao = 'neutro', usarEmocao = true, velocidade = 1 } = {}) {
  const p = PRESETS[preset] || PRESETS['homem-maduro'];
  const mix = p.mix[idioma === 'en' ? 'en' : 'pt'];
  const vel = (p.vel || 1) * velocidade * (usarEmocao ? EMOCOES[emocao] || 1 : 1);
  return { mix, velocidade: +Math.max(0.5, Math.min(1.6, vel)).toFixed(2) };
}

module.exports = { PRESETS, EMOCOES, parametros };
