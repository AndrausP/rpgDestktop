// Mestre de demonstração (offline, sem IA). Serve pra testar a interface, as pastas e os temas.
const { norm } = require('../util');

const pendente = new Map(); // slug → contexto da última rolagem pedida

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const INIMIGOS = [
  { nome: 'Bandido Mascarado', desc: 'Salteador de estrada', retrato: 'bandido', vidaMax: 12 },
  { nome: 'Bromir', desc: 'Chefe dos bandidos da estrada', retrato: 'bromir', vidaMax: 16 },
  { nome: 'Orc Saqueador', desc: 'Orc brutal com machado', retrato: 'orc', vidaMax: 18 },
  { nome: 'Lobo Sombrio', desc: 'Lobo de olhos vermelhos', vidaMax: 14 },
  { nome: 'Cultista do Sino', desc: 'Fanático mascarado', retrato: 'cultista', vidaMax: 10 },
];

const CENAS = [
  {
    tema: 'floresta', cena: 'floresta-encantada', local: 'Bosque de Umbraval', capitulo: 'A Trilha dos Sussurros',
    texto: 'As árvores se fecham sobre você como uma catedral viva. Vaga-lumes desenham caminhos no ar úmido, e em algum lugar à frente um galho estala — pesado demais para ser de um animal pequeno.\n\nEntre as raízes, você nota **pegadas de botas** misturadas a marcas de garras.',
    eventos: [{ tipo: 'lugar', nome: 'Bosque de Umbraval', descricao: 'Floresta antiga ao norte da vila' }],
    sugestoes: ['Seguir as pegadas', 'Subir numa árvore', 'Chamar quem está aí'],
  },
  {
    tema: 'masmorra', cena: 'caverna-cristais', local: 'Cripta do Sino', capitulo: 'Sob a Pedra',
    texto: 'A escadaria desce em espiral até um salão de pedra fria. O ar cheira a ferrugem e cera velha. Nas paredes, runas meio apagadas pulsam fracamente quando você se aproxima.\n\nUm baú de ferro repousa no centro — e o chão ao redor dele é suspeitamente **limpo demais**.',
    eventos: [{ tipo: 'lugar', nome: 'Cripta do Sino', descricao: 'Salão subterrâneo com runas' }],
    sugestoes: ['Examinar o chão', 'Abrir o baú', 'Ler as runas'],
  },
  {
    tema: 'cidade', cena: 'cidade-mercado', local: 'Mercado de Vel', falante: 'Grizz', capitulo: 'Mercado de Vel',
    roteiro: [
      { quem: 'narrador', texto: 'O mercado de Vel explode em cores e gritos. Mercadores anunciam especiarias de terras que você nem sabe pronunciar, e um menino esbarra em você com um sorriso rápido demais.', emocao: 'neutro' },
      { quem: 'Grizz', texto: 'Poções! Poções frescas! Cura, coragem e uma que faz crescer bigode!', emocao: 'alegre' },
      { quem: 'Dona Mirela', texto: 'Frescas? Esse frasco aí eu vi na tua banca no inverno passado, goblin.', emocao: 'sarcastico' },
      { quem: 'Grizz', texto: 'Envelhecidas! Poção envelhecida é mais forte, todo mundo sabe disso.', emocao: 'raiva' },
    ],
    eventos: [
      { tipo: 'npc', nome: 'Grizz', descricao: 'Goblin mercador de poções', relacao: 'neutro', retrato: 'goblin-mercador' },
      { tipo: 'npc', nome: 'Dona Mirela', descricao: 'Vendedora de ervas, língua afiada', relacao: 'neutro', retrato: 'miriel-folha-serena' },
    ],
    sugestoes: ['Comprar uma poção', 'Seguir o menino', 'Checar a bolsa'],
  },
  {
    tema: 'noite', cena: 'acampamento', local: 'Estrada do Norte', periodo: 'noite', capitulo: 'Estrada ao Luar',
    texto: 'A lua cheia pinta a estrada de prata. O vento traz o som distante de cascos — muitos cascos — e tochas surgem no horizonte.\n\nVocê tem talvez um minuto antes que eles cheguem.',
    eventos: [],
    sugestoes: ['Esconder-se no mato', 'Esperar na estrada', 'Correr até a ponte'],
  },
  {
    tema: 'horror', cena: 'cemiterio', local: 'Capela Esquecida', periodo: 'noite', capitulo: 'A Capela Esquecida',
    texto: 'A capela está em silêncio absoluto — nem os grilos ousam cantar aqui. Nos bancos, figuras cobertas por lençóis estão sentadas em fileiras perfeitas.\n\nQuando você dá um passo, **todas as cabeças se viram** ao mesmo tempo.',
    eventos: [{ tipo: 'status_add', nome: 'Arrepiado', descricao: '−1 em testes de Sabedoria', turnos: 3, positivo: false }],
    sugestoes: ['Recuar devagar', 'Puxar um lençol', 'Rezar em voz alta'],
  },
  {
    tema: 'neve', cena: 'montanha-nevada', local: 'Passo Gelado', capitulo: 'O Passo Gelado',
    texto: 'A nevasca apaga o mundo. Cada passo é uma luta contra o vento que corta a pele. Entre os flocos, uma silhueta enorme se move lentamente — e para, como se farejasse o ar.',
    eventos: [{ tipo: 'status_add', nome: 'Congelando', descricao: 'Perde 1 de vida por turno exposto', turnos: 2, positivo: false }],
    sugestoes: ['Procurar abrigo', 'Acender uma tocha', 'Observar a silhueta'],
  },
  {
    tema: 'mar', cena: 'porto', local: 'Porto Cinzento', falante: 'Capitão Barba-de-Sal', capitulo: 'O Porto Cinzento',
    roteiro: [
      { quem: 'narrador', texto: 'Ondas batem contra o cais enquanto gaivotas brigam por restos de peixe. Um navio de velas negras está atracado — e seu capitão, **Barba-de-Sal**, acena para você.', emocao: 'neutro' },
      { quem: 'Capitão Barba-de-Sal', texto: 'Procura trabalho, forasteiro? Pago bem. Pergunte menos.', emocao: 'misterioso' },
    ],
    eventos: [{ tipo: 'npc', nome: 'Capitão Barba-de-Sal', descricao: 'Capitão de um navio de velas negras', relacao: 'desconhecido', retrato: 'barbaro' }],
    sugestoes: ['Aceitar o trabalho', 'Perguntar o destino', 'Recusar e sair'],
  },
];

