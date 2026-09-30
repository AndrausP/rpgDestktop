# Crônicas — RPG desktop com Mestre IA

App desktop (Electron) para jogar RPG solo com um Mestre de IA. Tem ficha, inventário organizado em **pastas de verdade no disco**, missões, NPCs, lugares, dados, e o **tema visual (cores, partículas e som) muda conforme a história avança**.

## Rodar

```bash
npm install
npm start          # ou dê dois cliques em Iniciar.bat (Windows) / iniciar.sh
npm run dev        # abre com DevTools
npm run dist:win   # gera instalador .exe em dist/
```

Precisa de Node 18+.

## Mestres (⚙️ Configurações)

| Provedor | Como funciona |
|---|---|
| 🧠 **Claude API** | Cole sua chave (`sk-ant-...`). O mestre responde via *tool use* forçado (`turno_do_mestre`), então o JSON sempre vem válido. O system prompt usa prompt caching. A chave fica criptografada com o `safeStorage` do Electron (DPAPI no Windows). |
| ⌨️ **Claude Code** | Usa o CLI `claude` do seu PC (sua assinatura). Roda `claude -p --output-format json` **dentro da pasta da campanha**: ele lê o `CLAUDE.md` com as regras do mestre, pode consultar `lore/`, `npcs/`, `historia/`… (só Read/Glob/Grep) e a sessão é retomada com `--resume`, então ele lembra da campanha inteira. |
| 🎭 **Demonstração** | Mestre offline com roteiro, para testar interface, pastas e temas sem IA. |

## Cada campanha é uma pasta

Padrão: `Documentos/Cronicas RPG/<campanha>/`

```
CLAUDE.md                      regras do mestre (edite para mudar o estilo dele)
campanha.json                  nome, cenário, tema atual, capítulo, turno
personagem.json                vida, mana, xp, nível, ouro, atributos, condições
inventario/
  armas/espada-longa.json
  consumiveis/pocao-de-cura.json
  <qualquer-pasta-nova>/...    o mestre e você podem criar pastas
missoes/  npcs/  lugares/      um .json por registro
historia/mensagens.json        log completo
historia/cronica.md            a história inteira em texto legível
lore/*.md                      seu mundo — o mestre trata como canon
```

O app **observa a pasta**: se você (ou o Claude Code) editar um arquivo à mão, a tela atualiza sozinha. Dá pra versionar a campanha no git.

## Como o mestre mexe no jogo

A cada turno o mestre devolve um **roteiro falado**: trechos do narrador e falas dos personagens, na ordem, cada fala com uma emoção. NPCs conversam entre si como numa peça de teatro.

```json
{
  "roteiro": [
    { "quem": "narrador", "texto": "A porta range. Uma clériga ferida ergue a maça.", "emocao": "misterioso" },
    { "quem": "Irmã Voss", "texto": "Mais um passo e eu te mando de volta ao pó!", "emocao": "medo" },
    { "quem": "Borin", "texto": "Calma, irmã. Mortos-vivos não pedem licença.", "emocao": "sarcastico" }
  ],
  "tema": "masmorra",
  "capitulo": "As Catacumbas",
  "eventos": [
    { "tipo": "dano", "valor": 4, "motivo": "Armadilha" },
    { "tipo": "item_ganho", "nome": "Chave de Osso", "pasta": "itens-chave", "raridade": "incomum" },
    { "tipo": "npc", "nome": "Irmã Voss", "relacao": "aliado" }
  ],
  "rolagem": { "dado": "d20", "atributo": "destreza", "dificuldade": 13, "motivo": "Saltar o fosso" },
  "sugestoes": ["Examinar a chave", "Seguir o corredor", "Ajudar a clériga"]
}
```

Emoções: `neutro, calmo, alegre, raiva, medo, triste, sussurro, grito, sarcastico, misterioso`. Na tela, cada fala aparece num balão com o retrato de quem fala, e o balão acende enquanto a voz toca. Quem fala pela primeira vez vira NPC conhecido automaticamente. O texto corrido (para a crônica e o histórico) é montado pelo app.

Eventos: `dano, cura, mana, xp, ouro, item_ganho, item_perdido, status_add, status_remove, atributo, missao, npc, lugar`. O XP sobe de nível sozinho (vida/mana máx. aumentam); condições com duração vencem por turno.

## Artes (cenários, retratos, itens)

O app já vem com 20 cenários, o mapa do mundo, 20 retratos genéricos e um **elenco de 40 NPCs nomeados** (Garrick Barrilvelho, Edric IV, Morwenna, Thrag Pedranegra, Mira Vell…), cada um com busto e arte de corpo inteiro com fundo transparente. O Mestre recebe o elenco com função e aparência e pode usá-los pelo nome; o card do NPC em cena mostra a arte de corpo inteiro, e cada um já tem uma voz combinando. O fundo da tela é sempre a arte do lugar onde o jogador está. O Mestre escolhe a `cena` e o `falante` (o NPC em destaque, que aparece com retrato e barra de vida quando é inimigo) e dá um `retrato` para cada NPC.

