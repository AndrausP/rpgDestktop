# Arquitetura observada

Estado do código em 2026-10-01. O aplicativo é Electron, com processo principal em [`main.js`](../main.js#L1), ponte isolada em [`preload.js`](../preload.js#L1) e interface em [`renderer/index.html`](../renderer/index.html#L1). O pacote declara Electron `^44.4.5`, empacotamento de `main.js`, `preload.js`, `src/**/*` e `renderer/**/*`, e não declara script de teste em [`package.json`](../package.json#L1).

## Processo principal, ponte e interface

[`main.js`](../main.js#L31) carrega configurações, cria `CampaignStore`, `Engine`, voz e componentes cooperativos. A janela abre [`renderer/index.html`](../renderer/index.html#L1) em 1440×900, com mínimo de 1060×680; `contextIsolation`, `sandbox` e a ausência de `nodeIntegration` estão configurados em [`main.js`](../main.js#L54). O processo principal registra o protocolo `arte://` para arquivos embutidos, globais do usuário e específicos de campanha, com resolução restrita às raízes em [`src/main/catalogo.js`](../src/main/catalogo.js#L260).

O renderer chama `window.rpg`, exposto por [`preload.js`](../preload.js#L14). A ponte encapsula `ipcRenderer.invoke` e apresenta funções de configuração, catálogo, campanhas, jogo, inventário, combate, mapa, janela, voz, personagem e cooperação; erros IPC viram rejeições de Promise. A API é consumida em [`renderer/js/app.js`](../renderer/js/app.js#L14). Os handlers e a tradução para serviços ficam em [`main.js`](../main.js#L120).

[`renderer/index.html`](../renderer/index.html#L1) define CSP, CSS, palco, barra da janela e `#app`. O roteador em [`renderer/js/app.js`](../renderer/js/app.js#L24) recria o conteúdo das telas de início, criação e jogo. A tela de jogo compõe arena, lateral, histórico, rolagens e narração em [`renderer/js/telas/jogo.js`](../renderer/js/telas/jogo.js#L11).

## Fluxo de um turno

1. O renderer solicita a ação por `window.rpg.jogo.acao` em [`preload.js`](../preload.js#L63); o processo principal encaminha ao `Engine` por IPC em [`main.js`](../main.js#L120).
2. [`Engine`](../src/main/engine.js#L24) lê estado e configurações, escolhe demonstração, Claude Code ou Claude API, normaliza a resposta e aplica os eventos. Os provedores são [`demo.js`](../src/main/providers/demo.js), [`claude-code.js`](../src/main/providers/claude-code.js) e [`anthropic.js`](../src/main/providers/anthropic.js).
3. Durante a aplicação, o diário transacional e o `CampaignStore` persistem eventos, campanha e mensagem do Mestre; o retorno reúne `state`, `turno` e `logs` em [`engine.js`](../src/main/engine.js#L37). Em falha durante a aplicação, o turno é recuperado; em cancelamento, a ação sem resposta é removida em [`engine.js`](../src/main/engine.js#L139).

Os tipos de evento aceitos estão em [`src/main/regras.js`](../src/main/regras.js#L19). Sua aplicação a vida, mana, ouro, XP, status, atributos, itens e coleções está em [`src/main/eventos.js`](../src/main/eventos.js#L30). A lógica de NPC pode gravar vida e relação, mas isso não constitui uma ficha mecânica completa de monstro.

## Persistência e arte

[`CampaignStore`](../src/main/campaign-store.js#L1) usa arquivos JSON e Markdown por campanha. A composição do estado carregado está em [`campaign-store.js`](../src/main/campaign-store.js#L219). O catálogo embutido é definido em [`src/main/catalogo.js`](../src/main/catalogo.js#L1), com sobreposição de artes globais `_artes/` e artes por campanha `artes/` em [`catalogo.js`](../src/main/catalogo.js#L260). Consulte [modelo de dados](data-model.md) para estrutura e limites.

## Limites desta descrição

O grafo da raiz inclui relações extraídas de JavaScript e destes documentos. A extração AST observada não indexa CSS; para temas e layout, confira [`renderer/css/`](../renderer/css/) e [`renderer/js/temas.js`](../renderer/js/temas.js). O mapeamento não demonstra cobertura de testes automatizados: [`package.json`](../package.json#L6) não tem script `test`, e a varredura do Reader não encontrou arquivos de teste/spec.
