// Prompt do Mestre, schema dos eventos e resumo do estado — compartilhado por todos os provedores.

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
function montarTool(cat = { cenas: [], retratos: [] }) {
  const cenas = cat.cenas.filter((c) => !c.especial).map((c) => c.id);
  const retratos = cat.retratos.map((r) => r.id);
  return {
    name: 'turno_do_mestre',
    description: 'Registra o turno do mestre: narrativa, mudanças de estado, cenário, NPC em cena, pedido de rolagem e sugestões.',
    input_schema: {
      type: 'object',
      properties: {
        roteiro: {
          type: 'array',
          description: 'A cena como um roteiro falado, na ordem: trechos do narrador e falas dos personagens. Cada item é narrado com a voz de quem fala. NPCs podem conversar entre si.',
          items: {
            type: 'object',
            properties: {
              quem: { type: 'string', description: '"narrador" ou o NOME EXATO do NPC/criatura que fala (o mesmo usado no evento npc).' },
              texto: { type: 'string', description: 'narrador: 1 parágrafo em 2ª pessoa (pode usar **negrito**). NPC: só a fala, sem travessão e sem "diz fulano".' },
              emocao: { type: 'string', enum: EMOCOES, description: 'Tom da fala (muda a voz). Narrador: neutro, calmo, misterioso, medo ou triste.' },
            },
            required: ['quem', 'texto'],
          },
        },
        narrativa: { type: 'string', description: 'Opcional — o app monta a narrativa a partir do roteiro.' },
        tema: { type: 'string', enum: Object.keys(TEMAS), description: 'Clima visual da cena ATUAL (cores/partículas/som).' },
        cena: { type: 'string', ...(cenas.length ? { enum: cenas } : {}), description: 'Arte de cenário que melhor mostra ONDE o jogador está agora.' },
        falante: { type: 'string', description: 'Nome do NPC/criatura em destaque na cena (quem fala ou confronta o jogador). String vazia se ninguém.' },
        local: { type: 'string', description: 'Nome curto do lugar atual (ex.: "Cidade de Valen").' },
        periodo: { type: 'string', enum: PERIODOS },
        dia: { type: 'integer', description: 'Dia da jornada (começa em 1; avance quando o tempo passar).' },
        capitulo: { type: 'string', description: 'Título curto do capítulo/arco atual.' },
        eventos: {
          type: 'array',
          description: 'Mudanças de estado a aplicar. Vazio se nada mudou.',
          items: {
            type: 'object',
            properties: {
              tipo: { type: 'string', enum: TIPOS_EVENTO },
              valor: { type: 'integer', description: 'dano/cura/xp: positivo. mana/ouro/atributo: delta (+/-).' },
              nome: { type: 'string', description: 'Nome do item, status, missão, NPC ou lugar.' },
              pasta: { type: 'string', description: 'item_ganho: pasta do inventário (armas, armaduras, consumiveis, itens-chave, diversos ou nova).' },
              icone: { type: 'string', description: 'item_ganho: UM emoji que represente o item (ex.: 🗡️ 🧪 📜 💍 🗝️).' },
              descricao: { type: 'string' },
              quantidade: { type: 'integer' },
              raridade: { type: 'string', enum: ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico'] },
              estado: { type: 'string', enum: ['ativa', 'concluida', 'falhou'] },
              relacao: { type: 'string', enum: ['aliado', 'neutro', 'hostil', 'desconhecido'] },
              retrato: { type: 'string', ...(retratos.length ? { enum: retratos } : {}), description: 'npc: retrato que melhor representa o NPC (omita se nenhum servir, ex.: animais).' },
              vida: { type: 'integer', description: 'npc: vida atual (use em inimigos de combate).' },
              vidaMax: { type: 'integer', description: 'npc: vida máxima.' },
              positivo: { type: 'boolean', description: 'status_add: true se é um efeito benéfico (bênção), false se é condição ruim (veneno).' },
              atributo: { type: 'string', enum: ATRIBUTOS },
              turnos: { type: 'integer', description: 'status_add: duração em turnos (0 = até ser removido).' },
              motivo: { type: 'string' },
            },
            required: ['tipo'],
          },
        },
        rolagem: {
          type: 'object',
          description: 'Preencha SÓ quando pedir um teste ao jogador. Omita caso contrário.',
          properties: {
            dado: { type: 'string', description: 'Ex.: d20' },
            atributo: { type: 'string', enum: ATRIBUTOS },
            dificuldade: { type: 'integer' },
            motivo: { type: 'string' },
          },
          required: ['dado', 'motivo'],
        },
        sugestoes: { type: 'array', items: { type: 'string' }, description: '3 ou 4 ações curtas possíveis.' },
      },
      required: ['roteiro', 'tema', 'cena', 'eventos', 'sugestoes'],
    },
  };
}
const TOOL = montarTool();

/** Lista compacta das artes para o mestre escolher. */
function listaArtes(cat) {
  if (!cat) return '';
  const cenas = cat.cenas.filter((c) => !c.especial).map((c) => `  - ${c.id}: ${c.desc || c.nome}`).join('\n');
  const ret = cat.retratos.filter((r) => !r.corpo).map((r) => `${r.id} (${r.desc || r.nome})`).join('; ');
  const elenco = cat.retratos.filter((r) => r.corpo).map((r) => `${r.id} = ${r.nome} (${r.desc})`).join('; ');
  const vistos = new Set();
  const itens = Object.values(cat.itens || {})
    .filter((i) => i.raridade && !vistos.has(i.id) && vistos.add(i.id))
    .map((i) => `${i.nome} [${i.raridade}]`).join('; ');
  return `CENÁRIOS (campo "cena" — a arte de fundo; escolha o que mostra ONDE o jogador está):\n${cenas}\nRETRATOS (campo "retrato" no evento npc): ${ret}${elenco ? `\nELENCO (NPCs prontos, com retrato de corpo inteiro — use o NOME e o retrato deles quando o papel combinar; ou só o retrato para um NPC novo parecido): ${elenco}` : ''}${itens ? `\nITENS COM ARTE (têm ilustração no inventário; ao dar um deles use o NOME EXATO; reserve lendários e míticos para momentos épicos): ${itens}` : ''}`;
}

function mod(v) {
  return Math.floor((Number(v) - 10) / 2);
}
function fmtMod(m) {
  return m >= 0 ? `+${m}` : `${m}`;
}

function regrasBase(campanha) {
  const temas = Object.entries(TEMAS).map(([k, v]) => `  - ${k}: ${v}`).join('\n');
  const en = campanha.idioma === 'en';
  const idioma = en
    ? `IDIOMA DA HISTÓRIA: INGLÊS. Escreva roteiro, sugestões, capítulo, local, nomes e descrições de itens/missões em inglês (estas instruções estão em português, mas o jogador lê e ouve tudo em inglês). Nas falas dos NPCs você pode usar as marcas sonoras [laugh] [chuckle] [sigh] [gasp] [cough] [groan] [sniff] — a voz as interpreta.\n`
    : '';
  return `Você é o MESTRE de um RPG de mesa solo, narrando para um único jogador em ${IDIOMAS[campanha.idioma] || IDIOMAS.pt}.
${idioma}
CAMPANHA: ${campanha.nome}
CENÁRIO: ${campanha.cenario}
TOM: ${campanha.tom || 'aventura épica com momentos de humor e perigo real'}
${campanha.premissa ? `PREMISSA: ${campanha.premissa}\n` : ''}
NARRAÇÃO — ROTEIRO FALADO
- A cena vai no "roteiro": uma lista, na ordem, de trechos do narrador e falas de personagens. O app dá uma VOZ FALADA a cada um (o narrador tem a dele; cada NPC tem a sua, com o tom da "emocao").
- Narrador ("quem": "narrador"): 2ª pessoa ("você"), vívido e sensorial, um parágrafo curto por item. Total de 1 a 4 parágrafos de narração por turno.
- Falas: "quem" = nome EXATO do NPC; "texto" = só o que ele diz (sem travessão, sem "diz Fulano" — isso vai num trecho do narrador, se quiser). Falas curtas e com personalidade (sotaque, manias, vocabulário próprio).
- NPCs podem conversar ENTRE SI, interromper-se, discordar — alterne os itens do roteiro como numa peça de teatro. Uma troca de 2 a 4 falas dá vida à cena.
- Marque a "emocao" de cada fala: raiva, medo, grito, sussurro, alegre, triste, sarcastico, misterioso, calmo ou neutro.
- Termine sempre num ponto de decisão. Nunca decida ações, falas ou sentimentos do personagem do jogador (ele não aparece como "quem").
- Todo NPC que fala pela primeira vez deve ter também um evento "npc" (com retrato), para ganhar rosto e voz.
- Use **negrito** para nomes importantes nos trechos do narrador.
- Seja justo, mas desafiador: risco real, recompensas reais, consequências que persistem.
- Respeite o estado atual (ficha, inventário, missões, NPCs) e a APARÊNCIA do personagem ao descrevê-lo. O jogador só usa itens que possui; se tentar usar algo que não tem, diga que não tem.
- Se a vida chegar a 0, o personagem cai inconsciente/à beira da morte — narre a situação dramática e dê uma chance de salvação.

MECÂNICA (estilo d20)
- Se o resultado de uma ação for incerto, NÃO o resolva: peça um teste em "rolagem" (d20 + modificador do atributo; dificuldade 5 fácil, 10 média, 15 difícil, 20 heroica) e pare a narração no suspense.
- Ao receber o resultado de uma rolagem, narre a consequência respeitando-o. 20 natural = crítico espetacular; 1 natural = desastre.
- Dano: 1-4 leve, 5-10 sério, 11+ brutal. Magias e habilidades especiais gastam mana (evento "mana" com valor negativo).
- XP por superar desafios (10-50 típico, 100+ em marcos). Ouro em saques e recompensas.

ESTADO — REGRA DE OURO
Toda mudança no personagem ou no mundo DEVE ir em "eventos"; o app aplica e mostra ao jogador.
  - achou/ganhou item → item_ganho (com pasta, descrição, raridade); usou/perdeu/vendeu → item_perdido
  - levou golpe → dano; curou/descansou → cura; gastou/recuperou mana → mana
  - efeitos temporários (envenenado, abençoado, exausto...) → status_add / status_remove
  - nova missão ou progresso → missao (estado ativa/concluida/falhou)
  - conheceu alguém → npc (relacao, retrato); descobriu local → lugar
  - inimigo em combate → npc com vida/vidaMax; a cada golpe dele sofrido, emita npc de novo com a vida atualizada
  - itens: sempre dê um "icone" (um emoji) que combine com o item
Organize o inventário em pastas: armas, armaduras, consumiveis, itens-chave, diversos — ou crie outra quando fizer sentido (pergaminhos, ingredientes, reliquias...).

ATMOSFERA
O campo "tema" muda a interface do jogador (cores, partículas, som). Escolha o tema da cena ATUAL e troque quando o ambiente ou o clima da história mudar (entrou na caverna → masmorra; combate começou → batalha; terror → horror; vitória divina → celestial).
Temas disponíveis:
${temas}
"capitulo": título curto do arco atual; mude só em viradas importantes da história.

CENA E ELENCO
- "cena": a arte de cenário do lugar atual (lista abaixo). Troque quando o jogador mudar de lugar.
- "falante": o NPC ou criatura em destaque AGORA (quem fala com ele ou o ataca) — aparece com retrato ao lado da narração. Vazio quando não houver.
- "local", "periodo" e "dia" situam o jogador no mundo (mostrados no topo da tela).

SUGESTÕES: 3 ações curtas (até 6 palavras cada) que o jogador poderia tentar. Varie entre cautelosa, ousada e criativa.`;
}

function systemPromptApi(campanha, lore, cat) {
  let s = regrasBase(campanha);
  if (cat) s += `\n\n${listaArtes(cat)}`;
  if (lore) s += `\n\nLORE DA CAMPANHA (escrita pelo jogador — use como verdade do mundo):\n${lore}`;
  s += `\n\nResponda SEMPRE chamando a ferramenta "${TOOL.name}".`;
  return s;
}

const EXEMPLO_JSON = `{
  "roteiro": [
    { "quem": "narrador", "texto": "A porta range. À luz da vela, uma clériga ferida ergue a maça — e atrás dela, um anão de barba chamuscada.", "emocao": "misterioso" },
    { "quem": "Irmã Voss", "texto": "Mais um passo e eu juro que te mando de volta ao pó!", "emocao": "medo" },
    { "quem": "Borin", "texto": "Calma, irmã. Mortos-vivos não pedem licença antes de entrar.", "emocao": "sarcastico" },
    { "quem": "narrador", "texto": "Os dois olham para você, esperando uma resposta.", "emocao": "neutro" }
  ],
  "tema": "masmorra",
  "cena": "mina-abandonada",
  "falante": "Irmã Voss",
  "local": "Catacumbas de Vel'Darim",
  "periodo": "noite",
  "dia": 3,
  "capitulo": "As Catacumbas de Vel'Darim",
  "eventos": [
    { "tipo": "dano", "valor": 4, "motivo": "Armadilha de dardos" },
    { "tipo": "item_ganho", "nome": "Chave de Osso", "icone": "🗝️", "pasta": "itens-chave", "descricao": "Abre algo nas profundezas", "quantidade": 1, "raridade": "incomum" },
    { "tipo": "npc", "nome": "Irmã Voss", "descricao": "Clériga ferida", "relacao": "aliado", "retrato": "paladina" },
    { "tipo": "npc", "nome": "Borin", "descricao": "Anão ferreiro, sarcástico", "relacao": "aliado", "retrato": "ferreiro-anao" }
  ],
  "rolagem": { "dado": "d20", "atributo": "destreza", "dificuldade": 13, "motivo": "Saltar o fosso" },
  "sugestoes": ["Examinar a chave", "Seguir o corredor", "Ajudar a clériga"]
}`;

/** CLAUDE.md que fica na pasta da campanha — o Claude Code carrega sozinho ao rodar nela. */
function claudeMd(campanha) {
  return `<!-- cronicas:v4 -->
# Crônicas — Mestre de RPG

${regrasBase(campanha)}

## Pasta da campanha
Você está rodando dentro da pasta da campanha. Pode CONSULTAR (Read/Glob/Grep) quando precisar de contexto:
- \`lore/\` — textos de mundo escritos pelo jogador (trate como canônicos)
- \`personagem.json\`, \`inventario/<pasta>/*.json\`, \`missoes/\`, \`npcs/\`, \`lugares/\`
- \`historia/cronica.md\` — tudo que já foi narrado

NÃO edite arquivos: o app Crônicas aplica os eventos e atualiza as pastas.

## Formato da resposta (OBRIGATÓRIO)
Responda APENAS com um único objeto JSON válido — sem texto antes ou depois, sem cercas de código.
Campos: roteiro[] ({quem, texto, emocao}), tema, cena, falante, local, periodo, dia, capitulo, eventos[], rolagem (opcional), sugestoes[].
Emoções: ${EMOCOES.join(', ')}.
A lista de cenários e retratos disponíveis vem em cada mensagem, em [ARTES].
Tipos de evento: ${TIPOS_EVENTO.join(', ')}.
Exemplo:
${EXEMPLO_JSON}

(Você pode editar este arquivo para personalizar o estilo do mestre desta campanha.)
`;
}

function resumoEstado(state) {
  const { campanha: c, personagem: p } = state;
  const linhas = [];
  linhas.push(`Capítulo: ${c.capitulo || '—'} | Tema: ${c.tema} | Cena: ${c.cena || '—'} | Turno: ${c.turno || 0}`);
  linhas.push(`Local: ${c.local || '—'} | Dia ${c.dia || 1}, ${c.periodo || 'dia'}${c.falante ? ` | Em cena: ${c.falante}` : ''}`);
  linhas.push(`${p.nome} — ${p.raca} ${p.classe}, nível ${p.nivel} (XP ${p.xp}/${p.xpProximo})`);
  if (p.aparencia) linhas.push(`Aparência: ${String(p.aparencia).slice(0, 600)}`);
  linhas.push(`Vida ${p.vida}/${p.vidaMax} | Mana ${p.mana}/${p.manaMax} | Ouro ${p.ouro}`);
  linhas.push(
    'Atributos: ' +
      ATRIBUTOS.map((a) => `${NOME_ATRIBUTO[a]} ${p.atributos[a]} (${fmtMod(mod(p.atributos[a]))})`).join(', ')
  );
  if (p.status?.length)
    linhas.push('Status: ' + p.status.map((s) => `${s.nome}${s.turnos ? ` (${s.turnos} turnos)` : ''}`).join(', '));
  const inv = Object.entries(state.inventario || {})
    .filter(([, itens]) => itens.length)
    .map(([pasta, itens]) => `  ${pasta}/: ` + itens.map((i) => `${i.nome}${i.quantidade > 1 ? ` x${i.quantidade}` : ''}${i.equipado ? ' [equipado]' : ''}`).join(', '));
  linhas.push('Inventário:\n' + (inv.length ? inv.join('\n') : '  (vazio)'));
  const ativas = (state.missoes || []).filter((m) => m.estado === 'ativa');
  if (ativas.length) linhas.push('Missões ativas: ' + ativas.map((m) => `${m.nome} — ${m.descricao || ''}`).join(' | '));
  if (state.npcs?.length) linhas.push('NPCs conhecidos: ' + state.npcs.map((n) => `${n.nome} (${n.relacao}${n.vidaMax ? `, vida ${n.vida}/${n.vidaMax}` : ''})`).join(', '));
  if (state.lugares?.length) linhas.push('Lugares: ' + state.lugares.map((l) => l.nome).join(', '));
  return linhas.join('\n');
}

function mensagemTurno(state, acao, cat) {
  const artes = cat ? `[ARTES]\n${listaArtes(cat)}\n\n` : '';
  return `${artes}[ESTADO ATUAL]\n${resumoEstado(state)}\n\n[AÇÃO DO JOGADOR]\n${acao}`;
}

/** Aceita qualquer coisa vinda do modelo e devolve um turno válido. */
function normalizarTurno(t, temaAtual, cat) {
  if (!t || typeof t !== 'object') t = { narrativa: String(t || '') };
  const tema = TEMAS[t.tema] ? t.tema : temaAtual || 'taverna';
  const eventos = Array.isArray(t.eventos) ? t.eventos.filter((e) => e && TIPOS_EVENTO.includes(e.tipo)) : [];
  let rolagem = null;
  if (t.rolagem && typeof t.rolagem === 'object' && t.rolagem.motivo) {
    rolagem = {
      dado: /^d\d+$/i.test(t.rolagem.dado || '') ? t.rolagem.dado.toLowerCase() : 'd20',
      atributo: ATRIBUTOS.includes(t.rolagem.atributo) ? t.rolagem.atributo : null,
      dificuldade: Number.isFinite(+t.rolagem.dificuldade) ? +t.rolagem.dificuldade : null,
      motivo: String(t.rolagem.motivo),
    };
  }
  const cenaOk = cat ? cat.cenas.some((c) => c.id === t.cena) : !!t.cena;
  const roteiro = normalizarRoteiro(t.roteiro);
  const narrativa = roteiro.length ? comporNarrativa(roteiro) : String(t.narrativa || '(O mestre ficou em silêncio...)').trim();
  return {
    narrativa,
    roteiro: roteiro.length ? roteiro : null,
    tema,
    cena: cenaOk ? t.cena : null,
    falante: typeof t.falante === 'string' ? t.falante.trim().slice(0, 60) : null,
    local: t.local ? String(t.local).slice(0, 60) : null,
    periodo: PERIODOS.includes(t.periodo) ? t.periodo : null,
    dia: Number.isFinite(+t.dia) && +t.dia > 0 ? Math.floor(+t.dia) : null,
    capitulo: t.capitulo ? String(t.capitulo).slice(0, 80) : null,
    eventos,
    rolagem,
    sugestoes: (Array.isArray(t.sugestoes) ? t.sugestoes : []).map(String).filter(Boolean).slice(0, 4),
  };
}

function normalizarRoteiro(r) {
  if (!Array.isArray(r)) return [];
  return r
    .filter((x) => x && typeof x === 'object' && String(x.texto || '').trim())
    .map((x) => {
      let quem = String(x.quem || 'narrador').trim().slice(0, 60) || 'narrador';
      if (/^(narrador|narrator|mestre)$/i.test(quem)) quem = 'narrador';
      const texto = String(x.texto).trim().replace(/^[—–-]\s*/, '').slice(0, 1500);
      return { quem, texto, emocao: EMOCOES.includes(x.emocao) ? x.emocao : 'neutro' };
    })
    .slice(0, 24);
}

/** Texto corrido do roteiro — vai para o histórico, a crônica e o contexto do modelo. */
function comporNarrativa(roteiro) {
  return roteiro.map((r) => (r.quem === 'narrador' ? r.texto : `**${r.quem}:** — ${r.texto}`)).join('\n\n');
}

/** Extrai JSON de uma resposta em texto livre (Claude Code). */
function extrairJson(texto) {
  const s = String(texto || '').trim();
  const tentativas = [s];
  const cerca = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (cerca) tentativas.push(cerca[1]);
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) tentativas.push(s.slice(a, b + 1));
  for (const t of tentativas) {
    try {
      return JSON.parse(t);
    } catch { /* tenta a próxima */ }
  }
  return { narrativa: s, eventos: [], sugestoes: [] };
}

module.exports = {
  TEMAS, TIPOS_EVENTO, ATRIBUTOS, EMOCOES, IDIOMAS, comporNarrativa, normalizarRoteiro, NOME_ATRIBUTO, TOOL, PERIODOS, montarTool, listaArtes,
  mod, fmtMod, systemPromptApi, claudeMd, resumoEstado, mensagemTurno, normalizarTurno, extrairJson,
};
