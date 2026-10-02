// Constantes do jogo compartilhadas pelo prompt do mestre, pela validação do turno e pelas pastas da campanha.

const TEMAS = {
  taverna: 'interiores acolhedores, tavernas, lareiras, descanso, conversas',
  floresta: 'matas, bosques, trilhas, natureza viva',
  masmorra: 'cavernas, calabouços, túneis, subterrâneos',
  cidade: 'vilas, cidades, mercados, cortes, política',
  batalha: 'combate em andamento, perseguições, tensão física',
  horror: 'medo, mortos-vivos, maldições, o desconhecido',
  deserto: 'areias, calor, ruínas ao sol, escassez',
  neve: 'montanhas, gelo, tundra, frio extremo',
  mar: 'navios, costa, tempestades no oceano, portos',
  arcano: 'magia, torres de magos, rituais, bibliotecas proibidas',
  celestial: 'divino, templos, milagres, esperança, vitória épica',
  inferno: 'fogo, vulcões, demônios, destruição',
  noite: 'noite aberta, furtividade, estrelas, viagens noturnas',
};

const TIPOS_EVENTO = [
  'dano', 'cura', 'mana', 'xp', 'ouro',
  'item_ganho', 'item_perdido',
  'status_add', 'status_remove',
  'atributo', 'missao', 'npc', 'lugar',
];

const ATRIBUTOS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
const NOME_ATRIBUTO = {
  forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição',
  inteligencia: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma',
};

const PERIODOS = ['amanhecer', 'dia', 'entardecer', 'noite'];

/** Emoção de cada fala do roteiro — muda a intensidade da voz sintetizada. */
const EMOCOES = ['neutro', 'calmo', 'alegre', 'raiva', 'medo', 'triste', 'sussurro', 'grito', 'sarcastico', 'misterioso'];
const IDIOMAS = { pt: 'português do Brasil', en: 'English' };

/** Schema do turno. Os enums de cena/retrato vêm do catálogo (inclui artes que você adicionar). */

// Dificuldade e ameaça prontas: o mestre escolhe a PALAVRA, o app põe os números (menos raciocínio e menos texto
// por turno, e o mesmo chefe é igualmente duro em toda campanha).
const DIFICULDADES = { facil: 8, media: 12, dificil: 15, muito_dificil: 18, heroica: 22 };
/** Vida e dano de um inimigo pela ameaça e pelo nível do herói (n). */
const AMEACAS = {
  lacaio: { nome: 'lacaio', vida: (n) => 4 + 2 * n, dano: '1d4', cd: 'facil' },
  soldado: { nome: 'soldado', vida: (n) => 8 + 4 * n, dano: '1d6+1', cd: 'media' },
  elite: { nome: 'elite', vida: (n) => 14 + 7 * n, dano: '2d6', cd: 'dificil' },
  chefe: { nome: 'chefe', vida: (n) => 30 + 15 * n, dano: '2d8+nível', cd: 'muito_dificil' },
};
const MULT_TAMANHO = { medio: 1, grande: 1.5, enorme: 2.5 };
/** Vida máxima de um inimigo (ameaça + tamanho + nível do herói). */
function vidaInimigo(ameaca, tamanho, nivel = 1) {
  const a = AMEACAS[ameaca] || AMEACAS.soldado;
  return Math.max(1, Math.round(a.vida(Math.max(1, nivel)) * (MULT_TAMANHO[tamanho] || 1)));
}
/** "dificil" → 15; número fica número. */
function dificuldadeNum(v) {
  if (v == null || v === '') return null;
  if (Number.isFinite(+v)) return +v;
  const k = String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
  return DIFICULDADES[k] ?? (/muito/.test(k) ? DIFICULDADES.muito_dificil : /heroic|lendar/.test(k) ? DIFICULDADES.heroica : /dific/.test(k) ? DIFICULDADES.dificil : /facil/.test(k) ? DIFICULDADES.facil : /medi/.test(k) ? DIFICULDADES.media : null);
}

function mod(v) {
  return Math.floor((Number(v) - 10) / 2);
}
function fmtMod(m) {
  return m >= 0 ? `+${m}` : `${m}`;
}

module.exports = { TEMAS, TIPOS_EVENTO, ATRIBUTOS, NOME_ATRIBUTO, PERIODOS, EMOCOES, IDIOMAS, DIFICULDADES, AMEACAS, MULT_TAMANHO, vidaInimigo, dificuldadeNum, mod, fmtMod };
