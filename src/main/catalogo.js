// Catálogo de artes: cenários (fundo), retratos (NPCs/heróis) e imagens de itens.
// Embutidas em renderer/assets + as SUAS artes, que entram sozinhas:
//   <pasta das campanhas>/_artes/{cenas,retratos,itens}/   → valem para todas as campanhas
//   <campanha>/artes/{cenas,retratos,itens}/               → só daquela campanha
// Regra de nome: o arquivo vira o id. Ex.: itens/espada-longa.png aparece no item "Espada Longa",
// retratos/brom.png vira o retrato do NPC "Brom", cenas/porto-negro.webp vira um cenário novo.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { slugify, readJson } = require('./util');

const EXT = /\.(png|jpe?g|webp|gif|avif)$/i;
const DIR_EMBUTIDO = path.join(__dirname, '..', '..', 'renderer', 'assets');

const CENAS = [
  { id: 'taverna', nome: 'Taverna', desc: 'interior de taverna aconchegante, lareira, canecas', temas: ['taverna'] },
  { id: 'guilda-aventureiros', nome: 'Guilda de Aventureiros', desc: 'salão da guilda, quadro de missões, aventureiros', temas: ['taverna'] },
  { id: 'cidade-mercado', nome: 'Cidade e Mercado', desc: 'rua de mercado medieval, castelo ao fundo, dia', temas: ['cidade'] },
  { id: 'vila-campestre', nome: 'Vila Campestre', desc: 'vilarejo pacífico, campos, moinho, rio, montanhas', temas: ['cidade', 'floresta'] },
  { id: 'sala-do-trono', nome: 'Sala do Trono', desc: 'castelo real, trono, estandartes, corte', temas: ['cidade', 'celestial'] },
  { id: 'porto', nome: 'Porto', desc: 'cais movimentado, navios, farol, mar aberto', temas: ['mar'] },
  { id: 'floresta-encantada', nome: 'Floresta Encantada', desc: 'mata antiga, cogumelos brilhantes, vaga-lumes, riacho', temas: ['floresta', 'arcano'] },
  { id: 'floresta-sombria', nome: 'Floresta Sombria', desc: 'árvores retorcidas, olhos vermelhos, carroça abandonada, lua', temas: ['horror', 'noite'] },
  { id: 'ruinas-antigas', nome: 'Ruínas Antigas', desc: 'ruínas de pedra, estátua colossal, círculo rúnico, cachoeiras', temas: ['arcano', 'floresta'] },
  { id: 'fortaleza-sombria', nome: 'Fortaleza Sombria', desc: 'castelo negro do vilão, tempestade, ponte, raios', temas: ['horror', 'batalha'] },
  { id: 'caverna-cristais', nome: 'Caverna de Cristais', desc: 'caverna subterrânea, cristais roxos, lago, ponte de pedra', temas: ['masmorra', 'arcano'] },
  { id: 'mina-abandonada', nome: 'Mina Abandonada', desc: 'túneis de mina, trilhos, cristais vermelhos, lanternas', temas: ['masmorra'] },
  { id: 'cemiterio', nome: 'Cemitério', desc: 'cemitério à noite, capela, lápides, névoa, lua cheia', temas: ['horror', 'noite'] },
  { id: 'montanha-nevada', nome: 'Montanha Nevada', desc: 'passo nas montanhas, neve, pinheiros, torre, cachoeira congelada', temas: ['neve'] },
  { id: 'deserto-ruinas', nome: 'Deserto e Ruínas', desc: 'dunas ao pôr do sol, estátuas antigas, caravana', temas: ['deserto'] },
  { id: 'cidade-deserto', nome: 'Cidade do Deserto', desc: 'bazar, palácio de cúpulas, fonte, palmeiras', temas: ['deserto', 'cidade'] },
  { id: 'templo-celestial', nome: 'Templo Celestial', desc: 'catedral branca e dourada, luz divina, vitrais', temas: ['celestial'] },
  { id: 'salao-infernal', nome: 'Salão Infernal', desc: 'salão demoníaco, lava, correntes, estátuas de demônios', temas: ['inferno'] },
  { id: 'campo-de-batalha', nome: 'Campo de Batalha', desc: 'campo após a guerra, armas caídas, fumaça, castelo, pôr do sol', temas: ['batalha'] },
  { id: 'acampamento', nome: 'Acampamento', desc: 'acampamento à noite, fogueira, tendas, céu estrelado', temas: ['noite'] },
  { id: 'cripta', nome: 'Cripta', desc: 'cripta subterrânea, sarcófagos, braseiros, estátuas', temas: ['masmorra', 'horror'] },
  { id: 'gruta-azul', nome: 'Gruta Azul', desc: 'caverna de cristais azuis, cachoeiras, lago subterrâneo', temas: ['masmorra', 'arcano'] },
  { id: 'templo-do-deserto', nome: 'Templo do Deserto', desc: 'templo esculpido na rocha, colunas, areia, sol forte', temas: ['deserto'] },
  { id: 'ruinas-da-floresta', nome: 'Ruínas da Floresta', desc: 'ruínas cobertas de musgo na mata, altar de pedra, luz entre árvores', temas: ['floresta', 'arcano'] },
  { id: 'acampamento-planicie', nome: 'Acampamento na Planície', desc: 'tendas de campanha, estrada de terra, colinas ao pôr do sol', temas: ['batalha', 'floresta'] },
  { id: 'passo-nevado', nome: 'Passo Nevado', desc: 'desfiladeiro gelado, pontes de corda, fortaleza nas montanhas', temas: ['neve'] },
  { id: 'pantano', nome: 'Pântano', desc: 'brejo sombrio, palafitas, árvores mortas, castelo em ruínas ao fundo', temas: ['horror', 'floresta'] },
  { id: 'salao-real', nome: 'Salão Real', desc: 'salão do trono dourado, vitrais, tapete vermelho, colunas', temas: ['cidade', 'celestial'] },
  { id: 'praca-da-cidade', nome: 'Praça da Cidade', desc: 'praça com chafariz, casas enxaimel, barracas, fim de tarde', temas: ['cidade'] },
  { id: 'fortaleza-vulcanica', nome: 'Fortaleza Vulcânica', desc: 'fortaleza negra sobre rios de lava, céu em chamas', temas: ['inferno'] },
  { id: 'mapa-mundi', nome: 'Mapa do Mundo', desc: 'mapa isométrico do continente', temas: [], especial: true },
].map((c) => ({ ...c, arquivo: `cenas/${c.id}.webp`, origem: 'embutido' }));

