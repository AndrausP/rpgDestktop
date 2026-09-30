// Lado da interface do catálogo de artes: resolve cenário, retratos e ícones de itens.
// Tudo tem fallback: sem imagem → emoji. Quando você trouxer imagens novas, basta soltar
// nas pastas _artes/ (ver LEIA-ME lá dentro) com o nome certo que elas aparecem aqui.

let cat = { cenas: [], retratos: [], itens: {}, familias: [], temaPadrao: {} };

export async function carregarCatalogo(slug = null) {
  try {
    cat = await window.rpg.catalogo.ler(slug);
  } catch (e) {
    console.error('catálogo', e);
  }
  return cat;
}
export const catalogo = () => cat;

export function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const urlCena = (id) => cat.cenas.find((c) => c.id === id)?.url || null;
export const cenaDoTema = (tema) => urlCena(cat.temaPadrao?.[tema]);
export const urlRetrato = (id) => cat.retratos.find((r) => r.id === id)?.url || null;
/** Arte de corpo inteiro (fundo transparente) do elenco de NPCs, quando existe. */
export const urlCorpo = (id) => cat.retratos.find((r) => r.id === id)?.corpoUrl || null;

// ── NPCs ──
const ANIMAIS = [
  [/lobo|warg|cao|cachorro/, '🐺'], [/esquelet|caveira|morto-vivo|zumbi/, '💀'], [/drag(a|ã)o|serpe|wyvern/, '🐉'],
  [/aranha/, '🕷️'], [/rato|ratazana/, '🐀'], [/urso/, '🐻'], [/serpente|cobra|naga/, '🐍'], [/fantasma|espectro|espirito|alma/, '👻'],
  [/corvo|ave|passaro|harpia/, '🦅'], [/morcego/, '🦇'], [/javali/, '🐗'], [/cavalo|egua/, '🐴'], [/gato|pantera|tigre|leao/, '🐈‍⬛'],
  [/gosma|slime|lodo/, '🟢'], [/golem|gargula/, '🗿'], [/polvo|kraken|lula/, '🐙'], [/tubarao/, '🦈'],
];
const RETRATO_POR_PALAVRA = [
  // funções com rosto próprio no elenco de NPCs (vêm antes das genéricas)
  [/estalajadeira|hospedeira/, 'helena-voss'], [/sacerdote|padre|monge|abade/, 'mathias'], [/curandeir|parteira/, 'celestine'],
  [/general|marechal|comandante do exercito/, 'draven'], [/bruxa|feiticeira do pantano/, 'morwenna'], [/vidente|cartomante|adivinh|oraculo/, 'nessa-lua-clara'],
  [/carrasco|verdugo|torturador/, 'severin'], [/marinheir|marujo|pescador/, 'barnabas'], [/contrabandist|atravessador/, 'silas-corvo'],
  [/informante|espia\b/, 'ysara-veu-negro'], [/herbalist|boticaria|erveira/, 'miriel-folha-serena'], [/druida/, 'orwyn'],
  [/bibliotecari|escriba|arquivista/, 'orren'], [/inquisidor|cacador de bruxas/, 'lucius-morn'], [/embaixador|diplomata|emissario/, 'eryndor'],
  [/draconat|homem-dragao/, 'kharza'], [/capita pirata|pirata/, 'mira-vell'], [/cacador de recompensa/, 'varek-mao-cinza'],
  [/arqueolog|explorador/, 'alaric-dorne'], [/conselheir|chanceler|vizir/, 'alistair-vane'], [/guia/, 'rikkit'], [/chefe orc|chefe dos orcs/, 'thrag-pedranegra'],
  [/princesa/, 'elayne'], [/estranho|misterioso|sem nome/, 'homem-sem-nome'],
  [/taverneir|estalajade|dono da taverna|cervejeir/, 'taverneiro'], [/\brei\b|monarca|imperador|lorde/, 'rei'], [/rainha|princesa|imperatriz|dama|nobre/, 'rainha'],
  [/ferreir|anao|ana\b|minerador/, 'ferreiro-anao'], [/bandid|ladra?o|salteador|assassin|mascarado|pirata/, 'bandido'], [/cultist|seita|encapuzado sombrio|inquisidor/, 'cultista'],
  [/demoni|diab|infernal|imp\b/, 'demonio'], [/anjo|serafi|celestial|arcanj/, 'anjo'], [/\borc|orque|troll|ogro/, 'orc'], [/goblin|kobold|mercador|comerciante|vendedor/, 'goblin-mercador'],
  [/vampir|conde/, 'vampiro'], [/necromant|lich|bruxo/, 'necromante'], [/maga\b|feiticeira|elfa|druida/, 'maga-elfa'], [/mago|feiticeir|arquimago|sabio|erudito|velho/, 'mago-anciao'],
  [/barbar|berserk|viking/, 'barbaro'], [/paladin|cavaleira|clerig|sacerdotisa|irma\b|freira/, 'paladina'], [/arqueir|cacador|cacadora|patrulh|guarda-florestal/, 'arqueira'],
  [/capita\b|mercenari|guerreira|soldada|capitã/, 'mercenaria'], [/guarda|soldado|guerreiro|capitao|sargento|cavaleiro|comandante/, 'guerreiro'],
  [/ladin|espia|capuz|batedor|mensageiro/, 'ladino-encapuzado'],
];

