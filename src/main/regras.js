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

function mod(v) {
  return Math.floor((Number(v) - 10) / 2);
}
function fmtMod(m) {
  return m >= 0 ? `+${m}` : `${m}`;
}

module.exports = { TEMAS, TIPOS_EVENTO, ATRIBUTOS, NOME_ATRIBUTO, PERIODOS, EMOCOES, IDIOMAS, mod, fmtMod };
