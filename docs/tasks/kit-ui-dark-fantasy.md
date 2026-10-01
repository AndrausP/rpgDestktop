# Kit de interface dark fantasy

## Estado em 2026-10-01

- Implementação entregue: 59 PNGs em `renderer/assets/ui/`; integração nos CSS e JS existentes; quatro exemplos em `examples/ui-contexts.html` para cidade, caverna, igreja e taverna.
- Verificação estática do QA: caminhos CSS/HTML/JS válidos, 24 módulos JS sintaticamente válidos, 13 temas e cenas existentes, WebP preservados e `git diff --check` sem erros.
- Validação visual e funcional pendente: a política do navegador para `file://` bloqueou captura e interação. Revisar início, criação, configuração e jogo; foco, hover, seleção e desabilitado; inventário, raridade, retrato e barras; troca dos 13 temas; screenshots e overflow em 1440×900 e 1060×680. O QA ainda não deu aprovação integral.
- Distribuição real dos 59 arquivos: `Backgrounds/` 2, `Frames/` 6, `Slots/` 10, `Buttons/` 4, `Icons/` 28, `Bars/` 4 e `Decoration/` 5. `location-marker.png` ficou em `Decoration/`, em vez de `Icons/` como previa a contagem inicial do contrato.
- Verificação técnica dos assets: 28 ícones de 128×128; as duas texturas finais têm 2048×2048 e diferença média RGB zero entre arestas opostas após ajuste de repetição de 96 px. A leitura dos ícones a 32 px continua pendente de inspeção visual.
- Memória compartilhada registrada em `docs/knowledge/` e `docs/decisions.md`. Os 2 documentos de `docs/knowledge/` foram indexados por extração semântica local e publicados também em `graphify-out/` na raiz para consultas padrão; consulta de teste e diagnóstico de integridade passaram.

## Viabilidade

Task: Gerar e aplicar kit modular de PNGs na interface Electron.

Veredito: ⚠️ viável com risco.

Motivo: O kit tem 59 arquivos e exige consistência entre peças, legibilidade nas telas e validação dos 13 temas. O trabalho cabe em lotes curtos; a geração e a revisão visual são o principal risco de prazo.

Para conclusão integral: validar os quatro exemplos de local nas duas resoluções de referência e percorrer os fluxos interativos indicados acima. Sem prazo fechado, não há bloqueio técnico de implementação.

Estimativas abaixo são dias úteis de trabalho em meio período. A geração dos PNGs é responsabilidade do broker/root; o frontend integra. Não há trabalho de backend, schema ou API.

## Contrato de assets

Diretório: `renderer/assets/ui/`, com as pastas existentes `Backgrounds/`, `Frames/`, `Slots/`, `Buttons/`, `Icons/`, `Bars/` e `Decoration/`. A capitalização dessas pastas é parte do caminho; os nomes dos arquivos são definidos pelo lote produzido pelo broker/root. Integradores devem consultar os arquivos reais antes de referenciá-los.

| Família | Arquivos | Quantidade |
| --- | --- | ---: |
| `Backgrounds/` | Fundo-base, fundo de destaque | 2 |
| `Frames/` | Painel, narrativa, retratos de jogador e inimigo, tooltip, card de NPC | 6 |
| `Slots/` | Vazio, hover, selecionado, equipado e raridades comum, incomum, raro, épico, lendário, único | 10 |
| `Buttons/` | Normal, hover, perigo, magia | 4 |
| `Icons/` | 7 menu, 6 ações, 9 status e 6 atributos | 28 |
| `Decoration/` | Dois separadores, indicador de aba, scrollbar e marcador de localização | 5 |
| `Bars/` | Moldura e fills de vida, mana, energia | 4 |

Todos os arquivos novos recebem extensão `.png`. Peças de interface e ícones têm transparência e vista frontal; texturas são repetíveis. Os primeiros arquivos reais são `Backgrounds/bg-panel-dark.png`, `Backgrounds/bg-leather.png`, `Frames/frame-panel.png` e `Frames/frame-portrait-player.png`. A sprite sheet sugerida no anexo é opcional e não substitui os arquivos individuais.

## Sequência

### [DESIGN] Especificar peças e quatro exemplos de local

O que fazer: Definir escala, transparência, área central legível, recortes para borda escalável e estados visuais. Especificar cidade (`cidade-mercado` + `cidade`), caverna (`caverna-cristais` + `masmorra`), igreja (`templo-celestial` + `celestial`) e taverna (`taverna` + `taverna`) usando cenas e temas existentes.

Critério de conclusão: Guia curto de aplicação entregue ao gerador e ao frontend; quatro exemplos descrevem o que varia na tela sem criar feature ou categoria nova.

Estimativa: 1 dia. Depende de: Nenhuma. Risco: Ornamentos ou brilho excessivo prejudicarem a leitura.

### [ASSETS] Gerar texturas e molduras