/** Mapas de batalha (vista de cima, em grade). Cada cenário usa o mapa mais parecido com ele. */
const MAPAS_BATALHA = ['cripta', 'gruta-azul', 'templo-do-deserto', 'ruinas-da-floresta', 'acampamento-planicie', 'passo-nevado', 'pantano', 'salao-real', 'praca-da-cidade', 'fortaleza-vulcanica'];
const BATALHA_DA_CENA = {
  taverna: 'praca-da-cidade', 'guilda-aventureiros': 'praca-da-cidade', 'cidade-mercado': 'praca-da-cidade', 'vila-campestre': 'acampamento-planicie',
  'sala-do-trono': 'salao-real', porto: 'praca-da-cidade', 'floresta-encantada': 'ruinas-da-floresta', 'floresta-sombria': 'pantano',
  'ruinas-antigas': 'ruinas-da-floresta', 'fortaleza-sombria': 'cripta', 'caverna-cristais': 'gruta-azul', 'mina-abandonada': 'gruta-azul',
  cemiterio: 'cripta', 'montanha-nevada': 'passo-nevado', 'deserto-ruinas': 'templo-do-deserto', 'cidade-deserto': 'templo-do-deserto',
  'templo-celestial': 'salao-real', 'salao-infernal': 'fortaleza-vulcanica', 'campo-de-batalha': 'acampamento-planicie', acampamento: 'acampamento-planicie',
};
const BATALHA_DO_TEMA = {
  taverna: 'praca-da-cidade', floresta: 'ruinas-da-floresta', masmorra: 'cripta', cidade: 'praca-da-cidade', batalha: 'acampamento-planicie',
  horror: 'pantano', deserto: 'templo-do-deserto', neve: 'passo-nevado', mar: 'praca-da-cidade', arcano: 'gruta-azul',
  celestial: 'salao-real', inferno: 'fortaleza-vulcanica', noite: 'acampamento-planicie',
};

