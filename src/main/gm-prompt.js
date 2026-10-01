// Prompt do Mestre, schema dos eventos e resumo do estado — compartilhado por todos os provedores.
// As constantes do jogo vêm de ./regras e a validação da resposta do modelo de ./turno;
// este arquivo só monta o que o mestre lê (tool schema, regras, CLAUDE.md, mensagem do turno).
const { TEMAS, TIPOS_EVENTO, ATRIBUTOS, NOME_ATRIBUTO, PERIODOS, EMOCOES, IDIOMAS, mod, fmtMod } = require('./regras');
const { normalizarTurno, normalizarRoteiro, comporNarrativa, extrairJson } = require('./turno');
const mapa = require('./mapa');

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
        local_mapa: { type: 'string', description: 'Nome EXATO do local do MAPA-MÚNDI onde o grupo está (ou o último por onde passou). Omita se a história não está no mapa.' },
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
              nota: { type: 'string', description: 'npc/lugar: UM fato curto que não pode ser esquecido (o que ele sabe, prometeu, esconde, deve). Só quando houver algo novo.' },
              vida: { type: 'integer', description: 'npc: vida atual (use em inimigos de combate).' },
              vidaMax: { type: 'integer', description: 'npc: vida máxima.' },
              tamanho: { type: 'string', enum: ['medio', 'grande', 'enorme'], description: 'npc inimigo: ocupa 1 quadrado (medio: humano, lobo), 2×2 (grande: ogro, urso, troll) ou 3×3 (enorme: dragão, gigante) no mapa de batalha.' },
              alcance: { type: 'string', enum: ['corpo', 'distancia'], description: 'npc inimigo: luta corpo a corpo (avança até o herói) ou à distância (arco, magia — fica a 20-30 pés).' },
              positivo: { type: 'boolean', description: 'status_add: true se é um efeito benéfico (bênção), false se é condição ruim (veneno).' },
              atributo: { type: 'string', enum: ATRIBUTOS },
              turnos: { type: 'integer', description: 'status_add: duração em turnos (0 = até ser removido).' },
              motivo: { type: 'string' },
              heroi: { type: 'string', description: 'GRUPO: nome do herói afetado por dano/cura/mana/ouro/xp/atributo/status/item. Obrigatório quando há mais de um herói.' },
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
            heroi: { type: 'string', description: 'GRUPO: nome do herói que deve rolar.' },
          },
          required: ['dado', 'motivo'],
        },
        sugestoes: { type: 'array', items: { type: 'string' }, description: '3 ou 4 ações curtas possíveis.' },
        memoria: {
          type: 'object',
          description: 'Memória da campanha (o app guarda e devolve todo turno). Curta e factual — só o que aconteceu de verdade.',
          properties: {
            resumo: { type: 'string', description: 'O que aconteceu NESTE turno em até 20 palavras (fatos, não clima).' },
            fatos: { type: 'array', items: { type: 'string' }, description: 'Fatos NOVOS e permanentes do mundo/história (0 a 3, curtos). Ex.: "O sino da capela é tocado por um culto". Nunca vida, posição ou estado de combate.' },
            ato: { type: 'integer', description: 'Índice (0, 1, 2…) do ato do enredo em que a história está agora. Mude só quando o objetivo do ato atual for cumprido.' },
            ganchos_novos: { type: 'array', items: { type: 'string' }, description: 'Pontas soltas novas que você plantou (mistérios, promessas, ameaças).' },
            ganchos_resolvidos: { type: 'array', items: { type: 'string' }, description: 'Ganchos da lista que foram resolvidos (texto igual ao da lista).' },
            enredo_ajuste: { type: 'string', description: 'Se as escolhas do jogador desviaram a história, como o rumo se adapta (curto). Raramente.' },
            resumo_geral: { type: 'string', description: 'SÓ quando pedido em [COMPACTAR MEMÓRIA]: resumo de toda a história até aqui em até 900 caracteres.' },
          },
        },
        enredo: {
          type: 'object',
          description: 'SÓ quando pedido em [ENREDO AINDA NÃO DEFINIDO]: o rumo da história inteira, planejado agora.',
          properties: {
            titulo: { type: 'string' },
            premissa: { type: 'string', description: 'O conflito central em 1-2 frases.' },
            antagonista: { type: 'object', properties: { nome: { type: 'string' }, objetivo: { type: 'string' }, segredo: { type: 'string' } } },
            segredos: { type: 'array', items: { type: 'string' }, description: 'Verdades escondidas que serão reveladas aos poucos (reviravoltas).' },
            atos: {
              type: 'array',
              description: '3 a 5 atos. Cada um com um objetivo claro para o jogador e o que muda no fim.',
              items: { type: 'object', properties: { titulo: { type: 'string' }, objetivo: { type: 'string' }, virada: { type: 'string', description: 'O evento que encerra o ato.' } }, required: ['titulo', 'objetivo'] },
            },
            ganchos: { type: 'array', items: { type: 'string' }, description: 'Primeiras pontas soltas.' },
            final: { type: 'string', description: 'Como a história pode terminar (flexível às escolhas do jogador).' },
          },
          required: ['titulo', 'premissa', 'atos'],
        },
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
  const ret = cat.retratos.filter((r) => !r.corpo && !r.monstro).map((r) => `${r.id} (${r.desc || r.nome})`).join('; ');
  const bestiario = cat.retratos.filter((r) => r.monstro).map((r) => `${r.id} = ${r.nome} (${r.desc.replace(/^monstro: /, '')})`).join('; ');
  const elenco = cat.retratos.filter((r) => r.corpo).map((r) => `${r.id} = ${r.nome} (${r.desc})`).join('; ');
  const vistos = new Set();
  const itens = Object.values(cat.itens || {})
    .filter((i) => i.raridade && !vistos.has(i.id) && vistos.add(i.id))
    .map((i) => `${i.nome} [${i.raridade}]`).join('; ');
  return `CENÁRIOS (campo "cena" — a arte de fundo; escolha o que mostra ONDE o jogador está):\n${cenas}\nRETRATOS (campo "retrato" no evento npc): ${ret}${bestiario ? `\nBESTIÁRIO (monstros com arte — use como inimigos: evento npc com relacao "hostil", vida/vidaMax e o retrato; o nome pode ser o do bestiário ou outro): ${bestiario}` : ''}${elenco ? `\nELENCO (NPCs prontos, com retrato de corpo inteiro — use o NOME e o retrato deles quando o papel combinar; ou só o retrato para um NPC novo parecido): ${elenco}` : ''}${itens ? `\nITENS COM ARTE (têm ilustração no inventário; ao dar um deles use o NOME EXATO; reserve lendários e míticos para momentos épicos): ${itens}` : ''}`;
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
  - inimigo em combate → npc com relacao "hostil" e vida/vidaMax (OBRIGATÓRIO ao entrar no combate, para cada inimigo que luta — guarda, bandido, monstro; quem era neutro e partiu para a briga vira hostil); a cada golpe dele sofrido, emita npc de novo com a vida atualizada
  - no combate a tela mostra um mapa quadriculado (1 quadrado = 1,5 m / 5 pés): ao criar o inimigo diga tamanho (medio/grande/enorme) e alcance (corpo/distancia); narre distâncias coerentes em pés (corpo a corpo = adjacente, arco = 20-30 pés)
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