O que fazer: Gerar os 2 backgrounds e as 6 frames do contrato, mantendo ferro escuro, couro e carvão com vermelho discreto.

Critério de conclusão: 8 PNGs nas pastas existentes; texturas repetíveis; bordas e cantos íntegros ao escalar; centro preserva texto legível.

Estimativa: 1–2 dias. Depende de: Especificar peças. Risco: Centro opaco ou ornamentos excessivos.

### [ASSETS] Gerar controles, decoração e barras

O que fazer: Gerar 10 slots, 4 botões, 5 decorações (incluindo o marcador de localização) e 4 barras. Manter hover, selecionado, equipado, perigo e magia distinguíveis.

Critério de conclusão: 23 PNGs nas pastas existentes, com dimensões coerentes entre variantes; fills repetíveis na horizontal; estado neutro não depende do tema.

Estimativa: 2–3 dias. Depende de: Especificar peças. Risco: Variantes visualmente inconsistentes.

### [ASSETS] Gerar ícones de menu e ação

O que fazer: Gerar 7 ícones de menu e 6 de ação, transparentes e sem letras.

Critério de conclusão: 13 PNGs com silhuetas distinguíveis a 32 px e nomes confirmados pelo broker/root.

Estimativa: 2–3 dias. Depende de: Especificar peças. Risco: Perda de leitura em tamanho real.

### [ASSETS] Gerar ícones de status, atributos e localização

O que fazer: Gerar 9 ícones de status e 6 de atributo. O marcador de local fica em `Decoration/`.

Critério de conclusão: 15 PNGs com silhuetas distinguíveis a 32 px e nomes confirmados pelo broker/root, além do marcador contado em `Decoration/`.

Estimativa: 2–3 dias. Depende de: Especificar peças. Risco: Símbolos próximos entre si confundirem o usuário.

### [FRONTEND] Integrar base visual e controles comuns

O que fazer: Integrar `renderer/css/base.css` com texturas, molduras, botões, separadores e estados; usar borda escalável onde necessário. Preservar `--acento`, `--texto`, `--painel`, `--borda` e os 13 temas.

Critério de conclusão: Início, criação, configuração e modais seguem legíveis; foco, hover e desabilitado permanecem visíveis; sem distorcer cantos ou cobrir conteúdo.

Estimativa: 2 dias. Depende de: Texturas/molduras e controles. Risco: `border-image-slice` precisa ser medido no PNG final.

### [FRONTEND] Integrar HUD e ícones existentes

O que fazer: Integrar `renderer/css/jogo.css`, `renderer/css/telas.css` e `renderer/js/arte.js` nas áreas existentes: narrativa, retratos, NPCs, inventário, abas, cartas, barras e controles. Mapear ícones novos explicitamente e manter os 24 WebP do compêndio e fallback de itens. Mapear a raridade de dados `mitico` para a moldura visual `rarity-unique`, sem alterar persistência. A barra de energia é gerada, mas não cria uma barra nova na UI; a barra de XP existente mantém seu significado.

Critério de conclusão: Layout e cliques existentes preservados; cerca de 80% das superfícies ficam sem moldura decorativa, separadas por espaço, linha e contraste; peças geradas que não têm componente atual permanecem disponíveis no kit.

Estimativa: 2–3 dias. Depende de: Base visual, todos os assets. Risco: Recriação de `#app`, overflow em 1060×680 e conflito entre classes de estado.

### [QA] Validar kit, fluxo e quatro exemplos

O que fazer: Conferir 59 PNGs, transparência, dimensões e nomes; percorrer início, criação, configuração e jogo; capturar cidade, caverna, igreja/templo e taverna com cenas e temas existentes. Validar 1440×900 e 1060×680, foco/hover/selecionado/desabilitado, inventário/raridade, retrato, barras e troca dos 13 temas.

Critério de conclusão: Quatro exemplos visuais entregues, sem texto coberto ou corte, sem asset ausente e sem regressão funcional observada; falhas retornam ao responsável antes da conclusão.

Estimativa: 1–2 dias. Depende de: Integração do HUD. Risco: O asset de scrollbar combina trilho e pegador; rolagem nativa deve usar `::-webkit-scrollbar-track`/`thumb` em CSS, sem scrollbar JavaScript.

## Ordem de entrega

Design → lotes de assets em paralelo → base visual → HUD/ícones → QA. O checklist final exige os 59 PNGs mesmo quando alguma peça não é usada pela interface atual.

## Checklist de entrega

- [x] Gerar 59 PNGs e integrar o kit visual à interface.
- [x] Entregar quatro exemplos para cidade, caverna, igreja e taverna.
- [x] Passar nas verificações estáticas de caminhos, sintaxe JS, temas, cenas e diff.
- [ ] Validar visualmente e por interação os fluxos e exemplos em 1440×900 e 1060×680; conferir estados e overflow. Aprovação integral do QA depende desta etapa.