// Grade de cada mapa de batalha (medida na imagem 1402×1122): x/y = posição real de cada linha da grade
// (o desenho não é uniforme, então cada quadrado é o que está pintado). zona = [coluna, linha] do canto da área de luta;
// mapa: '.' chão, '#' obstáculo (pilar, parede, água, lava, barraca, pedra), 'h' onde o herói entra. 1 quadrado = 1,5 m (5 pés).
const GRADE_BATALHA = {
  'acampamento-planicie': { x: [1,42,83,125,167,208,250,293,336,378,419,461,502,543,585,627,669,711,755,798,841,884,927,970,1013,1057,1099,1142,1185,1228,1272,1315,1358,1399], y: [2,43,85,127,171,216,260,304,348,392,436,479,523,567,612,657,702,746,790,834,879,923,967,1012,1056,1101], zona: [7, 8],
    mapa: ['##..#.##.#.....###', '##..##...#........', '#.................', '..................', '..####............', '..####............', '..................', '................##', '................##', '................##', '...h..............', '..................', '.........###......'] },
  'cripta': { x: [1,47,93,141,187,233,278,325,371,413,455,500,545,589,633,678,722,766,811,854,897,942,987,1032,1077,1123,1167,1213,1260,1306,1353,1400], y: [1,47,93,141,183,222,265,308,352,394,437,482,526,570,615,660,705,749,795,842,889,936,981,1027,1073,1120], zona: [6, 3],
    mapa: ['...............###.', '#...............##.', '....##........#....', '##..##........#....', '##..##........#....', '##.....#####.......', '##.....#####.......', '#......#####.......', '#...............###', '....##........#.###', '....##........#.###', '....##........#....', '#.................#', '.........h.........'] },
  'fortaleza-vulcanica': { x: [2,42,82,123,165,208,250,292,334,376,418,459,502,545,590,635,680,723,768,811,854,897,940,982,1023,1066,1108,1150,1192,1233,1275,1317,1359,1399], y: [2,41,82,126,170,213,257,300,343,387,429,473,519,562,605,649,694,737,781,824,868,912,955,998,1040,1083,1120], zona: [8, 5],
    mapa: ['#######...#######', '######.....######', '#######...#######', '#######...#######', '#####......######', '....##...........', '#####.......#####', '######....#######', '#######...#######', '########h########'] },
  'gruta-azul': { x: [1,44,87,130,173,216,259,302,346,389,433,477,523,568,612,656,700,745,789,834,879,924,967,1011,1054,1097,1140,1185,1228,1271,1314,1358,1400], y: [1,44,88,133,177,221,265,310,355,399,442,486,530,574,617,660,704,748,792,836,880,926,971,1016,1061,1104], zona: [1, 12],
    mapa: ['#....#####.#..##', '##..#####.......', '###.#########...', '###....######...', '##.....######...', '#.......######..', '##......######..', '###.#.......#...', '####.#....h....#'] },
  'pantano': { x: [1,42,84,126,168,212,256,299,343,389,435,481,528,573,616,660,702,744,785,827,868,910,952,994,1036,1079,1122,1165,1208,1253,1297,1341,1386], y: [2,43,84,126,168,210,251,293,335,376,418,460,501,543,584,624,666,709,751,792,833,875,916,958,1000,1041,1080,1120], zona: [10, 7],
    mapa: ['..#######....', '...##########', '#...#########', '#....########', '##...#.######', '###....###.##', '####...##..##', '#####........', '#####......##', '######....###', '######.....##', '########....#', '#########.h.#', '#########...#'] },
  'passo-nevado': { x: [2,43,84,125,168,209,251,291,332,374,416,457,498,539,579,619,661,702,741,782,823,864,904,946,987,1029,1069,1109,1149,1191,1231,1273,1315,1358,1399], y: [1,41,81,121,161,200,240,281,322,363,403,443,484,524,564,605,646,686,727,767,808,849,890,931,971,1010,1048,1084,1120], zona: [3, 3],
    mapa: ['##..####...#', '##...#......', '####.......h', '####.....###', '######...###', '####.....###', '.......#####', '........####', '....########'] },
  'praca-da-cidade': { x: [12,56,101,144,187,230,275,319,362,404,447,490,533,577,618,660,701,743,786,828,869,912,955,998,1040,1084,1127,1172,1215,1258,1300,1342,1384], y: [4,46,87,129,170,211,253,296,339,383,427,470,512,556,600,644,687,730,772,816,860,904,949,993,1036,1078,1116], zona: [5, 4],
    mapa: ['#....................', '.....................', '.........####........', '.......########......', '.......########......', '.......########......', '.......########......', '.......########......', '.......########......', '.........####........', '.....................', '.....................', '#....................', '#....................', '#.........h..........', '####.................'] },
  'ruinas-da-floresta': { x: [1,45,91,137,182,228,274,321,367,414,461,507,553,601,648,697,745,792,838,884,932,980,1028,1075,1122,1169,1217,1263,1309,1354,1400], y: [2,48,94,140,187,235,283,329,376,424,470,517,564,611,657,705,752,799,847,894,941,988,1035,1082,1120], zona: [9, 7],
    mapa: ['#.#.......#..', '####......##.', '..#......#...', '#..........##', '#..........##', '#...#..#...##', '.............', '..##.....##..', '..#......###.', '..#.......###', '..#.......###', '..#.#.h...###'] },
  'salao-real': { x: [15,59,101,143,184,225,268,312,356,399,441,485,529,573,617,660,701,741,784,828,872,916,959,1001,1045,1088,1131,1175,1217,1258,1300,1341,1382], y: [1,45,90,136,181,227,273,317,362,408,453,496,539,584,628,674,719,762,805,850,898,943,987,1031,1077,1120], zona: [7, 3],
    mapa: ['....#.......#.....', '.##............##.', '.##............##.', '###............###', '###............###', '.##............##.', '###............###', '###............###', '###............###', '.##............##.', '###............###', '###............###', '.##............##.', '#................#', '#................#', '.....#......#.....', '.....##.h..##.....'] },
  'templo-do-deserto': { x: [1,48,98,144,187,230,274,315,357,400,443,487,529,572,615,657,700,743,786,828,870,913,955,998,1041,1084,1127,1170,1213,1257,1300,1348,1400], y: [1,43,84,127,171,214,259,301,343,384,425,467,509,552,594,637,678,719,762,806,849,892,935,977,1020,1062,1106], zona: [7, 7],
    mapa: ['....##.......###.....', '.....................', '....##......##.......', '#...##......##.......', '#...##......##.....##', '..####.............##', '..####.............##', '...................##', '...................##', '....##......##.....##', '#...##......##.......', '#...##......##.......', '.#...................', '.##................##', '........h............'] },
};

