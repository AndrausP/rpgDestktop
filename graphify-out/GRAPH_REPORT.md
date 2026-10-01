# Graph Report - .  (2026-10-01)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 731 nodes · 1773 edges · 28 communities (25 shown, 3 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e1bac2a3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- jogo.js
- campaign-store.js
- Audio
- Voz
- engine.js
- Sala
- gm-prompt.js
- build
- vozes.js
- main/mapa.js
- catalogo.js
- main.js
- Crônicas — RPG desktop com Mestre IA
- Decisões
- Sequência
- Modelo de dados observado
- package.json
- grade.js
- Arquitetura observada
- Cliente
- Particulas
- Documentação do Crônicas: Entradas
- scripts
- claude-code.js
- CronicasVoz.csproj
- Kit de interface dark fantasy — erros aprendidos
- iniciar.sh

## God Nodes (most connected - your core abstractions)
1. `Audio` - 49 edges
2. `CampaignStore` - 42 edges
3. `telaJogo()` - 38 edges
4. `esc()` - 34 edges
5. `Sala` - 28 edges
6. `criarLateral()` - 25 edges
7. `telaCriacao()` - 23 edges
8. `toast()` - 23 edges
9. `slugify()` - 22 edges
10. `readJson()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `resolverUrl()` --calls--> `slugify()`  [EXTRACTED]
  src/main/catalogo.js → src/main/util.js
- `Entradas: Responsabilidades dos módulos e UI` --references--> `Módulos observados`  [EXTRACTED]
  docs/README.md → docs/modules.md
- `ICONE_ATR` --calls--> `iconeKitHtml()`  [EXTRACTED]
  renderer/js/telas/jogo.js → renderer/js/arte.js
- `criarArena()` --calls--> `tamanhoDe()`  [EXTRACTED]
  renderer/js/jogo/arena.js → renderer/js/grade.js
- `criarArena()` --calls--> `aDistancia()`  [EXTRACTED]
  renderer/js/jogo/arena.js → renderer/js/grade.js

## Import Cycles
- 3-file cycle: `renderer/js/app.js -> renderer/js/telas/jogo.js -> renderer/js/jogo/narracao.js -> renderer/js/app.js`
- 3-file cycle: `renderer/js/app.js -> renderer/js/telas/inicio.js -> renderer/js/telas/config.js -> renderer/js/app.js`
- 3-file cycle: `renderer/js/app.js -> renderer/js/telas/jogo.js -> renderer/js/telas/config.js -> renderer/js/app.js`
- 3-file cycle: `renderer/js/app.js -> renderer/js/telas/inicio.js -> renderer/js/coop.js -> renderer/js/app.js`
- 3-file cycle: `renderer/js/app.js -> renderer/js/telas/jogo.js -> renderer/js/coop.js -> renderer/js/app.js`
- 3-file cycle: `renderer/js/app.js -> renderer/js/telas/jogo.js -> renderer/js/jogo/historico.js -> renderer/js/app.js`
- 3-file cycle: `renderer/js/app.js -> renderer/js/telas/jogo.js -> renderer/js/jogo/lateral.js -> renderer/js/app.js`
- 4-file cycle: `renderer/js/app.js -> renderer/js/telas/jogo.js -> renderer/js/jogo/historico.js -> renderer/js/telas/config.js -> renderer/js/app.js`
- 4-file cycle: `renderer/js/app.js -> renderer/js/telas/jogo.js -> renderer/js/jogo/lateral.js -> renderer/js/jogo/mapa.js -> renderer/js/app.js`

## Communities (28 total, 3 thin omitted)

### Community 0 - "jogo.js"
Cohesion: 0.07
Nodes (106): Módulos observados: Interface, Interface e temas: renderer/js/app.js alterna início, jogo e criação reconstruindo #app. O wizard fica em renderer/js/telas/criacao.js e renderer/css/criacao.cs, api, irPara(), main(), recarregarConfig(), S, ANIMAIS (+98 more)

### Community 1 - "campaign-store.js"
Cohesion: 0.06
Nodes (47): Ficha, inventário e coleções: montarPersonagem cria ficha com nome, raça, classe, ícone, retrato, aparência, voz, história, nível, XP, vida, mana, ouro, seis at, Ficha, inventário e coleções: O inventário é uma árvore de pastas com um JSON por item. ganharItem procura nome normalizado, incrementa quantidade quando encont, Módulos observados: Regras e eventos, Modelo de dados observado: Ficha, inventário e coleções, { ATRIBUTOS, claudeMd, mod }, CampaignStore, diario, eventos (+39 more)

### Community 2 - "Audio"
Cohesion: 0.11
Nodes (7): Audio, ESCALAS, mtof(), pick(), PRESETS, rnd(), TRILHAS

### Community 3 - "Voz"
Cohesion: 0.06
Nodes (30): Módulos observados: Voz, crypto, fs, acharDotnet(), acharVozes(), copiarVozes(), fs, instalar() (+22 more)

### Community 4 - "engine.js"
Cohesion: 0.06
Nodes (38): Módulos observados, Módulos observados: Turnos do Mestre, Módulos observados: Provedores, Módulos observados: Catálogo e arte, Módulos observados: Mapa, Módulos observados: Aparência, Módulos observados: Esta tabela descreve responsabilidades identificadas em 2026-10-01. Para comportamento exato, siga os arquivos de origem., Módulos observados: Inicialização e IPC (+30 more)

### Community 5 - "Sala"
Cohesion: 0.10
Nodes (15): Módulos observados: Cooperação, http, { PORTA_PADRAO }, catalogo, crypto, enderecosLocais(), fs, gerarCodigo() (+7 more)

### Community 6 - "gm-prompt.js"
Cohesion: 0.12
Nodes (32): blocoMemoria(), listaArtes(), mapa, mensagemTurno(), { normalizarTurno, normalizarRoteiro, comporNarrativa, extrairJson }, regrasBase(), resumoEstado(), systemPromptApi() (+24 more)

### Community 7 - "build"
Cohesion: 0.09
Nodes (22): build, appId, directories, extraResources, files, linux, mac, nsis (+14 more)

### Community 8 - "vozes.js"
Cohesion: 0.17
Nodes (12): criarNarracao(), emocaoDoVerbo(), EMOCOES, FEMININAS, limparParaFala(), MASCULINAS, Narrador, norm() (+4 more)

### Community 9 - "main/mapa.js"
Cohesion: 0.13
Nodes (20): acharLocal(), ARQUIVO, carregar(), descreverRota(), fs, { norm }, paraTela(), path (+12 more)

### Community 10 - "catalogo.js"
Cohesion: 0.11
Nodes (20): Catálogo de arte e metadados: src/main/catalogo.js exporta 31 cenas, 80 retratos, 28 itens e 10 mapas de batalha; 20 retratos têm monstro: true. A contagem foi , Catálogo de arte e metadados: montar combina arte embutida de renderer/assets/ com _artes/ global do usuário e artes/ da campanha, sobrepondo IDs quando há extr, Modelo de dados observado: Catálogo de arte e metadados, BATALHA_DA_CENA, BATALHA_DO_TEMA, CENAS, comUrls(), DIR_EMBUTIDO (+12 more)

### Community 11 - "main.js"
Cohesion: 0.12
Nodes (15): { app, BrowserWindow, ipcMain, shell, dialog, Menu, protocol, net }, { CampaignStore }, catalogo, { Cliente }, { Engine }, fs, handle(), init() (+7 more)

### Community 12 - "Crônicas — RPG desktop com Mestre IA"
Cohesion: 0.11
Nodes (18): Artes (cenários, retratos, itens), Atalhos, Cada campanha é uma pasta, Como o mestre mexe no jogo, Crônicas — RPG desktop com Mestre IA, Enredo e memória (pouco token, sem esquecer), Estrutura do código, Itens ilustrados (+10 more)

### Community 13 - "Decisões"
Cohesion: 0.12
Nodes (16): Decisões, Sessão 2026-10-01 — criação guiada, Sessão 2026-10-01 — kit de interface dark fantasy, Sessão 2026-10-01 — kit de interface dark fantasy: Guardar location-marker.png em renderer/assets/ui/Decoration/; distribuição final: 28 arquivos em Icons/ e 5 , Sessão 2026-10-01 — criação guiada: Organizar a criação em cinco etapas — Mundo, História, Herói, Atributos e Revisão — com validação inline por etapa, foco no , Sessão 2026-10-01 — criação guiada: Confirmar a saída quando houver alterações e fazer um único envio com estado de carregamento e erro recuperável, preservando, Sessão 2026-10-01 — criação guiada: Aplicar materiais e tokens do kit dark fantasy ao wizard, com layout responsivo e estados ARIA nos controles., Sessão 2026-10-01 — criação guiada: Usar seis PNGs transparentes próprios para as classes em renderer/assets/ui/Icons/classes/ e reutilizar ícones existentes do (+8 more)

### Community 14 - "Sequência"
Cohesion: 0.12
Nodes (15): [ASSETS] Gerar controles, decoração e barras, [ASSETS] Gerar texturas e molduras, [ASSETS] Gerar ícones de menu e ação, [ASSETS] Gerar ícones de status, atributos e localização, Checklist de entrega, Contrato de assets, [DESIGN] Especificar peças e quatro exemplos de local, Estado em 2026-10-01 (+7 more)

### Community 15 - "Modelo de dados observado"
Cohesion: 0.14
Nodes (15): Modelo de dados observado, Kit de interface dark fantasy — pendências de validação, Persistência e arte: CampaignStore usa arquivos JSON e Markdown por campanha. A composição do estado carregado está em campaign-store.js. O catálogo embutido é , Campanha em disco: As pastas e arquivos principais aparecem no cabeçalho de campaign-store.js, na criação em campaign-store.js e no carregamento em campaign-sto, Modelo de dados observado: Estado em 2026-10-01. A persistência de campanha descrita em src/main/campaign-store.js usa pastas e arquivos JSON/Markdown, não uma , Regras de compatibilidade verificadas: A raridade persistida pode ser mitico em campaign-store.js; o kit visual mapeia esse valor para a moldura rarity-unique s, Campanha em disco: estrutura em disco, Kit de interface dark fantasy — pendências de validação: 2026-10-01 (+7 more)

### Community 16 - "package.json"
Cohesion: 0.13
Nodes (14): electron, electron-builder, Limites desta descrição: O grafo da raiz inclui relações extraídas de JavaScript e destes documentos. A extração AST observada não indexa CSS; para temas e layo, author, description, devDependencies, electron, electron-builder (+6 more)

### Community 17 - "grade.js"
Cohesion: 0.24
Nodes (14): aDistancia(), cacheAlcance, chegaAoHeroi(), distancia(), maisPerto(), mapaDePassos(), NORM(), norm2() (+6 more)

### Community 18 - "Arquitetura observada"
Cohesion: 0.18
Nodes (11): Arquitetura observada, Processo principal, ponte e interface: renderer/index.html define CSP, CSS, palco, barra da janela e #app. O roteador em renderer/js/app.js recria o conteúdo da, Fluxo de um turno: 1. O renderer solicita a ação por window.rpg.jogo.acao em preload.js; o processo principal encaminha ao Engine por IPC em main.js. 2. Engine , Fluxo de um turno: Os tipos de evento aceitos estão em src/main/regras.js. Sua aplicação a vida, mana, ouro, XP, status, atributos, itens e coleções está em src, Arquitetura observada: Estado do código em 2026-10-01. O aplicativo é Electron, com processo principal em main.js, ponte isolada em preload.js e interface em re, Processo principal, ponte e interface: main.js carrega configurações, cria CampaignStore, Engine, voz e componentes cooperativos. A janela abre renderer/index.h, Processo principal, ponte e interface: O renderer chama window.rpg, exposto por preload.js. A ponte encapsula ipcRenderer.invoke e apresenta funções de configur, Módulos observados: Ponte segura (+3 more)

### Community 20 - "Particulas"
Cohesion: 0.29
Nodes (3): COMPORTAMENTO, Particulas, rnd()

### Community 21 - "Documentação do Crônicas: Entradas"
Cohesion: 0.20
Nodes (10): Documentação do Crônicas, Hierarquia e uso: Depois de alterar código, execute graphify update . na raiz. Depois de alterar estes documentos, execute python docs/index-graphify.py com o P, Entradas: Processo Electron, ponte IPC e turno do Mestre, Entradas: Responsabilidades dos módulos e UI, Entradas: Campanha em arquivos, ficha, inventário e catálogo, Entradas: Erros comprovados e validações pendentes, Documentação do Crônicas: Estado mapeado em 2026-10-01. Estes documentos descrevem o código observado; recursos ainda não implementados ficam marcados como lacu, Hierarquia e uso: 1. Código é a fonte do comportamento verificável. Em caso de divergência, confira o módulo indicado e corrija esta documentação. 2. Documentos (+2 more)

### Community 22 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, dev, dist, dist:linux, dist:mac, dist:win, start, voz:instalar (+1 more)

### Community 23 - "claude-code.js"
Cohesion: 0.39
Nodes (7): crypto, executar(), matar(), parseResultado(), { spawn }, testar(), turno()

### Community 24 - "CronicasVoz.csproj"
Cohesion: 0.50
Nodes (3): net8.0, KokoroSharp.CPU (0.8.*), Microsoft.NET.Sdk

## Knowledge Gaps
- **220 isolated node(s):** `iniciar.sh script`, `{ app, BrowserWindow, ipcMain, shell, dialog, Menu, protocol, net }`, `{ pathToFileURL }`, `path`, `fs` (+215 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Processo principal, ponte e interface: O renderer chama window.rpg, exposto por preload.js. A ponte encapsula ipcRenderer.invoke e apresenta funções de configur` connect `Arquitetura observada` to `jogo.js`, `main.js`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Why does `Audio` connect `Audio` to `jogo.js`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `Módulos observados` connect `engine.js` to `jogo.js`, `campaign-store.js`, `Voz`, `Sala`, `Modelo de dados observado`, `Arquitetura observada`, `Documentação do Crônicas: Entradas`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **What connects `iniciar.sh script`, `{ app, BrowserWindow, ipcMain, shell, dialog, Menu, protocol, net }`, `{ pathToFileURL }` to the rest of the system?**
  _220 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `jogo.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07149106361704786 - nodes in this community are weakly interconnected._
- **Should `campaign-store.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05733397037744864 - nodes in this community are weakly interconnected._
- **Should `Audio` be split into smaller, more focused modules?**
  _Cohesion score 0.11380471380471381 - nodes in this community are weakly interconnected._