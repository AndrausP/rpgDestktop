# Kit de interface dark fantasy — pendências de validação

| Data | Decisão/Erro | Motivo | Agente |
| --- | --- | --- | --- |
| 2026-10-01 | Pendente validar visualmente e por interação o kit nas telas de início, criação, configuração e jogo, incluindo os quatro exemplos de local, os 13 temas e os estados de controle em 1440×900 e 1060×680. | A política de `file://` do navegador impediu screenshots, cliques e aferição de overflow. As verificações estáticas passaram, mas não comprovam ausência de corte, sobreposição ou regressão funcional. | QA / Jubileu |
| 2026-10-01 | Pendente percorrer o wizard de criação nas cinco etapas, incluindo navegação, validação, revisão, saída com alterações e envio, em 1440×900 e 1060×680. | A QA estática passou em sintaxe JS, diff, 31 seletores `data-*`, chaves CSS, referências de CSS/assets e estrutura do POST; a política de `file://` bloqueou a execução visual e por interação. | Broker |