const RETRATOS = [
  { id: 'guerreiro', nome: 'Guerreiro', desc: 'homem jovem, armadura, espada, cachecol vermelho' },
  { id: 'ladino-encapuzado', nome: 'Ladino', desc: 'jovem de capuz verde com adagas' },
  { id: 'maga-elfa', nome: 'Maga Elfa', desc: 'elfa de cabelo prateado, túnica azul, magia na mão' },
  { id: 'barbaro', nome: 'Bárbaro', desc: 'homem ruivo musculoso, machado, peles' },
  { id: 'paladina', nome: 'Paladina', desc: 'cavaleira loira, armadura, escudo com leão' },
  { id: 'necromante', nome: 'Necromante', desc: 'homem pálido, magia verde, crânios' },
  { id: 'vampiro', nome: 'Vampiro', desc: 'nobre vampiro de capa vermelha' },
  { id: 'arqueira', nome: 'Arqueira', desc: 'patrulheira de capa verde com arco' },
  { id: 'mercenaria', nome: 'Mercenária', desc: 'guerreira de cabelo curto, cicatriz, armadura gasta' },
  { id: 'mago-anciao', nome: 'Mago Ancião', desc: 'velho de barba branca, chapéu e cajado' },
  { id: 'rei', nome: 'Rei', desc: 'rei coroado, armadura dourada, manto vermelho' },
  { id: 'rainha', nome: 'Rainha', desc: 'rainha de cabelos negros, vestido azul' },
  { id: 'taverneiro', nome: 'Taverneiro', desc: 'homem de bigode, avental, caneca' },
  { id: 'ferreiro-anao', nome: 'Ferreiro Anão', desc: 'anão de barba ruiva com martelo' },
  { id: 'bandido', nome: 'Bandido', desc: 'bandido mascarado com lenço vermelho e adaga' },
  { id: 'cultista', nome: 'Cultista', desc: 'figura encapuzada com máscara dourada' },
  { id: 'demonio', nome: 'Demônio', desc: 'demônio de chifres, pele vermelha, fogo' },
  { id: 'anjo', nome: 'Anjo', desc: 'guerreira alada, auréola, armadura branca' },
  { id: 'orc', nome: 'Orc', desc: 'orc guerreiro de armadura com machado' },
  { id: 'goblin-mercador', nome: 'Goblin Mercador', desc: 'goblin sorridente carregando poções e bugigangas' },
  // bestiário: monstros (arte em retratos/)
  { id: 'boi-do-abismo', nome: 'Boi do Abismo', desc: 'monstro: touro demoníaco de chifres enormes e fendas em brasa', monstro: true },
  { id: 'sereia-de-cinzas', nome: 'Sereia de Cinzas', desc: 'monstro: sereia feita de fumaça e brasas', monstro: true },
  { id: 'aranha-sino', nome: 'Aranha-Sino', desc: 'monstro: aranha gigante com um sino de bronze como corpo', monstro: true },
  { id: 'bispo-das-moscas', nome: 'Bispo das Moscas', desc: 'monstro: bispo profano de muitos braços, mitra e cajado', monstro: true },
  { id: 'pastor-de-ossos', nome: 'Pastor de Ossos', desc: 'monstro: esqueleto alto com galhada, lanterna e cajado', monstro: true },
  { id: 'sapo-catedral', nome: 'Sapo-Catedral', desc: 'monstro: sapo colossal com uma catedral e sinos nas costas', monstro: true },
  { id: 'filho-da-lua-morta', nome: 'Filho da Lua Morta', desc: 'monstro: figura pálida e esguia com um eclipse no lugar da cabeça', monstro: true },
  { id: 'anjo-afogado', nome: 'Anjo Afogado', desc: 'monstro: anjo de asas encharcadas e rosto velado', monstro: true },
  { id: 'devorador-de-ecos', nome: 'Devorador de Ecos', desc: 'monstro: humanoide magro com uma boca de dentes no lugar da cabeça', monstro: true },
  { id: 'cervo-de-vidro', nome: 'Cervo de Vidro', desc: 'monstro: cervo de cristal com galhada de vidro e coração de luz', monstro: true },
  { id: 'homem-colmeia', nome: 'Homem-Colmeia', desc: 'monstro: humanoide feito de favos de cera dourada', monstro: true },
  { id: 'cavaleiro-oco', nome: 'Cavaleiro Oco', desc: 'monstro: armadura negra vazia e espinhosa com espadão', monstro: true },
  { id: 'relogio-faminto', nome: 'Relógio Faminto', desc: 'monstro: autômato de relógio com máscara de porcelana e garras', monstro: true },
  { id: 'devorador-de-luz', nome: 'Devorador de Luz', desc: 'monstro: fera de sombra retorcida e sorriso branco', monstro: true },
  { id: 'cao-de-muitas-sombras', nome: 'Cão de Muitas Sombras', desc: 'monstro: lobo gigante envolto em sombras', monstro: true },
  { id: 'viuva-da-nevoa', nome: 'Viúva da Névoa', desc: 'monstro: espectro feminino de névoa e cabelos longos', monstro: true },
  { id: 'carnical-de-porcelana', nome: 'Carniçal de Porcelana', desc: 'monstro: morto-vivo de pele de porcelana rachada e máscara', monstro: true },
  { id: 'rainha-dos-vermes-dourados', nome: 'Rainha dos Vermes Dourados', desc: 'monstro: rainha de coroa cujo vestido é feito de vermes de ouro', monstro: true },
  { id: 'boca-do-pantano', nome: 'Boca do Pântano', desc: 'monstro: massa de lodo e musgo com uma bocarra de dentes', monstro: true },
  { id: 'arvore-andante', nome: 'Árvore Andante', desc: 'monstro: árvore morta que anda, olhos verdes no tronco', monstro: true },
  // elenco de NPCs nomeados (corpo inteiro em npcs/, busto em retratos/)
  { id: 'alaric-dorne', nome: "Alaric Dorne", funcao: "Arqueólogo", desc: "arqueólogo: homem de barba, casaco de couro, examina uma relíquia", corpo: true },
  { id: 'aldren-valcor', nome: "Aldren Valcor", funcao: "Capitão da Guarda", desc: "capitão da guarda: capitão grisalho de armadura com leão e capa vermelha", corpo: true },
  { id: 'alistair-vane', nome: "Alistair Vane", funcao: "Conselheiro Real", desc: "conselheiro real: conselheiro idoso e esguio de túnica azul bordada", corpo: true },
  { id: 'barnabas', nome: "Barnabas", funcao: "Marinheiro", desc: "marinheiro: velho marujo de barba branca, camisa listrada e cordas", corpo: true },
  { id: 'borin-martelo-negro', nome: "Borin Martelo-Negro", funcao: "Ferreiro", desc: "ferreiro: anão ferreiro careca, barba trançada, martelo enorme", corpo: true },
  { id: 'bromir', nome: "Bromir", funcao: "Chefe Bandido", desc: "chefe bandido: líder de bandidos de lenço vermelho, armadura remendada e cimitarra", corpo: true },
  { id: 'celestine', nome: "Celestine", funcao: "Curandeira", desc: "curandeira: jovem curandeira de túnica branca com luz sagrada na mão", corpo: true },
  { id: 'draven', nome: "Draven", funcao: "General", desc: "general: general veterano grisalho de armadura escura e espadão", corpo: true },
  { id: 'edric-iv', nome: "Edric IV", funcao: "Rei", desc: "rei: rei coroado de barba, armadura dourada e manto de arminho", corpo: true },
  { id: 'elayne', nome: "Elayne", funcao: "Princesa", desc: "princesa: princesa loira de trança, vestido azul e branco", corpo: true },
  { id: 'eryndor', nome: "Eryndor", funcao: "Embaixador Élfico", desc: "embaixador élfico: elfo de cabelos prateados, trajes azul e branco, pergaminho", corpo: true },
  { id: 'eveline-ravencroft', nome: "Eveline Ravencroft", funcao: "Nobre", desc: "nobre: dama de cabelos negros, vestido vermelho e preto gótico", corpo: true },
  { id: 'fenrik', nome: "Fenrik", funcao: "Caçador", desc: "caçador: caçador ruivo de barba, capa verde de peles e arco", corpo: true },
  { id: 'garrick-barrilvelho', nome: "Garrick Barrilvelho", funcao: "Taberneiro", desc: "taberneiro: taberneiro corpulento e sorridente com caneca de cerveja e avental", corpo: true },
  { id: 'grum', nome: "Grum", funcao: "Mercenário", desc: "mercenário: mercenário orc de armadura pesada com maça cravejada", corpo: true },
  { id: 'helena-voss', nome: "Helena Voss", funcao: "Estalajadeira", desc: "estalajadeira: estalajadeira ruiva de avental, chaves e livro de registros", corpo: true },
  { id: 'homem-sem-nome', nome: "O Homem Sem Nome", funcao: "Estranho", desc: "estranho: figura encapuzada de rosto oculto em trapos cinzentos", corpo: true },
  { id: 'kaara-sangue-frio', nome: "Kaara Sangue-Frio", funcao: "Mercenária", desc: "mercenária: mercenária de cabelo curto, armadura de couro e espada", corpo: true },
  { id: 'kharza', nome: "Kharza", funcao: "Embaixadora Draconata", desc: "embaixadora draconata: draconata de escamas douradas, túnica vermelha e cetro", corpo: true },
  { id: 'lucius-morn', nome: "Lucius Morn", funcao: "Inquisidor", desc: "inquisidor: inquisidor pálido de cabelo negro, sobretudo vermelho e preto", corpo: true },
  { id: 'malrec', nome: "Malrec", funcao: "Líder Cultista", desc: "líder cultista: cultista careca com runa na testa, túnica vermelha e magia de sangue", corpo: true },
  { id: 'mara-flint', nome: "Mara Flint", funcao: "Guarda", desc: "guarda: guarda jovem de lança e escudo azul", corpo: true },
  { id: 'mathias', nome: "Mathias", funcao: "Sacerdote", desc: "sacerdote: sacerdote idoso de barba branca, hábito e cruz", corpo: true },
  { id: 'mira-vell', nome: "Mira Vell", funcao: "Capitã Pirata", desc: "capitã pirata: capitã pirata ruiva de tricórnio, sabre e pistola", corpo: true },
  { id: 'miriel-folha-serena', nome: "Miriel Folha-Serena", funcao: "Herbalista", desc: "herbalista: elfa herbalista de cabelos claros e manto verde com ervas", corpo: true },
  { id: 'morwenna', nome: "Morwenna", funcao: "Bruxa do Pântano", desc: "bruxa do pântano: bruxa velha de cabelos desgrenhados, trapos e magia verde", corpo: true },
  { id: 'nessa-lua-clara', nome: "Nessa Lua-Clara", funcao: "Vidente", desc: "vidente: vidente de pele lilás com cartas de tarô", corpo: true },
  { id: 'nymera', nome: "Nymera", funcao: "Cultista", desc: "cultista: cultista encapuzada de máscara, adaga ritual", corpo: true },
  { id: 'orren', nome: "Orren", funcao: "Bibliotecário Arcano", desc: "bibliotecário arcano: velho mago de barba longa com grimório flutuante", corpo: true },
  { id: 'orwyn', nome: "Orwyn", funcao: "Arquidruida", desc: "arquidruida: druida ancião de chifres, coberto de musgo, cajado vivo", corpo: true },
  { id: 'pipik-moeda-rapida', nome: "Pipik Moeda-Rápida", funcao: "Mercador Goblin", desc: "mercador goblin: goblin mercador com mochila cheia de bugigangas e poções", corpo: true },
  { id: 'rikkit', nome: "Rikkit", funcao: "Guia Goblin", desc: "guia goblin: goblin guia com mapa, lanterna e lança", corpo: true },
  { id: 'severin', nome: "Severin", funcao: "Carrasco", desc: "carrasco: carrasco encapuzado de preto com machado ensanguentado", corpo: true },
  { id: 'silas-corvo', nome: "Silas Corvo", funcao: "Contrabandista", desc: "contrabandista: contrabandista elegante de cabelo negro e casaco longo", corpo: true },
  { id: 'thrag-pedranegra', nome: "Thrag Pedranegra", funcao: "Chefe Orc", desc: "chefe orc: chefe orc de tranças brancas, peles e machado de guerra", corpo: true },
  { id: 'tomas-rato', nome: "Tomás Rato", funcao: "Ladrão", desc: "ladrão: ladrão jovem e magro de capuz com adaga", corpo: true },
  { id: 'varek-mao-cinza', nome: "Varek Mão-Cinza", funcao: "Caçador de Recompensas", desc: "caçador de recompensas: caçador de recompensas de barba, besta e cartaz de procurado", corpo: true },
  { id: 'velkan-morten', nome: "Velkan Morten", funcao: "Necromante", desc: "necromante: necromante de cabelos negros, fantasmas verdes e cajado de crânio", corpo: true },
  { id: 'vellin', nome: "Vellin", funcao: "Pesquisador Arcano", desc: "pesquisador arcano: velho excêntrico de óculos, livros e cristal roxo", corpo: true },
  { id: 'ysara-veu-negro', nome: "Ysara Véu-Negro", funcao: "Informante", desc: "informante: informante de cabelos negros com mecha branca, sobretudo vinho", corpo: true },
].map((r) => ({ ...r, arquivo: `retratos/${r.id}.webp`, ...(r.corpo ? { corpo: `npcs/${r.id}.webp` } : {}), origem: 'embutido' }));