ENREDO E MEMÓRIA — a história tem que ser BOA e COERENTE
- Existe um ENREDO planejado (título, premissa, antagonista, segredos, atos). Conduza a história na direção do ATO ATUAL, mas deixe o jogador livre: se ele desviar, adapte o caminho (memoria.enredo_ajuste), não o force.
- Plante pistas dos segredos antes de revelá-los; revele-os em momentos de impacto. Todo NPC importante quer algo. Cada ato termina com uma virada.
- A MEMÓRIA (fatos, linha do tempo, notas de NPC/lugar) é a VERDADE da campanha: nunca contradiga, nunca invente passado que não está lá. Se não está na memória nem no histórico, não aconteceu.
- Todo turno preencha memoria.resumo (até 20 palavras). Registre fatos novos permanentes em memoria.fatos e o que cada NPC sabe/promete em "nota" no evento npc.
- memoria.fatos = só o que continua verdade daqui a 10 turnos (quem é quem, promessas, pistas, segredos revelados). NUNCA vida, posição, ferimentos ou o estado do combate — isso já está na ficha e no evento npc.
- "nota" do NPC = só informação NOVA (não repita o que já está nas notas dele). "descricao" do NPC = quem ele é, estável; estado do momento não entra.
- Quando o ato atual terminar (a virada aconteceu), avance memoria.ato para o índice do próximo (0 = primeiro ato).
- Use os GANCHOS abertos: retome pontas soltas, feche as que se resolveram (memoria.ganchos_resolvidos).

