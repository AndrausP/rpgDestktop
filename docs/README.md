# Documentação do Crônicas

Estado mapeado em 2026-10-01. Estes documentos descrevem o código observado; recursos ainda não implementados ficam marcados como lacunas.

## Hierarquia e uso

1. **Código** é a fonte do comportamento verificável. Em caso de divergência, confira o módulo indicado e corrija esta documentação.
2. **Documentos canônicos** são a referência explicativa humana: [arquitetura](architecture.md), [módulos](modules.md), [modelo de dados](data-model.md) e [decisões](decisions.md).
3. **`graphify-out/` na raiz do repositório** é o índice consultável oficial. Consulte `graphify query "<pergunta>"` a partir da raiz; cada fato relevante deve apontar para um arquivo e local de origem.

Depois de alterar **código**, execute `graphify update .` na raiz. Depois de alterar **estes documentos**, execute `python docs/index-graphify.py` com o Python que tem o pacote graphify instalado; no PowerShell deste workspace, use `& (Get-Content graphify-out/.graphify_python) docs/index-graphify.py`. O script extrai apenas afirmações escritas, com linha de origem, e as mescla ao índice da raiz. Se precisar refazer a extração semântica com um modelo, use `graphify extract . --backend <backend>` com o backend configurado ou o fluxo assistido da [skill graphify](https://github.com/Graphify-Labs/graphify); `graphify extract .` sem backend não processa Markdown neste ambiente. Rode `graphify cluster-only . --no-label` para atualizar relatório e visualização, confirme com consultas sobre o assunto alterado e `graphify diagnose multigraph --graph graphify-out/graph.json`. A saída em `docs/knowledge/graphify-out/` é um índice anterior e separado: não é o ponto de consulta oficial.

## Entradas

| Assunto | Documento | Fonte principal |
| --- | --- | --- |
| Processo Electron, ponte IPC e turno do Mestre | [Arquitetura](architecture.md) | [`main.js`](../main.js), [`preload.js`](../preload.js), [`src/main/engine.js`](../src/main/engine.js) |
| Responsabilidades dos módulos e UI | [Módulos](modules.md) | [`src/main/`](../src/main/), [`renderer/js/`](../renderer/js/) |
| Campanha em arquivos, ficha, inventário e catálogo | [Modelo de dados](data-model.md) | [`src/main/campaign-store.js`](../src/main/campaign-store.js), [`src/main/catalogo.js`](../src/main/catalogo.js) |
| Escolhas da sessão | [Decisões](decisions.md) | Registro com motivo e agente |
| Erros comprovados e validações pendentes | [`knowledge/`](knowledge/) | Entradas com evidência; não equivale a requisito novo |

## Lacunas conhecidas

- O catálogo embutido reúne arte e metadados; os 20 retratos marcados `monstro:true` não contêm ficha mecânica própria. Veja [modelo de dados](data-model.md#catálogo-de-arte-e-metadados).
- Os documentos canônicos descrevem o CSS, pois a extração AST atual do graphify não produz nós CSS. Consulte [`renderer/css/`](../renderer/css/) para o comportamento visual real.
- O índice da raiz não substitui execução do app. A inspeção visual e interativa do wizard e do kit nas resoluções de referência continua pendente em [`knowledge/pending-validation.md`](knowledge/pending-validation.md).