// Itens com arte própria. O Mestre conhece esta lista e pode dar esses itens pelo nome exato.
// "apelidos": outros nomes que usam a mesma imagem. "familia": palavras que usam esta arte como genérica.
const ITENS = [
  { id: 'espada-longa', nome: 'Espada Longa', raridade: 'comum', pasta: 'armas', icone: '🗡️', desc: '1d8 de dano cortante. Aço honesto, bem balanceado.', familia: ['espada', 'sabre', 'rapieira', 'cimitarra', 'montante'] },
  { id: 'adaga-do-viajante', nome: 'Adaga do Viajante', raridade: 'comum', pasta: 'armas', icone: '🔪', desc: '1d4 perfurante. Companheira simples de estrada.', familia: ['adaga', 'punhal', 'faca', 'adagas'] },
  { id: 'machado-do-lenhador', nome: 'Machado do Lenhador', raridade: 'comum', pasta: 'armas', icone: '🪓', desc: '1d8 cortante. Feito para árvores, serve para ossos.', familia: ['machado', 'machadinha'] },
  { id: 'escudo-de-carvalho', nome: 'Escudo de Carvalho', raridade: 'comum', pasta: 'armaduras', icone: '🛡️', desc: '+2 de defesa. Madeira reforçada com ferro.', familia: ['escudo', 'broquel'] },
  { id: 'manto-do-aprendiz', nome: 'Manto do Aprendiz', raridade: 'comum', pasta: 'armaduras', icone: '🧥', desc: 'Tecido grosso com capuz. Esconde mais do que protege.', familia: ['manto', 'capa', 'tunica', 'robe', 'veste', 'capuz'] },
  { id: 'pocao-de-vida-menor', nome: 'Poção de Vida Menor', raridade: 'comum', pasta: 'consumiveis', icone: '🧪', desc: 'Recupera 2d4+2 de vida.', apelidos: ['pocao-de-cura', 'pocao-de-vida', 'pocao-de-cura-menor'], familia: ['pocao de cura', 'pocao de vida', 'elixir', 'pocao'] },
  { id: 'pocao-de-mana', nome: 'Poção de Mana', raridade: 'incomum', pasta: 'consumiveis', icone: '🔮', desc: 'Recupera 6 de mana.', familia: ['pocao de mana', 'elixir arcano'] },
  { id: 'arco-folha-verde', nome: 'Arco Folha-Verde', raridade: 'incomum', pasta: 'armas', icone: '🏹', desc: '1d8 perfurante. Madeira élfica que nunca empena.', familia: ['arco', 'arco longo', 'arco curto'] },
  { id: 'espada-do-vigia', nome: 'Espada do Vigia', raridade: 'incomum', pasta: 'armas', icone: '🗡️', desc: '1d8+1 cortante. Arma dos guardas da muralha.' },
  { id: 'anel-de-cinzas', nome: 'Anel de Cinzas', raridade: 'incomum', pasta: 'acessorios', icone: '💍', desc: 'Aquece ao toque. Resistência a fogo.', familia: ['anel'] },
  { id: 'botas-do-batedor', nome: 'Botas do Batedor', raridade: 'incomum', pasta: 'armaduras', icone: '🥾', desc: '+2 em furtividade; passos silenciosos.', familia: ['bota', 'botas'] },
  { id: 'cajado-runico', nome: 'Cajado Rúnico', raridade: 'raro', pasta: 'armas', icone: '🪄', desc: 'Canaliza feitiços: +1 em magias. 1d6 contundente.', familia: ['cajado', 'bastao', 'varinha', 'cetro'] },
  { id: 'lamina-da-lua', nome: 'Lâmina da Lua', raridade: 'raro', pasta: 'armas', icone: '🌙', desc: 'Curva e prateada. +1d6 contra criaturas da noite.' },
  { id: 'armadura-do-grifo', nome: 'Armadura do Grifo', raridade: 'raro', pasta: 'armaduras', icone: '🦅', desc: '+4 de defesa. Placas gravadas com asas de grifo.', familia: ['armadura', 'peitoral', 'cota'] },
  { id: 'grimorio-das-sombras', nome: 'Grimório das Sombras', raridade: 'raro', pasta: 'itens-chave', icone: '📕', desc: 'Sussurra feitiços proibidos a quem o lê à meia-noite.', familia: ['grimorio', 'tomo', 'livro de feiticos'] },
  { id: 'olho-do-oraculo', nome: 'Olho do Oráculo', raridade: 'raro', pasta: 'acessorios', icone: '🧿', desc: 'Amuleto que revela mentiras: +2 em Sabedoria (Intuição).', familia: ['amuleto', 'colar', 'pingente'] },
  { id: 'espada-sangrenta-de-vharos', nome: 'Espada Sangrenta de Vharos', raridade: 'epico', pasta: 'armas', icone: '🩸', desc: 'Bebe o sangue que derrama: cura 2 a cada acerto.' },
  { id: 'arco-da-cacada-eterna', nome: 'Arco da Caçada Eterna', raridade: 'epico', pasta: 'armas', icone: '🏹', desc: 'Vinhas vivas na corda. A presa marcada não escapa.' },
  { id: 'coroa-do-rei-sem-nome', nome: 'Coroa do Rei Sem Nome', raridade: 'epico', pasta: 'itens-chave', icone: '👑', desc: 'Quem a usa é obedecido pelos mortos… e esquecido pelos vivos.', familia: ['coroa', 'diadema', 'tiara'] },
  { id: 'mascara-do-herege', nome: 'Máscara do Herege', raridade: 'epico', pasta: 'reliquias', icone: '🎭', desc: 'Oculta a identidade e permite falar com vozes que não são suas.', familia: ['mascara'] },
  { id: 'cajado-de-veldarim', nome: "Cajado de Vel'Darim", raridade: 'lendario', pasta: 'armas', icone: '🪄', desc: 'Relíquia dos arquimagos de Vel\'Darim. +3 em magias.', apelidos: ['cajado-de-vel-darim'] },
  { id: 'lamina-do-rei-morto', nome: 'Lâmina do Rei Morto', raridade: 'lendario', pasta: 'armas', icone: '⚔️', desc: 'Espada de um rei que se recusou a morrer. Fere espíritos.' },
  { id: 'armadura-do-primeiro-guardiao', nome: 'Armadura do Primeiro Guardião', raridade: 'lendario', pasta: 'armaduras', icone: '🛡️', desc: '+6 de defesa. Brilha quando o portador protege alguém.' },
  { id: 'coracao-do-dragao-antigo', nome: 'Coração do Dragão Antigo', raridade: 'lendario', pasta: 'reliquias', icone: '❤️‍🔥', desc: 'Ainda pulsa. Concede um sopro de fogo por dia.' },
  { id: 'a-ultima-luz', nome: 'A Última Luz', raridade: 'mitico', pasta: 'armas', icone: '✨', desc: 'Forjada da última estrela caída. Nenhuma treva resiste a ela.', apelidos: ['ultima-luz'] },
  { id: 'ampulheta-do-fim', nome: 'Ampulheta do Fim', raridade: 'mitico', pasta: 'reliquias', icone: '⏳', desc: 'Contém a areia dos últimos instantes do mundo. Para o tempo por um suspiro.', familia: ['ampulheta'] },
  { id: 'coracao-do-abismo', nome: 'Coração do Abismo', raridade: 'mitico', pasta: 'reliquias', icone: '🖤', desc: 'Um fragmento do vazio. Oferece poder a quem aceita perder algo.' },
  { id: 'olho-de-veldarim', nome: "Olho de Vel'Darim", raridade: 'mitico', pasta: 'reliquias', icone: '👁️', desc: 'Vê tudo o que já aconteceu nas terras de Vel\'Darim.', apelidos: ['olho-de-vel-darim'] },
].map((i) => ({ ...i, arquivo: `itens/${i.id}.webp`, origem: 'embutido' }));