**Para trazer suas próprias imagens**, solte-as em `Documentos/Cronicas RPG/_artes/` (a pasta abre pelo botão 🖼️ na tela inicial). O nome do arquivo é o que liga a arte:

| Arquivo | Vira |
|---|---|
| `cenas/porto-negro.png` | cenário novo que o Mestre pode escolher |
| `retratos/brom.png` | retrato do NPC "Brom" (ou opção de retrato do herói) |
| `itens/espada-longa.png` | ícone do item "Espada Longa" (no lugar do emoji) |

Descrições opcionais ajudam o Mestre a usar a cena certa: `cenas/cenas.json` → `{ "porto-negro": { "nome": "Porto Negro", "desc": "porto pirata à noite", "temas": ["mar","noite"] } }`. Cada campanha também aceita uma pasta `artes/` com a mesma estrutura. Um arquivo seu com o mesmo id de uma arte embutida substitui a embutida. Sem imagem, os itens usam o emoji escolhido pelo Mestre ou um emoji deduzido pelo nome.

## Itens ilustrados

O app tem 28 itens com arte, em 6 raridades: comum, incomum, raro, épico, lendário e **mítico**. O Mestre recebe a lista e pode entregar esses itens pelo nome exato; o app completa sozinho a raridade, a pasta, a descrição e o ícone.
- Itens **raros ou melhores** abrem uma vitrine com a arte grande, raios na cor da raridade e fanfarra.
- Itens sem arte própria usam a arte da mesma **família** quando existe (qualquer "espada" usa a Espada Longa, qualquer "poção" usa a Poção de Vida Menor, "cota de malha" usa uma armadura). Sem família, usam o emoji escolhido pelo Mestre.
- Lendários e míticos brilham no inventário; os míticos pulsam.

## Som

Tudo é gerado na hora pelo Web Audio (nenhum arquivo de áudio):
- **Música generativa por tema:** alaúde dedilhado (Karplus-Strong), flauta, sinos, caixinha de música, coro, metais e tambores de guerra, em escalas diferentes (dórica na taverna, frígia no horror, lídia no arcano…).
- **Ambiente:** fogo crepitando e burburinho na taverna, folhas e pássaros na floresta, gotas e correntes na masmorra, ondas, gaivotas e madeira rangendo no mar, grilos e coruja à noite, batimento e sussurros no horror.
- **Efeitos:** dado rolando na mesa e o toque final, golpe com metal, cura cintilante, moedas, mana, XP, missão, inimigo surgindo, derrota, crítico, desastre, fanfarra de nível e de item por raridade, e a pena riscando o pergaminho enquanto o Mestre escreve.
- **Mixer** em ⚙️ Configurações: geral, música, ambiente e efeitos, cada um com um botão ▶ para ouvir. Tudo passa por uma reverberação de sala e um compressor.

## Voz: Mestre e personagens falando (Chatterbox)