/** Id do retrato do NPC: arquivo com o nome dele → escolhido pelo mestre → elenco pelo 1º nome → palpite pela descrição. */
export function idRetratoNpc(npc) {
  if (!npc) return null;
  const porNome = slugify(npc.nome);
  if (urlRetrato(porNome)) return porNome;
  if (npc.retrato && urlRetrato(npc.retrato)) return npc.retrato;
  // "Borin" ou "o Homem Sem Nome" → personagem do elenco com esse nome
  const tokens = porNome.split('-').filter((t) => t.length > 2 && !['o', 'a', 'os', 'as', 'dom', 'dona', 'senhor', 'senhora', 'capitao', 'capita', 'mestre'].includes(t));
  const doElenco = cat.retratos.find((r) => r.corpoUrl && (r.id === tokens.join('-') || (tokens.length === 1 && r.id.split('-')[0] === tokens[0])));
  if (doElenco) return doElenco.id;
  const txt = norm(`${npc.nome} ${npc.descricao || ''}`);
  if (ANIMAIS.some(([re]) => re.test(txt))) return null;
  const achado = RETRATO_POR_PALAVRA.find(([re]) => re.test(txt));
  return achado ? achado[1] : null;
}
export function retratoNpc(npc) {
  return urlRetrato(idRetratoNpc(npc));
}
export function corpoNpc(npc) {
  return urlCorpo(idRetratoNpc(npc));
}
export function emojiNpc(npc) {
  const txt = norm(`${npc?.nome} ${npc?.descricao || ''}`);
  return ANIMAIS.find(([re]) => re.test(txt))?.[1] || (npc?.relacao === 'hostil' ? '👹' : '👤');
}