GRUPO (quando o estado mostra mais de um herói — cada um é um jogador de verdade)
- A ação chega como "AÇÕES DA RODADA", uma linha por herói. Resolva todas na mesma cena, na ordem que fizer sentido, e dê a CADA herói uma consequência ou fala no roteiro — ninguém fica de fora.
- Nos eventos de herói (dano, cura, mana, ouro, xp, atributo, status, item) preencha "heroi" com o nome de quem foi afetado. Itens vão para quem os pegou.
- "rolagem.heroi" diz quem rola. Peça no máximo uma rolagem por rodada (a mais decisiva).
- Nunca decida o que um herói faz ou diz além do que o jogador dele escreveu. No roteiro, a fala de um herói (só quando o jogador escreveu a fala) usa "quem" = nome dele.
- Sugestões valem para o grupo.

SUGESTÕES: 3 ações curtas (até 6 palavras cada) que o jogador poderia tentar. Varie entre cautelosa, ousada e criativa.`;
}

function systemPromptApi(campanha, lore, cat) {
  let s = regrasBase(campanha);
  if (cat) s += `\n\n${listaArtes(cat)}`;
  s += `\n\n${mapa.resumoParaMestre()}`;
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
  "sugestoes": ["Examinar a chave", "Seguir o corredor", "Ajudar a clériga"],
  "memoria": { "resumo": "Encontrou Irmã Voss e Borin feridos nas catacumbas; pegou a Chave de Osso.", "fatos": ["A Chave de Osso abre a cripta do Sino"], "ganchos_novos": ["Quem feriu Irmã Voss?"] }
}`;

