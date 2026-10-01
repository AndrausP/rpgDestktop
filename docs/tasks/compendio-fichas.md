# Compêndio de fichas fixas — plano aprovado

Estado: escopo aprovado pelo Product Owner em 2026-10-01. A execução começa depois de consolidar o graphify como documentação oficial. O catálogo atual contém **28 itens** e **20 retratos marcados como monstro**; este plano completa esses registros, sem criar novos itens ou monstros.

## Veredito de viabilidade

Task: fichas fixas e compêndio com busca e filtros.
Veredito: ⚠️ viável com risco.
Motivo: o aplicativo é Electron/JavaScript e já possui catálogo e IPC; não há banco para campanhas. SQLite embutido é viável sem migrar campanhas, mas `node:sqlite` ainda emite aviso de recurso experimental e o arquivo precisa ser acessível fora do ASAR no aplicativo distribuído. A redação e conferência de 48 fichas é a maior parcela do trabalho para um desenvolvedor júnior em meio período.
Para virar ✅: validar o SQLite dentro do pacote Electron instalado e conferir, por ID, as 48 fichas com seus arquivos de arte e valores mecânicos antes da entrega.

**Decisão técnica:** usar um SQLite somente leitura para as fichas oficiais. Manter JSON/Markdown como fonte dos dados de campanha, inventário e NPCs. A planilha não oferece leitura empacotada e consulta no aplicativo sem adicionar dependências e fluxo de importação. O esquema e os dados de origem do SQLite devem ser versionados em formato textual, com geração reproduzível do arquivo distribuído; nenhuma edição manual do binário.

**Contrato mínimo:** `items` guarda `id`, nome, raridade, pasta, ícone, descrição, história e campos mecânicos opcionais como fórmula/tipo de dano, alcance e efeito. `item_aliases` associa cada apelido ao ID canônico. `monsters` guarda `id`, nome, descrição, história, tamanho, habitat, vida máxima, ataque e dano opcionais, além de habilidades. `null` significa atributo inaplicável ou não definido, nunca zero presumido. A fórmula da ficha é referência para o Mestre; o evento `dano` continua sendo um valor já resolvido. As fichas não sobrescrevem a vida corrente de NPCs de campanhas existentes.

## Sequência de execução

### 1. [BACKEND] Criar esquema e geração reproduzível do catálogo SQLite

O que fazer: criar esquema, restrições de unicidade/relacionamento, dados de origem textuais e gerador do `.sqlite`; configurar empacotamento para acesso fora do ASAR. Não tocar no formato das campanhas.

Critério de conclusão: banco gerado do zero contém tabelas válidas; IDs e aliases duplicados falham; `node:sqlite` abre em modo somente leitura no desenvolvimento e no pacote instalado.

Estimativa: 1–2 dias.

Depende de: Nenhuma.

Risco: API SQLite do Node experimental e caminho do banco após empacotamento.

### 2. [BACKEND] Completar as 28 fichas de itens existentes

O que fazer: preencher história, descrição clara e mecânica aplicável a cada `ITENS` existente, preservar nomes, IDs, raridades, pastas, apelidos e arte; dano só para itens que o causam. Efeitos especiais ficam separados da fórmula de dano.

Critério de conclusão: consulta por cada um dos 28 IDs retorna ficha íntegra; aliases resolvem para o ID canônico; nenhuma entrada nova; descrição e mecânica não se contradizem.

Estimativa: 2–3 dias.

Depende de: task 1.

Risco: coerência entre efeitos narrativos e valores que o motor realmente aplica.

### 3. [BACKEND] Completar as 20 fichas de monstros existentes

O que fazer: preencher história, descrição, habitat, tamanho, vida, ataque/dano e habilidades quando definidos para cada retrato `monstro: true`.

Critério de conclusão: 20 IDs consultáveis, cada um ligado ao retrato correto; campos mecânicos coerentes com `medio|grande|enorme` e `corpo|distancia` onde aplicável; nenhuma entrada nova.

Estimativa: 2–3 dias.

Depende de: task 1.

Risco: balanceamento inicial das criaturas; os valores serão referência de ficha, sem alterar combates salvos.

### 4. [BACKEND] Expor consulta e mesclar fichas à arte existente

O que fazer: repositório de leitura por ID e listagem; busca por nome, descrição e história com normalização de acentos/caixa; filtros fechados de item por pasta/raridade e de monstro por tamanho/habitat; IPC `compendio:listar` e `compendio:obter`; integrar por ID ao catálogo de arte. Ao aplicar arte global ou da campanha ao mesmo ID, preservar metadados oficiais e aliases, mantendo a precedência visual embutido → usuário → campanha. Itens personalizados permanecem livres.

Critério de conclusão: busca e filtros combinados retornam somente registros esperados; ID desconhecido tem resultado vazio claro; um PNG personalizado com ID oficial substitui apenas arte/metadados de apresentação permitidos; `item_ganho` conserva defaults existentes; campanhas antigas abrem sem migração.

Estimativa: 2–3 dias.

Depende de: tasks 2 e 3.

Risco: `Object.assign(cat.itens, ex.itens)` em `catalogo.montar` hoje apaga metadados embutidos quando a arte extra tem o mesmo ID.

### 5. [FRONTEND] Construir tela do compêndio

O que fazer: acesso pelo início e retorno seguro à tela anterior; abas Itens/Monstros, busca sem distinção de acentos, filtros combináveis conforme os campos reais, contagem, estado vazio, carregamento/erro e ficha detalhada com arte e história. Reusar tokens e componentes do design atual; manter navegação por teclado, rótulos e leitura responsiva.

Critério de conclusão: as 48 fichas podem ser encontradas e lidas; filtros combinados e limpeza funcionam; dados mecânicos opcionais não geram rótulos vazios; nenhuma ação altera inventário ou campanha.

Estimativa: 2–3 dias.

Depende de: task 4.

Risco: legibilidade da ficha em janela pequena.

### 6. [BACKEND] Alinhar o Mestre às fichas existentes

O que fazer: fornecer ao prompt do Mestre referências compactas das fichas oficiais relevantes e usar a vida inicial da ficha somente ao introduzir monstro oficial novo sem vida informada. Não sobrescrever vida ou dano de NPC persistido nem mudar a semântica dos eventos já resolvidos.

Critério de conclusão: um monstro oficial novo recebe referência consistente; inimigo livre ou NPC salvo mantém regra atual; item personalizado e alias continuam reconhecidos.

Estimativa: 1–2 dias.

Depende de: task 4.

Risco: aumento de tokens no prompt; limitar fichas incluídas ao contexto relevante.

### 7. [QA] Conferir dados, compatibilidade e distribuição

O que fazer: validar geração do banco e consultas com testes focados; verificar as 48 fichas por ID e os 20 retratos; testar busca com acentos, filtros combinados, estado vazio e teclado; abrir campanha antiga e item personalizado; testar um pacote Electron instalado.

Critério de conclusão: nenhum ID/alias órfão; zero fichas incompletas; consultas e filtros corretos; nenhum dado salvo alterado; SQLite abre no pacote distribuído. Registrar riscos residuais antes de entrega.

Estimativa: 1–2 dias.

Depende de: tasks 5 e 6.

Risco: o aplicativo empacotado é a única prova suficiente do caminho SQLite/ASAR.

**Ordem crítica:** 1 → (2 e 3) → 4 → (5 e 6) → 7. Para o único desenvolvedor em meio período, a estimativa somada é 11–18 dias de desenvolvimento, sem prometer paralelismo entre 2/3 ou 5/6.
