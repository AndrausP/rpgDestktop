# Graph Report - docs\knowledge  (2026-10-01)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 9 nodes · 8 edges · 3 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e1bac2a3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Validação visual e funcional pendente
- border-image-slice invisível
- Validação visual e interativa do wizard pendente

## God Nodes (most connected - your core abstractions)
1. `Validação visual e funcional pendente` - 4 edges
2. `Validação visual e interativa do wizard pendente` - 3 edges
3. `border-image-slice invisível` - 2 edges
4. `Política file:// do navegador` - 2 edges
5. `Padding transparente dos PNGs` - 1 edges
6. `background-image e borda CSS` - 1 edges
7. `Verificações estáticas do QA` - 1 edges
8. `Kit de interface dark fantasy` - 1 edges
9. `QA estática do wizard aprovada` - 1 edges

## Surprising Connections (you probably didn't know these)
- `Validação visual e funcional pendente` --references--> `Política file:// do navegador`  [EXTRACTED]
  pending-validation.md → pending-validation.md  _Bridges community 0 → community 2_

## Communities (3 total, 0 thin omitted)

### Community 0 - "Validação visual e funcional pendente"
Cohesion: 0.67
Nodes (3): Kit de interface dark fantasy, Validação visual e funcional pendente, Verificações estáticas do QA

### Community 1 - "border-image-slice invisível"
Cohesion: 0.67
Nodes (3): background-image e borda CSS, border-image-slice invisível, Padding transparente dos PNGs

### Community 2 - "Validação visual e interativa do wizard pendente"
Cohesion: 0.67
Nodes (3): Política file:// do navegador, QA estática do wizard aprovada, Validação visual e interativa do wizard pendente

## Knowledge Gaps
- **5 isolated node(s):** `Padding transparente dos PNGs`, `background-image e borda CSS`, `Verificações estáticas do QA`, `Kit de interface dark fantasy`, `QA estática do wizard aprovada`
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Validação visual e funcional pendente` connect `Validação visual e funcional pendente` to `Validação visual e interativa do wizard pendente`?**
  _High betweenness centrality (0.250) - this node is a cross-community bridge._
- **Why does `Validação visual e interativa do wizard pendente` connect `Validação visual e interativa do wizard pendente` to `Validação visual e funcional pendente`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **What connects `Padding transparente dos PNGs`, `background-image e borda CSS`, `Verificações estáticas do QA` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._