const TEMA_PADRAO = {
  taverna: 'taverna', floresta: 'floresta-encantada', masmorra: 'mina-abandonada', cidade: 'cidade-mercado',
  batalha: 'campo-de-batalha', horror: 'cemiterio', deserto: 'deserto-ruinas', neve: 'montanha-nevada',
  mar: 'porto', arcano: 'caverna-cristais', celestial: 'templo-celestial', inferno: 'salao-infernal', noite: 'acampamento',
};

async function lerPastaArtes(base, origem) {
  const out = { cenas: [], retratos: [], itens: {} };
  for (const tipo of ['cenas', 'retratos', 'itens']) {
    const dir = path.join(base, tipo);
    let arquivos = [];
    try {
      arquivos = (await fsp.readdir(dir)).filter((f) => EXT.test(f));
    } catch { continue; }
    const meta = (await readJson(path.join(dir, `${tipo}.json`), {})) || {};
    for (const f of arquivos) {
      const id = slugify(f.replace(EXT, ''));
      const m = meta[id] || {};
      const entrada = { id, nome: m.nome || id.replace(/-/g, ' '), desc: m.desc || '', temas: m.temas || [], arquivo: `${tipo}/${f}`, origem };
      if (tipo === 'itens') out.itens[id] = entrada;
      else out[tipo].push(entrada);
    }
  }
  return out;
}