// ── itens ──
const EMOJI_ITEM = [
  [/pocao de mana|mana/, '🔮'], [/pocao|elixir|frasco|tonico/, '🧪'], [/hidromel|cerveja|caneca|rum/, '🍺'], [/vinho/, '🍷'],
  [/espada|lamina|sabre|rapieira|cimitarra/, '🗡️'], [/adaga|punhal|faca/, '🔪'], [/machado/, '🪓'], [/arco\b|besta/, '🏹'], [/flecha|virote|municao/, '➶'],
  [/cajado|bastao|varinha|cetro/, '🪄'], [/martelo|maca|clava|mangual/, '🔨'], [/lanca|tridente|alabarda/, '🔱'], [/escudo/, '🛡️'],
  [/elmo|capacete/, '⛑️'], [/cota|armadura|peitoral|gibao|couro|escamas/, '🥋'], [/manto|capa|tunica|robe|veste/, '🧥'], [/bota|sapato/, '🥾'], [/luva|manopla/, '🧤'],
  [/anel/, '💍'], [/amuleto|colar|medalh|pingente|simbolo sagrado|rosario/, '📿'], [/grimorio|livro|tomo|diario/, '📕'], [/mapa/, '🗺️'],
  [/pergaminho|carta|bilhete|contrato/, '📜'], [/chave/, '🗝️'], [/gazua|ferramenta|kit de ladr/, '🧰'], [/moeda|ouro|prata/, '🪙'],
  [/gema|cristal|joia|diamante|rubi|safira|esmeralda/, '💎'], [/bomba|fumaca|explosiv/, '💣'], [/tocha|lanterna|vela|lampiao/, '🔦'],
  [/corda/, '🪢'], [/alaude|lira|flauta|instrumento|harpa/, '🪕'], [/agua benta|agua/, '💧'], [/erva|kit de ervas|folha|raiz|flor/, '🌿'],
  [/pao|racao|comida|queijo|maca\b|fruta/, '🍞'], [/carne|presunto/, '🍖'], [/osso/, '🦴'], [/cranio|caveira/, '💀'], [/sino/, '🔔'], [/olho/, '👁️'],
  [/pena/, '🪶'], [/bolsa|saco|mochila/, '👝'], [/relogio|ampulheta/, '⏳'], [/dente|garra|presa/, '🦷'], [/estatueta|idolo/, '🗿'],
];
const EMOJI_PASTA = {
  armas: '⚔️', armaduras: '🛡️', consumiveis: '🧪', 'itens-chave': '🗝️', diversos: '📦', pergaminhos: '📜',
  municao: '🏹', ferramentas: '🧰', ingredientes: '🌿', reliquias: '💎', tesouros: '💰', livros: '📚', mapas: '🗺️',
};
export const emojiPasta = (p) => EMOJI_PASTA[p] || '📁';

export const RARIDADES = {
  comum: { nome: 'Comum', cor: '#b8b8b8' }, incomum: { nome: 'Incomum', cor: '#4fd17a' }, raro: { nome: 'Raro', cor: '#4aa3ff' },
  epico: { nome: 'Épico', cor: '#b36bff' }, lendario: { nome: 'Lendário', cor: '#ffab2e' }, mitico: { nome: 'Mítico', cor: '#ff4d6d' },
};
/** Dados do catálogo para um item com arte (raridade/descrição oficiais). */
export const itemDoCatalogo = (nome) => cat.itens?.[slugify(nome)] || null;

/** {img} se houver imagem, senão {emoji}. Ordem: campo "imagem" → nome exato/apelido → arte genérica da família → emoji. */
export function iconeItem(item) {
  const exata = cat.itens?.[slugify(item.imagem || '')]?.url || cat.itens?.[slugify(item.nome)]?.url;
  if (exata) return { img: exata };
  const n = norm(item.nome);
  let fam = null;
  let melhor = 0;
  for (const f of cat.familias || []) {
    for (const p of f.palavras) {
      if (p.length > melhor && new RegExp(`(^|\\s)${p}(\\s|$)`).test(n)) { fam = f; melhor = p.length; }
    }
  }
  if (fam) return { img: fam.url, generica: true };
  if (item.icone) return { emoji: item.icone };
  const achado = EMOJI_ITEM.find(([re]) => re.test(n));
  return { emoji: achado ? achado[1] : emojiPasta(item.pasta) };
}
export function iconeItemHtml(item, cls = '') {
  const ic = iconeItem(item);
  return ic.img ? `<img class="ic-item ${cls}" src="${ic.img}" alt="">` : `<span class="ic-item emoji ${cls}">${ic.emoji}</span>`;
}
