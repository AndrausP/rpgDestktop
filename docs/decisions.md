# Decisões

## Sessão 2026-10-01 — kit de interface dark fantasy

| Data | Decisão/Erro | Motivo | Agente |
| --- | --- | --- | --- |
| 2026-10-01 | Aplicar o kit modular de 59 PNGs à interface Electron e entregar exemplos de cidade, caverna, igreja e taverna usando pares de cena e tema já existentes. | O usuário autorizou gerar e aplicar o visual e pediu exemplos das mudanças de tela por situação; reutilizar cenas e temas evita criar categorias ou comportamento novos. | Product Owner / Broker |
| 2026-10-01 | Manter os 13 temas, as variáveis `--acento`, `--texto`, `--painel` e `--borda`, os WebP do compêndio e os contratos de dados existentes. Mapear `mitico` para a moldura visual `rarity-unique`; manter XP com seu significado atual e a barra de energia apenas como asset do kit. | O pedido é visual; preservar esses contratos reduz regressões na interface e na persistência. | Tech Lead / Architect |
| 2026-10-01 | Preferir superfícies limpas, linhas e contraste; reservar molduras decorativas para elementos que precisam de ênfase. Usar estados visíveis de foco, hover, seleção e desabilitado. | A narrativa precisa permanecer legível e a ornamentação excessiva dificultaria a leitura e o reconhecimento das ações. | Designer / Product Owner |
| 2026-10-01 | Guardar `location-marker.png` em `renderer/assets/ui/Decoration/`; distribuição final: 28 arquivos em `Icons/` e 5 em `Decoration/`, mantendo 59 PNGs no total. | O marcador funciona como peça decorativa de localização e esse é o caminho real do asset gerado; registrar a distribuição evita referências ao caminho previsto inicialmente. | Broker |

## Sessão 2026-10-01 — criação guiada

| Data | Decisão/Erro | Motivo | Agente |
| --- | --- | --- | --- |
| 2026-10-01 | Organizar a criação em cinco etapas — Mundo, História, Herói, Atributos e Revisão — com validação inline por etapa, foco no campo inválido, revisão editável e estado preservado ao navegar entre etapas. | A tela anterior apresentava mundo e herói em dois painéis simultâneos; a sequência guiada distribui as escolhas sem perder o que já foi preenchido. | Broker / Frontend |
| 2026-10-01 | Confirmar a saída quando houver alterações e fazer um único envio com estado de carregamento e erro recuperável, preservando no POST campanha, personagem, atributos finais e itens iniciais. | A confirmação protege o preenchimento em andamento; a compatibilidade da estrutura enviada preserva a criação de campanhas existente. | Broker / Frontend |
| 2026-10-01 | Aplicar materiais e tokens do kit dark fantasy ao wizard, com layout responsivo e estados ARIA nos controles. | A criação deve seguir a identidade visual aprovada e expor etapa, seleção e erros durante o preenchimento. | Broker / Frontend |
| 2026-10-01 | Usar seis PNGs transparentes próprios para as classes em `renderer/assets/ui/Icons/classes/` e reutilizar ícones existentes do kit nos cabeçalhos, atributos, recursos, dado, CTA e localização do wizard. | Os ícones próprios distinguem as seis classes; reutilizar as demais peças mantém a linguagem visual do kit sem criar cópias para funções já representadas. | Broker |

## Sessão 2026-10-01 — documentação oficial

| Data | Decisão/Erro | Motivo | Agente |
| --- | --- | --- | --- |
| 2026-10-01 | Usar o código como fonte do comportamento verificável, `docs/` canônico como referência humana e `graphify-out/` da raiz como índice consultável oficial; atualizar o índice após mudanças em código ou documentação. | O grafo anterior de `docs/knowledge/` é separado e não cobre a arquitetura inteira; a hierarquia explicita onde conferir fatos e impede que a consulta oficial dependa de um índice parcial. | Broker / Writer |