async function garantirPastaUsuario(root) {
  const base = path.join(root, '_artes');
  for (const t of ['cenas', 'retratos', 'itens']) await fsp.mkdir(path.join(base, t), { recursive: true }).catch(() => {});
  const leia = path.join(base, 'LEIA-ME.md');
  if (!fs.existsSync(leia)) {
    await fsp.writeFile(leia, `# Suas artes

Solte imagens (.png, .jpg, .webp) aqui e o Crônicas usa sozinho — o NOME do arquivo é o que liga a arte:

- \`cenas/porto-negro.png\` → novo cenário que o Mestre pode escolher (id "porto-negro")
- \`retratos/brom.png\` → retrato do NPC chamado "Brom" (ou use como retrato do herói)
- \`itens/espada-longa.png\` → ícone do item "Espada Longa" (no lugar do emoji)

Descrições opcionais (ajudam o Mestre a escolher a cena certa): crie \`cenas/cenas.json\`:

\`\`\`json
{ "porto-negro": { "nome": "Porto Negro", "desc": "porto pirata à noite, navios queimando", "temas": ["mar", "noite"] } }
\`\`\`

Uma campanha também pode ter a própria pasta \`artes/\` com a mesma estrutura.
`, 'utf8').catch(() => {});
  }
  return base;
}

