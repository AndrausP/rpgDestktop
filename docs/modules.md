# Módulos observados

Esta tabela descreve responsabilidades identificadas em 2026-10-01. Para comportamento exato, siga os arquivos de origem.

| Área | Responsabilidade observada | Fontes |
| --- | --- | --- |
| Inicialização e IPC | Cria janela, configura diretório de dados, serviços, protocolo `arte://`, handlers IPC e observação de campanha. | [`main.js`](../main.js#L1) |
| Ponte segura | Expõe `window.rpg` e converte respostas IPC em dados ou erros de Promise. | [`preload.js`](../preload.js#L1) |
| Campanhas e arquivos | Cria, lista, carrega e salva campanha, ficha, inventário, coleções, história e combate em JSON/Markdown. | [`campaign-store.js`](../src/main/campaign-store.js#L1) |
| Turnos do Mestre | Escolhe provedor, processa resposta, aplica eventos com diário transacional e retorna estado atualizado. | [`engine.js`](../src/main/engine.js#L1), [`diario.js`](../src/main/diario.js), [`turno.js`](../src/main/turno.js) |
| Provedores | Implementam demonstração, Claude Code CLI e Claude API. | [`providers/`](../src/main/providers/) |
| Regras e eventos | Define 13 temas, seis atributos e tipos de evento; aplica efeitos ao estado da campanha. | [`regras.js`](../src/main/regras.js#L1), [`eventos.js`](../src/main/eventos.js#L30) |
| Catálogo e arte | Define cenas, retratos, itens e mapas embutidos; combina arte de usuário/campanha e gera URLs `arte://`. | [`catalogo.js`](../src/main/catalogo.js#L1) |
| Mapa | Consulta locais e rotas para o mapa-múndi e a posição válida no turno. | [`mapa.js`](../src/main/mapa.js), [`engine.js`](../src/main/engine.js#L139) |
| Voz | Gerencia serviço de voz, instalação, presets e eventos enviados ao renderer. | [`voz.js`](../src/main/voz.js), [`voz-instalador.js`](../src/main/voz-instalador.js), [`voz-presets.js`](../src/main/voz-presets.js) |
| Cooperação | Servidor da sala e cliente convidado. | [`coop/servidor.js`](../src/main/coop/servidor.js), [`coop/cliente.js`](../src/main/coop/cliente.js) |
| Interface | Inicializa `window.rpg`, recria telas e compõe a tela de jogo. | [`app.js`](../renderer/js/app.js#L14), [`telas/`](../renderer/js/telas/), [`jogo.js`](../renderer/js/telas/jogo.js#L11) |
| Aparência | Define estrutura HTML, CSS comum/de telas/do jogo/do wizard e temas visuais. | [`index.html`](../renderer/index.html#L1), [`css/`](../renderer/css/), [`temas.js`](../renderer/js/temas.js) |

## Catálogo atual e limite

As listas exportadas por [`src/main/catalogo.js`](../src/main/catalogo.js#L1) contêm **31 cenas**, **80 retratos**, **28 itens** e **10 mapas de batalha**; **20 retratos** têm `monstro: true`. Os números foram conferidos nas exportações do módulo. `ITENS` guarda id, nome, raridade, pasta, ícone, descrição e arquivo, com apelidos ou família em alguns registros. Os retratos de monstro têm id, nome, descrição e arquivo; não há ficha mecânica própria nesses objetos. Veja [modelo de dados](data-model.md#catálogo-de-arte-e-metadados).

## Interface e temas

[`renderer/js/app.js`](../renderer/js/app.js#L24) alterna início, jogo e criação reconstruindo `#app`. O wizard fica em [`renderer/js/telas/criacao.js`](../renderer/js/telas/criacao.js) e [`renderer/css/criacao.css`](../renderer/css/criacao.css). Os 13 temas são enumerados no processo principal em [`src/main/regras.js`](../src/main/regras.js#L3) e aplicados no renderer por [`renderer/js/temas.js`](../renderer/js/temas.js). O kit PNG ocupa [`renderer/assets/ui/`](../renderer/assets/ui/); o CSS permanece fonte do resultado visual e não foi extraído como nós AST pelo graphify.