function turno({ slug, acao, state }) {
  const a = norm(acao);
  const p = state.personagem;

  // resultado de uma rolagem
  if (/sucesso|falha|critico/.test(a) && pendente.has(slug)) {
    const ctx = pendente.get(slug);
    pendente.delete(slug);
    if (/sucesso|critico/.test(a)) {
      const ouro = r(5, 25);
      if (ctx.inimigo) {
        const golpe = /critico/.test(a) ? 99 : r(5, 9);
        const resta = Math.max(0, ctx.vidaInimigo - golpe);
        if (resta > 0) {
          return {
            narrativa: `${ctx.sucesso} Mas ainda está de pé — e furioso.`,
            tema: 'batalha', falante: ctx.inimigo,
            eventos: [{ tipo: 'npc', nome: ctx.inimigo, vida: resta }],
            sugestoes: ['Atacar de novo', 'Defender', 'Usar uma poção'],
          };
        }
      }
      return {
        narrativa: `${ctx.sucesso}${ctx.inimigo ? ' E não se levanta mais.' : ''}\n\nQuando a poeira baixa, você encontra algo entre os destroços.`,
        tema: ctx.temaDepois || 'floresta',
        falante: '',
        eventos: [
          ...(ctx.inimigo ? [{ tipo: 'npc', nome: ctx.inimigo, vida: 0 }] : []),
          { tipo: 'xp', valor: r(25, 45), motivo: ctx.motivo },
          { tipo: 'ouro', valor: ouro, motivo: 'Saque' },
          pick([
            { tipo: 'item_ganho', nome: 'Poção de Vida Menor', quantidade: 2 },
            { tipo: 'item_ganho', nome: 'Anel de Cinzas' },
            { tipo: 'item_ganho', nome: 'Lâmina da Lua' },
            { tipo: 'item_ganho', nome: 'Olho do Oráculo' },
            { tipo: 'item_ganho', nome: 'Espada Sangrenta de Vharos' },
            { tipo: 'item_ganho', nome: 'Botas do Batedor' },
            { tipo: 'item_ganho', nome: 'Pergaminho de Luz', icone: '📜', pasta: 'pergaminhos', descricao: 'Ilumina uma área por 1 hora', raridade: 'comum' },
          ]),
        ],
        sugestoes: ['Examinar o que achou', 'Seguir em frente', 'Descansar um pouco'],
      };
    }
    const dano = r(3, 8);
    return {
      narrativa: `${ctx.falha}\n\nVocê sente o impacto — e o sangue quente escorrendo.`,
      tema: ctx.tema || 'batalha',
      falante: ctx.inimigo || '',
      eventos: [{ tipo: 'dano', valor: dano, motivo: ctx.motivo }, ...(Math.random() < 0.4 ? [{ tipo: 'status_add', nome: 'Sangramento', descricao: '−1 de vida por turno', turnos: 3, positivo: false }] : [])],
      sugestoes: ['Tentar de novo', 'Recuar', 'Beber uma poção'],
    };
  }

  if (/^\(?a aventura comeca|inicio|comece/.test(a) || state.campanha.turno === 0) {
    return {
      roteiro: [
        { quem: 'narrador', texto: `A taverna **O Javali Dourado** está quente e barulhenta. O fogo estala na lareira, canecas batem nas mesas e um bardo desafina uma canção sobre dragões.`, emocao: 'calmo' },
        { quem: 'narrador', texto: `Você, **${p.nome}**, acabou de sentar quando o taverneiro **Brom** se inclina sobre o balcão, sério.`, emocao: 'neutro' },
        { quem: 'Brom', texto: 'O sino da velha capela tocou sozinho ontem à noite. Três vezes. Da última vez que isso aconteceu... bem. Ninguém que foi olhar voltou.', emocao: 'sussurro' },
        { quem: 'Lira', texto: 'Ah, Brom, de novo essa história? Foi o vento. Ou um bode. Bodes adoram sinos.', emocao: 'sarcastico' },
        { quem: 'Brom', texto: 'Bode não toca sino à meia-noite, menina! Vá desafinar noutro canto.', emocao: 'raiva' },
        { quem: 'narrador', texto: 'Ele empurra uma caneca na sua direção e baixa a voz.', emocao: 'neutro' },
        { quem: 'Brom', texto: 'Pago 50 moedas pra quem descobrir o que está acontecendo.', emocao: 'misterioso' },
      ],
      tema: 'taverna',
      cena: 'taverna',
      falante: 'Brom',
      local: 'Vila de Valen',
      periodo: 'noite',
      dia: 1,
      capitulo: 'O Sino Silencioso',
      eventos: [
        { tipo: 'npc', nome: 'Brom', descricao: 'Taverneiro do Javali Dourado', relacao: 'aliado', retrato: 'garrick-barrilvelho' },
        { tipo: 'npc', nome: 'Lira', descricao: 'Bardo desafinado e debochado', relacao: 'neutro', retrato: 'maga-elfa' },
        { tipo: 'lugar', nome: 'Taverna O Javali Dourado', descricao: 'Ponto de encontro da vila' },
        { tipo: 'missao', nome: 'O Sino Silencioso', descricao: 'Descobrir por que o sino da capela tocou sozinho. Recompensa: 50 ouro.', estado: 'ativa' },
        { tipo: 'item_ganho', nome: 'Caneca de Hidromel', icone: '🍺', pasta: 'consumiveis', descricao: 'Por conta da casa', raridade: 'comum' },
      ],
      sugestoes: ['Aceitar o trabalho', 'Perguntar sobre a capela', 'Ouvir o bardo'],
    };
  }

  if (/atac|lut|golpe|espada|combat|cajado|machad/.test(a)) {
    const emCena = state.npcs.find((n) => n.nome === state.campanha.falante && n.vidaMax && n.vida > 0);
    const ini = emCena ? { nome: emCena.nome, vida: emCena.vida, vidaMax: emCena.vidaMax, retrato: emCena.retrato } : pick(INIMIGOS);
    const eventos = emCena ? [] : [{ tipo: 'npc', nome: ini.nome, descricao: ini.desc, relacao: 'hostil', retrato: ini.retrato, vida: ini.vidaMax, vidaMax: ini.vidaMax }];
    pendente.set(slug, {
      motivo: `Combate contra ${ini.nome}`, tema: 'batalha', temaDepois: pick(['floresta', 'masmorra', 'noite']), inimigo: ini.nome,
      vidaInimigo: emCena ? emCena.vida : ini.vidaMax,
      sucesso: `Seu golpe encontra a brecha perfeita — **${ini.nome}** cambaleia.`,
      falha: `**${ini.nome}** desvia e contra-ataca com fúria.`,
    });
    const ameaca = /lobo/i.test(ini.nome) ? null : pick(['Sua bolsa ou sua vida — e eu prefiro as duas!', 'Mais um herói? Eu coleciono as espadas de vocês.', 'Você não devia ter vindo aqui!']);
    return {
      roteiro: emCena
        ? [{ quem: 'narrador', texto: `**${ini.nome}** rosna e circula você, procurando uma abertura. O aço está erguido — é agora ou nunca.`, emocao: 'medo' }]
        : [
          { quem: 'narrador', texto: `Tudo acontece rápido: **${ini.nome}** salta das sombras! O mundo se estreita ao som do aço e da sua respiração.`, emocao: 'medo' },
          ...(ameaca ? [{ quem: ini.nome, texto: ameaca, emocao: 'grito' }] : []),
          { quem: 'narrador', texto: 'Você tem uma abertura — se for rápido o bastante.', emocao: 'neutro' },
        ],
      tema: 'batalha',
      cena: emCena ? state.campanha.cena : pick(['floresta-sombria', 'campo-de-batalha', 'mina-abandonada']),
      falante: ini.nome,
      eventos,
      rolagem: { dado: 'd20', atributo: 'forca', dificuldade: 12, motivo: 'Acertar o inimigo' },
      sugestoes: ['Atacar com tudo', 'Defender e esperar', 'Fugir'],
    };
  }

  if (/fug|corr|escond|furtiv/.test(a)) {
    pendente.set(slug, {
      motivo: 'Fuga', tema: 'noite', temaDepois: 'noite',
      sucesso: 'Você desaparece entre as sombras como se tivesse nascido nelas.',
      falha: 'Um galho estala sob seu pé. Eles te viram.',
    });
    return {
      narrativa: 'Você prende a respiração e se move, colado às sombras. Passos se aproximam...',
      tema: 'noite', eventos: [],
      rolagem: { dado: 'd20', atributo: 'destreza', dificuldade: 13, motivo: 'Passar despercebido' },
      sugestoes: ['Ficar imóvel', 'Correr agora', 'Distrair com uma pedra'],
    };
  }

  if (/descans|dorm|acamp|dormir/.test(a)) {
    return {
      narrativa: 'Você encontra um canto seguro e deixa o cansaço vencer. O sono vem pesado, sem sonhos. Ao acordar, os músculos doem menos e a mente está clara.',
      tema: 'taverna',
      eventos: [{ tipo: 'cura', valor: r(4, 8), motivo: 'Descanso' }, { tipo: 'mana', valor: 4, motivo: 'Descanso' }],
      sugestoes: ['Seguir viagem', 'Revisar o inventário', 'Conversar com alguém'],
    };
  }

  if (/magia|feitic|runa|conjur|arcan/.test(a)) {
    return {
      narrativa: 'Você traça os símbolos no ar e sente a energia arcana subir pela espinha. As runas respondem — linhas de luz violeta se acendem e revelam **uma inscrição oculta**: "O sino chama os que dormem sob a pedra."',
      tema: 'arcano',
      cena: 'ruinas-antigas',
      local: 'Ruínas do Sino',
      eventos: [{ tipo: 'mana', valor: -3, motivo: 'Feitiço de revelação' }, { tipo: 'xp', valor: 15, motivo: 'Descoberta arcana' }, ...(Math.random() < 0.5 ? [{ tipo: 'item_ganho', nome: "Olho de Vel'Darim" }] : [{ tipo: 'item_ganho', nome: 'Grimório das Sombras' }])],
      sugestoes: ['Procurar a pedra', 'Anotar a inscrição', 'Lançar outro feitiço'],
    };
  }

  if (/\brez|\bor(o|ar|ei)\b|templo|deus|abenc/.test(a)) {
    return {
      narrativa: 'Você fecha os olhos e fala baixo. Por um instante, o mundo inteiro parece prender a respiração — e então uma luz dourada e morna te envolve.',
      tema: 'celestial',
      cena: 'templo-celestial',
      local: 'Templo da Aurora',
      eventos: [{ tipo: 'cura', valor: 5, motivo: 'Bênção' }, { tipo: 'status_add', nome: 'Abençoado', descricao: '+1 em todos os testes', turnos: 3, positivo: true }],
      sugestoes: ['Agradecer', 'Seguir em frente', 'Perguntar um sinal'],
    };
  }

  if (/pocao|bebo|beber|usar|uso/.test(a)) {
    const pocao = Object.values(state.inventario).flat().find((i) => /pocao de vida|pocao de cura|hidromel/.test(norm(i.nome))) || Object.values(state.inventario).flat().find((i) => /pocao/.test(norm(i.nome)));
    if (!pocao) {
      return { narrativa: 'Você procura na bolsa... mas não há nada disso aí.', tema: state.campanha.tema, eventos: [], sugestoes: ['Procurar outra saída', 'Descansar', 'Seguir em frente'] };
    }
    return {
      narrativa: `Você bebe **${pocao.nome}** de um gole só. O calor se espalha pelo peito e as feridas formigam, fechando.`,
      tema: state.campanha.tema,
      eventos: [{ tipo: 'item_perdido', nome: pocao.nome, quantidade: 1 }, { tipo: 'cura', valor: r(4, 10), motivo: pocao.nome }],
      sugestoes: ['Seguir em frente', 'Examinar o local', 'Descansar'],
    };
  }

  if (/compr|vend|mercad|loja/.test(a)) {
    return {
      narrativa: 'Depois de uma pechincha animada, o mercador embrulha sua compra com um sorriso satisfeito demais — talvez você tenha pago caro. Talvez não.',
      tema: 'cidade',
      cena: 'cidade-mercado',
      local: 'Mercado de Vel',
      falante: 'Grizz',
      eventos: [{ tipo: 'npc', nome: 'Grizz', descricao: 'Goblin mercador de poções', relacao: 'neutro', retrato: 'goblin-mercador' }, { tipo: 'ouro', valor: -8, motivo: 'Compra' }, { tipo: 'item_ganho', nome: 'Poção de Vida Menor' }],
      sugestoes: ['Explorar o mercado', 'Voltar à taverna', 'Perguntar rumores'],
    };
  }

  if (/fogo|vulc|demon|infern/.test(a)) {
    return {
      narrativa: 'O chão racha e um calor insuportável sobe das fendas. Rios de lava iluminam uma cidade em ruínas — e algo enorme se mexe dentro dela.',
      tema: 'inferno', cena: 'salao-infernal', falante: '', local: 'Forjas Abaixo', capitulo: 'As Forjas Abaixo',
      eventos: [{ tipo: 'dano', valor: 2, motivo: 'Calor escaldante' }],
      sugestoes: ['Recuar', 'Procurar passagem', 'Encarar a criatura'],
    };
  }

  const cena = pick(CENAS.filter((c) => c.tema !== state.campanha.tema));
  return { narrativa: cena.texto, roteiro: cena.roteiro, tema: cena.tema, cena: cena.cena, falante: cena.falante || '', local: cena.local, periodo: cena.periodo || 'dia', capitulo: cena.capitulo, eventos: cena.eventos, sugestoes: cena.sugestoes };
}

async function turnoAsync(args) {
  await new Promise((res) => setTimeout(res, 500 + Math.random() * 700)); // "pensando"
  const t = turno(args);
  if (t.falante === undefined) t.falante = ''; // fora de combate, ninguém em destaque
  return { turno: t };
}

module.exports = { turno: turnoAsync, testar: async () => '✅ Modo demonstração: funciona offline, sem IA.' };