/** Monta o catálogo completo (embutido + usuário + campanha). Arquivos do usuário sobrescrevem ids iguais. */
async function montar(rootCampanhas, dirCampanha) {
  const cat = { cenas: [...CENAS], retratos: [...RETRATOS], itens: {}, temaPadrao: TEMA_PADRAO };
  for (const it of ITENS) {
    cat.itens[it.id] = it;
    for (const a of it.apelidos || []) cat.itens[a] = it;
  }
  const extras = [];
  if (rootCampanhas) extras.push(await lerPastaArtes(await garantirPastaUsuario(rootCampanhas), 'usuario'));
  if (dirCampanha) extras.push(await lerPastaArtes(path.join(dirCampanha, 'artes'), 'campanha'));
  for (const ex of extras) {
    for (const tipo of ['cenas', 'retratos']) {
      for (const e of ex[tipo]) {
        const i = cat[tipo].findIndex((x) => x.id === e.id);
        if (i >= 0) cat[tipo][i] = { ...cat[tipo][i], ...e, corpo: undefined, temas: e.temas.length ? e.temas : cat[tipo][i].temas, desc: e.desc || cat[tipo][i].desc };
        else cat[tipo].push(e);
      }
    }
    Object.assign(cat.itens, ex.itens);
  }
  return cat;
}

/** URL servida pelo protocolo arte:// (ver main.js). */
function url(entrada, slugCampanha) {
  const raiz = entrada.origem === 'campanha' ? `campanha/${encodeURIComponent(slugCampanha)}` : entrada.origem;
  return `arte://${raiz}/${entrada.arquivo.split('/').map(encodeURIComponent).join('/')}`;
}

/** Resolve arte://host/caminho → arquivo no disco, sem sair das raízes permitidas. */
function resolverUrl(u, rootCampanhas) {
  const p = new URL(u);
  const partes = decodeURIComponent(p.pathname).replace(/^\/+/, '').split('/');
  let base;
  if (p.host === 'embutido') base = DIR_EMBUTIDO;
  else if (p.host === 'usuario') base = path.join(rootCampanhas, '_artes');
  else if (p.host === 'campanha') base = path.join(rootCampanhas, slugify(partes.shift()), 'artes');
  else return null;
  const alvo = path.resolve(base, ...partes);
  if (!alvo.startsWith(path.resolve(base) + path.sep)) return null;
  return alvo;
}

function comUrls(cat, slugCampanha) {
  const mapa = (e) => ({ ...e, url: url(e, slugCampanha), ...(e.corpo ? { corpoUrl: url({ ...e, arquivo: e.corpo, origem: 'embutido' }, slugCampanha) } : {}) });
  const itens = {};
  for (const [k, v] of Object.entries(cat.itens)) itens[k] = mapa(v);
  const familias = ITENS.filter((i) => i.familia).map((i) => ({ palavras: i.familia, url: itens[i.id]?.url || url(i) }));
  const batalha = Object.fromEntries(MAPAS_BATALHA.map((id) => [id, url({ arquivo: `batalha/${id}.webp`, origem: 'embutido' })]));
  return { cenas: cat.cenas.map(mapa), retratos: cat.retratos.map(mapa), itens, familias, temaPadrao: cat.temaPadrao, batalha, batalhaGrade: GRADE_BATALHA, batalhaDaCena: BATALHA_DA_CENA, batalhaDoTema: BATALHA_DO_TEMA };
}

module.exports = { CENAS, RETRATOS, ITENS, TEMA_PADRAO, MAPAS_BATALHA, BATALHA_DA_CENA, GRADE_BATALHA, montar, comUrls, resolverUrl };
