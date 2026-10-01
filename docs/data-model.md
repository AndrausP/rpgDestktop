# Modelo de dados observado

Estado em 2026-10-01. A persistência de campanha descrita em [`src/main/campaign-store.js`](../src/main/campaign-store.js#L1) usa **pastas e arquivos JSON/Markdown**, não uma base SQLite. O caminho raiz é definido pela configuração carregada em [`main.js`](../main.js#L31). O trecho da documentação antiga que cita `Documentos/Cronicas RPG` descreve o padrão de uso; o caminho efetivo depende da configuração.

## Campanha em disco

```text
<campanha>/
  campanha.json
  personagem.json
  CLAUDE.md
  inventario/<pasta>/<item>.json
  missoes/*.json
  npcs/*.json
  lugares/*.json
  historia/mensagens.json
  historia/cronica.md
  lore/*.md
  combate.json
  herois/<id>/...          (convidados de cooperação)
```

As pastas e arquivos principais aparecem no cabeçalho de [`campaign-store.js`](../src/main/campaign-store.js#L1), na criação em [`campaign-store.js`](../src/main/campaign-store.js#L114) e no carregamento em [`campaign-store.js`](../src/main/campaign-store.js#L219). O herói principal usa `personagem.json` na raiz; convidados usam `herois/<id>/`. `combate.json` contém mapa, turno e posições, com limite de 40 posições em [`campaign-store.js`](../src/main/campaign-store.js#L210).

## Ficha, inventário e coleções

[`montarPersonagem`](../src/main/campaign-store.js#L31) cria ficha com nome, raça, classe, ícone, retrato, aparência, voz, história, nível, XP, vida, mana, ouro, seis atributos e status. Os atributos admitidos são força, destreza, constituição, inteligência, sabedoria e carisma em [`src/main/regras.js`](../src/main/regras.js#L27).

O inventário é uma árvore de pastas com um JSON por item. [`ganharItem`](../src/main/campaign-store.js#L409) procura nome normalizado, incrementa quantidade quando encontra item existente e preserva descrição preenchida; um item novo grava nome, descrição, quantidade, raridade, equipado, ícone e data de obtenção. Itens livres podem ser criados durante o jogo: não precisam existir no catálogo embutido. Missões, NPCs e lugares são coleções em seus próprios arquivos; eventos `npc` podem gravar descrição, relação, retrato, tamanho, alcance, `vidaMax` e `vida` em [`src/main/eventos.js`](../src/main/eventos.js#L30). Esses campos não definem dano ou defesa mecânicos estruturados.

## Catálogo de arte e metadados

[`src/main/catalogo.js`](../src/main/catalogo.js#L1) exporta **31 cenas, 80 retratos, 28 itens e 10 mapas de batalha**; **20 retratos** têm `monstro: true`. A contagem foi feita sobre as listas exportadas pelo módulo. `ITENS` fornece id, nome, raridade, pasta, ícone, descrição e arquivo; alguns têm apelidos e família. Os retratos de monstro fornecem id, nome, descrição e arquivo. Não há ficha mecânica de monstro nem história estruturada de item nesses registros.

[`montar`](../src/main/catalogo.js#L260) combina arte embutida de [`renderer/assets/`](../renderer/assets/) com `_artes/` global do usuário e `artes/` da campanha, sobrepondo IDs quando há extras. [`comUrls`](../src/main/catalogo.js#L260) acrescenta URLs `arte://`; [`resolverUrl`](../src/main/catalogo.js#L260) restringe a resolução do caminho às raízes aceitas. O catálogo descreve arte/metadados, enquanto os itens efetivamente possuídos e NPCs conhecidos são arquivos da campanha.

## Regras de compatibilidade verificadas

A raridade persistida pode ser `mitico` em [`campaign-store.js`](../src/main/campaign-store.js#L25); o kit visual mapeia esse valor para a moldura `rarity-unique` sem renomear dados. O wizard de criação mantém o POST com campanha, personagem, atributos finais e itens iniciais conforme inspeção estática registrada em [`knowledge/pending-validation.md`](knowledge/pending-validation.md). Ainda falta confirmar o fluxo completo no aplicativo aberto.
