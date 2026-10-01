# Kit de interface dark fantasy — erros aprendidos

| Data | Decisão/Erro | Motivo | Agente |
| --- | --- | --- | --- |
| 2026-10-01 | Bordas de `bar-frame.png` e `frame-tooltip.png` ficaram invisíveis com `border-image-slice`; o CSS passou a usar `background-image` e borda CSS legível. | O slice era válido em sintaxe, mas incidia no padding transparente: em `bar-frame.png`, alfa acima de 20 só inicia em y=144 (slice usado: 55); em `frame-tooltip.png`, inicia em x=90 e y=176 (slice usado: 90). O `fill` também esticava o centro. | Broker |