/** CLAUDE.md que fica na pasta da campanha — o Claude Code carrega sozinho ao rodar nela. */
function claudeMd(campanha) {
  return `<!-- cronicas:v9 -->
# Crônicas — Mestre de RPG

${regrasBase(campanha)}

${mapa.resumoParaMestre()}

## Pasta da campanha
Você está rodando dentro da pasta da campanha. Pode CONSULTAR (Read/Glob/Grep) quando precisar de contexto:
- \`lore/\` — textos de mundo escritos pelo jogador (trate como canônicos)
- \`personagem.json\`, \`inventario/<pasta>/*.json\`, \`missoes/\`, \`npcs/\`, \`lugares/\`
- \`historia/cronica.md\` — tudo que já foi narrado

NÃO edite arquivos: o app Crônicas aplica os eventos e atualiza as pastas.

## Formato da resposta (OBRIGATÓRIO)
Responda APENAS com um único objeto JSON válido — sem texto antes ou depois, sem cercas de código.
Campos: roteiro[] ({quem, texto, emocao}), tema, cena, falante, local, local_mapa, periodo, dia, capitulo, eventos[], rolagem (opcional), sugestoes[], memoria {resumo, fatos[], ato, ganchos_novos[], ganchos_resolvidos[], enredo_ajuste, resumo_geral}, e enredo quando pedido.
Formato do enredo: {"titulo", "premissa", "antagonista": {"nome", "objetivo", "segredo"}, "segredos": [], "atos": [{"titulo", "objetivo", "virada"}], "ganchos": [], "final"} — 3 a 5 atos.
Evento npc: {"tipo":"npc", "nome", "descricao", "relacao", "retrato", "nota", "vida", "vidaMax", "tamanho": medio|grande|enorme, "alcance": corpo|distancia} (tamanho e alcance em inimigos de combate).
O enredo e a memória ficam em \`historia/enredo.json\` e \`historia/memoria.json\` (o app mantém; cada mensagem já traz o essencial).
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
  if (c.mapaLocal) linhas.push(mapa.posicaoParaMestre(c.mapaLocal));
  const grupo = state.grupoCompleto || [];
  if (grupo.length > 1) {
    // co-op: uma ficha compacta por herói (cada um tem seu inventário)
    linhas.push(`GRUPO (${grupo.length} heróis):`);
    for (const h of grupo) {
      const inv = Object.entries(h.inventario || {}).flatMap(([, itens]) => itens.map((i) => `${i.nome}${i.quantidade > 1 ? ` x${i.quantidade}` : ''}${i.equipado ? '*' : ''}`));
      linhas.push(`- ${h.nome}${h.jogador ? ` (jogador ${h.jogador})` : ''}: ${h.raca} ${h.classe} nv ${h.nivel} | Vida ${h.vida}/${h.vidaMax} | Mana ${h.mana}/${h.manaMax} | Ouro ${h.ouro} | `
        + ATRIBUTOS.map((a) => `${NOME_ATRIBUTO[a].slice(0, 3)} ${h.atributos[a]}`).join(' ')
        + `${h.status?.length ? ` | Status: ${h.status.map((s) => s.nome).join(', ')}` : ''}`
        + `${h.aparencia ? ` | Aparência: ${String(h.aparencia).slice(0, 160)}` : ''}`
        + `\n    Itens (*=equipado): ${inv.join(', ') || '—'}`);
    }
  } else {
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
  }
  const ativas = (state.missoes || []).filter((m) => m.estado === 'ativa');
  if (ativas.length) linhas.push('Missões ativas: ' + ativas.map((m) => `${m.nome} — ${m.descricao || ''}`).join(' | '));
  if (state.npcs?.length) {
    linhas.push('NPCs conhecidos:\n' + state.npcs.slice(0, 30).map((n) => `  - ${n.nome} (${n.relacao}${n.vidaMax ? `, vida ${n.vida}/${n.vidaMax}` : ''})${n.descricao ? `: ${n.descricao}` : ''}${n.notas?.length ? ` — ${n.notas.slice(-3).join('; ')}` : ''}`).join('\n'));
  }
  if (state.lugares?.length) linhas.push('Lugares: ' + state.lugares.slice(0, 30).map((l) => `${l.nome}${l.notas?.length ? ` (${l.notas.slice(-2).join('; ')})` : ''}`).join(', '));
  return linhas.join('\n');
}

/** Enredo + memória em texto compacto (vai em todo turno no lugar do histórico longo). */
function blocoMemoria(state) {
  const e = state.enredo;
  const m = state.memoria || {};
  const out = [];
  if (e?.atos?.length) {
    const i = Math.max(0, e.atos.findIndex((a) => a.estado === 'atual'));
    const atual = e.atos[i];
    out.push(`[ENREDO — só você sabe os segredos]\n${e.titulo}: ${e.premissa}`);
    if (e.antagonista?.nome) out.push(`Antagonista: ${e.antagonista.nome} — quer ${e.antagonista.objetivo || '?'}${e.antagonista.segredo ? ` (segredo: ${e.antagonista.segredo})` : ''}`);
    if (e.segredos?.length) out.push(`Segredos: ${e.segredos.join(' | ')}`);
    out.push(`Ato atual ${i + 1}/${e.atos.length} (memoria.ato=${i}): ${atual.titulo} — objetivo: ${atual.objetivo}${atual.virada ? ` — termina quando: ${atual.virada}` : ''}`);
    if (e.atos[i + 1]) out.push(`Próximo ato: ${e.atos[i + 1].titulo}`);
    if (e.final) out.push(`Final possível: ${e.final}`);
    if (e.ajustes?.length) out.push(`Ajustes de rumo: ${e.ajustes.slice(-3).join(' | ')}`);
  } else {
    out.push('[ENREDO AINDA NÃO DEFINIDO] Planeje agora o rumo da história inteira no campo "enredo" (coerente com o cenário, o tom, a premissa, o herói e o que já aconteceu).');
  }
  if (m.ganchos?.length) out.push(`Ganchos abertos: ${m.ganchos.join(' | ')}`);
  if (m.resumo || m.fatos?.length || m.linha?.length) {
    out.push('[MEMÓRIA — verdade da campanha]');
    if (m.resumo) out.push(`Resumo até aqui: ${m.resumo}`);
    if (m.fatos?.length) out.push(`Fatos: ${m.fatos.join(' | ')}`);
    if (m.linha?.length) out.push(`Linha do tempo recente:\n${m.linha.slice(-14).join('\n')}`);
  }
  if ((m.linha?.length || 0) >= 30) { // = MEMORIA_COMPACTAR_A_PARTIR (campaign-store)
    out.push(`[COMPACTAR MEMÓRIA] A linha do tempo está longa. Neste turno preencha memoria.resumo_geral com um resumo de TODA a história até agora (use o "Resumo até aqui" + a linha do tempo completa abaixo), em até 900 caracteres, sem perder nomes, promessas e mistérios.\n${m.linha.join('\n')}`);
  }
  return out.join('\n');
}

function mensagemTurno(state, acao, cat) {
  const artes = cat ? `[ARTES]\n${listaArtes(cat)}\n\n` : '';
  const grupo = (state.grupoCompleto || []).length > 1;
  return `${artes}${blocoMemoria(state)}\n\n[ESTADO ATUAL]\n${resumoEstado(state)}\n\n[${grupo ? 'AÇÕES DA RODADA' : 'AÇÃO DO JOGADOR'}]\n${acao}`;
}

module.exports = {
  TEMAS, TIPOS_EVENTO, ATRIBUTOS, EMOCOES, blocoMemoria, IDIOMAS, comporNarrativa, normalizarRoteiro, NOME_ATRIBUTO, TOOL, PERIODOS, montarTool, listaArtes,
  mod, fmtMod, systemPromptApi, claudeMd, resumoEstado, mensagemTurno, normalizarTurno, extrairJson,
};