O Mestre narra e cada personagem fala com a própria voz; você só digita. A síntese é local, com o [Chatterbox](https://github.com/resemble-ai/chatterbox) da Resemble AI:
- **Português** (e mais 21 idiomas): `ChatterboxMultilingualTTS`.
- **Inglês**: `ChatterboxTurboTTS`, mais rápido e que entende marcas como `[laugh]`, `[chuckle]`, `[sigh]`, `[gasp]` (o mestre pode usá-las nas falas). Dá para trocar para o multilíngue em Configurações.

Cada campanha escolhe o **idioma da história** na criação (🇧🇷/🇺🇸): o mestre narra nesse idioma e a voz acompanha.

**Instalar (uma vez):** ⚙️ Configurações → Voz → **📦 Instalar**. Precisa do **Python 3.11** instalado no PC (python.org, marque "Add to PATH"). O app cria um ambiente Python só dele em `%APPDATA%/Crônicas/voz/python`, instala o PyTorch 2.6 (CUDA 12.4 se houver placa NVIDIA, senão CPU) e o `chatterbox-tts`. Também dá para rodar `npm run voz:instalar`. Depois clique em **⚡ Carregar voz**: na primeira vez os modelos (~3 GB) são baixados do Hugging Face e as vozes dos personagens são criadas.

**Como funciona**
- `voz/chatterbox/servico.py` é um serviço Python que o Electron inicia sob demanda e com o qual conversa por JSON, uma linha por mensagem (`iniciar`, `falar`, `semear`, `cancelar`). Cada fala vira um WAV em cache: repetir uma fala não sintetiza de novo.
- **Timbre = clipe de referência.** O Chatterbox copia a voz de um áudio de 10–20 s. Na primeira carga o app grava a voz embutida do Chatterbox e a transpõe para 16 vozes-base (narrador grave, rainha, brutamontes, goblin, criatura…), com altura, ritmo e textura próprios. Para cada fala, a voz é procurada nesta ordem:
  1. `<campanha>/artes/vozes/<nome-do-npc>.wav` (só nesta campanha; o herói usa `heroi.wav`)
  2. `_artes/vozes/<nome-do-npc>.wav` (esse NPC em todas as campanhas)
  3. `_artes/vozes/<voz>.wav` (sua gravação para uma das 16 vozes)
  4. a voz-base gerada
- **Grave vozes de verdade:** em Configurações → Voz → Biblioteca, cada voz tem 🎙️ gravar (lendo um texto na tela) e 📂 importar. Na aba NPCs, 🎙️ grava uma voz só para aquele personagem. Na criação e no editor do herói, 🎙️ grava a voz do seu herói.
- **Emoção:** a `emocao` de cada fala ajusta `exaggeration`, `cfg_weight` e `temperature` do Chatterbox (grito é intenso e acelerado, sussurro é contido…).
- Cada NPC ganha uma voz estável pelo retrato, pelo elenco, por palavras-chave e pelo nome; na aba NPCs dá para trocar e ouvir ▶.
- Enquanto alguém fala, a música abaixa, o balão de quem fala acende e o card do NPC em cena brilha 🗣️. **Esc** cala a narração; o 🗣️ na barra liga e desliga a voz. Sair da tela cancela as falas que ainda estavam na fila.
- Sem instalar nada, **Voz do sistema** usa as vozes do Windows.

## O herói

- Na criação: **📤 envie a sua imagem** (PNG/JPG/WEBP, reduzida para 1024 px e guardada em `<campanha>/artes/heroi/`) ou escolha na galeria; descreva a **aparência** (o mestre recebe em todo turno e no `lore/personagem.md`); escolha ou grave a **voz do herói**, usada para ler as suas falas se você ligar essa opção.
- No jogo: clique no retrato do herói para trocar a imagem, a aparência e a voz.

## Sair no meio de um turno

Clicar em ⌂ (ou fechar o app) **para a sessão de verdade**: o pedido à API é abortado, o processo do Claude Code é encerrado, a sua última ação sem resposta é retirada do histórico, a voz para, e anúncios, vitrines e rolagens somem da tela.

## Padrão visual

Molduras escuras com filete e cantoneiras douradas (`.moldura`), fonte Crimson Pro no texto e Cinzel nos títulos, cabeçalhos com arte (`.cab-arte`) e cards com imagem. A cor de destaque (`--acento`) muda com o tema da história; o dourado da moldura é fixo. A janela não tem moldura do sistema: a barra de título é própria (`#barra`).

## Temas

`taverna 🍺 · floresta 🌲 · masmorra 🕯️ · cidade 🏰 · batalha ⚔️ · horror 💀 · deserto 🏜️ · neve ❄️ · mar 🌊 · arcano 🔮 · celestial ✨ · inferno 🔥 · noite 🌙`

Cada um tem paleta própria, partículas (brasas, vaga-lumes, neve, chuva, névoa, runas, estrelas…) e som ambiente gerado por Web Audio (sem arquivos). Para criar um tema: adicione em `renderer/js/temas.js` e em `TEMAS` de `src/main/gm-prompt.js`.

## Estrutura do código

```
main.js                      janela, IPC, watcher da pasta
preload.js                   ponte segura (contextIsolation + sandbox)
src/main/
  campaign-store.js          pastas ⇄ estado, aplica eventos
  engine.js                  orquestra o turno
  gm-prompt.js               prompt do mestre, schema, CLAUDE.md
  providers/anthropic.js     Claude API
  providers/claude-code.js   Claude Code CLI
  providers/demo.js          mestre offline
  voz.js                     ponte com o serviço de voz (referências, cache, cancelamento)
  voz-presets.js             as 16 vozes-base e as emoções
  voz-instalador.js          cria o Python do app e instala o Chatterbox
voz/chatterbox/servico.py    serviço de voz (Chatterbox multilíngue + Turbo)
renderer/
  js/telas/                  início, criação, jogo, configurações
  js/cenario.js              troca de tema (fundo, partículas, som, anúncios)
  js/particulas.js  js/audio.js  js/temas.js
  js/vozes.js                roteiro, vozes dos NPCs, narrador
  js/heroi.js  js/gravador.js  imagem/aparência/voz do herói, gravação pelo microfone
```

## Atalhos

- **Enter** envia, **Shift+Enter** quebra linha
- **Esc** ou clique na narração pula a digitação
- Clique num atributo para um teste livre (d20 + modificador)
- Arraste itens entre pastas do inventário
