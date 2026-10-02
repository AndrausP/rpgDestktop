import { $, $$, esc, h, confirmar, toast, ATRIBUTOS, ABREV_ATR, NOME_ATR, mod, fmtMod, rolar } from '../ui.js';
import { api, irPara, S } from '../app.js';
import { setTema, setCena, audio } from '../cenario.js';
import { setBarra } from '../barra.js';
import { urlCena, urlRetrato, iconeHtml, iconeKitHtml, iconeItemHtml } from '../arte.js';
import { escolherRetrato, opcoesVoz, ouvirVoz } from '../heroi.js';
import { vozDoNpc } from '../vozes.js';
import { lsGet, lsSet } from '../jogo/util.js';

const CENARIOS = [
  { n: 'Fantasia épica', d: 'Reinos, dragões, magia antiga e heróis lendários.', tema: 'taverna', arte: 'cidade-mercado', local: 'Cidade de Valen' },
  { n: 'Dark fantasy', d: 'Mundo cruel, magia corrompida, esperança escassa.', tema: 'masmorra', arte: 'fortaleza-sombria', local: 'Marca Cinzenta' },
  { n: 'Horror gótico', d: 'Vilarejos amaldiçoados, vampiros, cultos e névoa.', tema: 'horror', arte: 'cemiterio', local: 'Vila de Morrowgate' },
  { n: 'Piratas & mares', d: 'Ilhas, tesouros, navios fantasmas e monstros marinhos.', tema: 'mar', arte: 'porto', local: 'Porto Cinzento' },
  { n: 'Impérios do deserto', d: 'Sultanatos, djinns e cidades soterradas pela areia.', tema: 'deserto', arte: 'cidade-deserto', local: 'Qadir, a Cidade das Fontes' },
  { n: 'Terras congeladas', d: 'Clãs do norte, gigantes de gelo e invernos eternos.', tema: 'neve', arte: 'montanha-nevada', local: 'Passo de Hrimfjell' },
  { n: 'Academia arcana', d: 'Escolas de magia, rivalidades e segredos proibidos.', tema: 'arcano', arte: 'caverna-cristais', local: 'Academia de Lúmen' },
  { n: 'Personalizado', d: 'Descreva seu próprio mundo abaixo.', tema: 'noite', arte: null, local: '' },
];
const TONS = ['Épico e heroico', 'Sombrio e brutal', 'Aventura leve com humor', 'Mistério e investigação', 'Terror psicológico'];
export const RACAS = {
  Humano: { forca: 1, destreza: 1, constituicao: 1, inteligencia: 1, sabedoria: 1, carisma: 1 },
  Elfo: { destreza: 2, inteligencia: 1 },
  Anão: { constituicao: 2, forca: 1 },
  Halfling: { destreza: 2, carisma: 1 },
  'Meio-orc': { forca: 2, constituicao: 1 },
  Tiefling: { carisma: 2, inteligencia: 1 },
  Draconato: { forca: 2, carisma: 1 },
};
export const CLASSES = {
  Guerreiro: {
    ic: '⚔️', cor: '#9e2219', retrato: 'guerreiro', d: 'Aço e coragem', vida: 12, mana: 0, ouro: 15,
    base: { forca: 15, destreza: 12, constituicao: 14, inteligencia: 8, sabedoria: 10, carisma: 13 },
    itens: [
      { nome: 'Espada Longa', pasta: 'armas', descricao: '1d8 de dano cortante.', equipado: true },
      { nome: 'Escudo de Carvalho', pasta: 'armaduras', descricao: '+2 de defesa.', equipado: true },
      { nome: 'Cota de Malha', pasta: 'armaduras', descricao: 'Pesada, mas confiável.', equipado: true },
      { nome: 'Poção de Vida Menor', pasta: 'consumiveis', descricao: 'Recupera 2d4+2 de vida.', quantidade: 2 },
    ],
  },
  Mago: {
    ic: '🔮', cor: '#4d2596', retrato: 'maga-elfa', d: 'Magia arcana', vida: 6, mana: 12, ouro: 20,
    base: { forca: 8, destreza: 13, constituicao: 14, inteligencia: 15, sabedoria: 12, carisma: 10 },
    itens: [
      { nome: 'Cajado Rúnico', pasta: 'armas', descricao: 'Canaliza feitiços: +1 em magias. 1d6 contundente.', equipado: true, raridade: 'raro' },
      { nome: 'Grimório do Aprendiz', pasta: 'itens-chave', descricao: 'Seus feitiços: Míssil Mágico, Escudo Arcano, Luz.' },
      { nome: 'Manto do Aprendiz', pasta: 'armaduras', descricao: 'Tecido encantado, leve.', equipado: true },
      { nome: 'Poção de Mana', pasta: 'consumiveis', descricao: 'Recupera 6 de mana.', quantidade: 2 },
    ],
  },
  Ladino: {
    ic: '🗡️', cor: '#4f3b26', retrato: 'ladino-encapuzado', d: 'Sombras e astúcia', vida: 8, mana: 2, ouro: 30,
    base: { forca: 10, destreza: 15, constituicao: 13, inteligencia: 12, sabedoria: 8, carisma: 14 },
    itens: [
      { nome: 'Adaga do Viajante', quantidade: 2, pasta: 'armas', descricao: '1d4 cada; ataque furtivo +2d6.', equipado: true },
      { nome: 'Gazuas', pasta: 'ferramentas', descricao: 'Abrem fechaduras comuns.' },
      { nome: 'Capa das Sombras', pasta: 'armaduras', descricao: 'Vantagem em furtividade à noite.', equipado: true, raridade: 'incomum' },
      { nome: 'Bomba de Fumaça', pasta: 'consumiveis', descricao: 'Cria uma nuvem densa por 1 minuto.', quantidade: 2 },
    ],
  },
  Clérigo: {
    ic: '☀️', cor: '#6e5114', retrato: 'paladina', d: 'Fé e cura', vida: 10, mana: 8, ouro: 15,
    base: { forca: 13, destreza: 8, constituicao: 14, inteligencia: 10, sabedoria: 15, carisma: 12 },
    itens: [
      { nome: 'Maça Sagrada', pasta: 'armas', descricao: '1d6 contundente, +1d4 contra mortos-vivos.', equipado: true },
      { nome: 'Símbolo Sagrado', pasta: 'itens-chave', descricao: 'Foco das suas orações.' },
      { nome: 'Cota de Escamas', pasta: 'armaduras', descricao: 'Proteção média.', equipado: true },
      { nome: 'Água Benta', pasta: 'consumiveis', descricao: '2d6 radiante em mortos-vivos.', quantidade: 2 },
    ],
  },
  Patrulheiro: {
    ic: '🏹', cor: '#1d5226', retrato: 'arqueira', d: 'Arco e trilha', vida: 10, mana: 4, ouro: 15,
    base: { forca: 12, destreza: 15, constituicao: 13, inteligencia: 10, sabedoria: 14, carisma: 8 },
    itens: [
      { nome: 'Arco Folha-Verde', pasta: 'armas', descricao: '1d8 perfurante. Madeira élfica que nunca empena.', equipado: true, raridade: 'incomum' },
      { nome: 'Flechas', pasta: 'municao', descricao: 'Flechas comuns.', quantidade: 20 },
      { nome: 'Gibão de Couro', pasta: 'armaduras', descricao: 'Leve e silencioso.', equipado: true },
      { nome: 'Kit de Ervas', pasta: 'consumiveis', descricao: 'Cura 1d6 fora de combate.', quantidade: 3 },
    ],
  },
  Bardo: {
    ic: '🪕', cor: '#5e1f3f', retrato: 'mercenaria', d: 'Charme e canção', vida: 8, mana: 8, ouro: 25,
    base: { forca: 8, destreza: 14, constituicao: 12, inteligencia: 13, sabedoria: 10, carisma: 15 },
    itens: [
      { nome: 'Rapieira', pasta: 'armas', descricao: '1d8 perfurante, elegante.', equipado: true },
      { nome: 'Alaúde', pasta: 'diversos', descricao: 'Instrumento e foco mágico.', raridade: 'incomum' },
      { nome: 'Gibão Bordado', pasta: 'armaduras', descricao: 'Chama atenção (para o bem e para o mal).', equipado: true },
      { nome: 'Poção de Vida Menor', pasta: 'consumiveis', descricao: 'Recupera 2d4+2 de vida.' },
    ],
  },
};
const ICONES = ['⚔️', '🛡️', '🔮', '🗡️', '🏹', '✨', '🎻', '🐺', '🦉', '🐉', '👑', '💀', '🌙', '🔥', '🌿', '🧙', '🧝', '🧛'];
const CUSTO = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

const ICONE_ATR = { forca: 'str', destreza: 'dex', constituicao: 'constitution', inteligencia: 'int', sabedoria: 'wis', carisma: 'cha' };
const ICONE_CLASSE = { Guerreiro: 'warrior', Mago: 'mage', Ladino: 'rogue', Clérigo: 'cleric', Patrulheiro: 'ranger', Bardo: 'bard' };
export const RETRATO_RACA = { Anão: 'ferreiro-anao', 'Meio-orc': 'orc' };

/** Criação guiada da campanha e do herói. */
export function telaCriacao(raiz) {
  const st = {
    nome: '', cenario: CENARIOS[0], cenarioCustom: '', tom: TONS[0], premissa: '',
    heroi: '', raca: 'Humano', classe: 'Guerreiro', icone: '⚔️', historia: '',
    retrato: 'guerreiro', retratoManual: false, imagem: null, aparencia: '', voz: '', vozManual: false, idioma: 'pt',
    base: { ...CLASSES.Guerreiro.base }, rolado: false,
  };
  const etapas = [
    { nome: 'Mundo', descricao: 'O cenário define o primeiro lugar que você vai explorar.' },
    { nome: 'História', descricao: 'Escolha o nome, o tom e o idioma da aventura.' },
    { nome: 'Herói', descricao: 'Um nome, uma origem e um caminho para seguir.' },
    { nome: 'Atributos', descricao: 'Ajuste seus atributos e os últimos detalhes do personagem.' },
    { nome: 'Revisão', descricao: 'Confira suas escolhas. Você pode editar qualquer etapa.' },
  ];
  const arte = (id) => urlCena(id) || '';
  const criarLabel = `${iconeKitHtml('actions', 'attack')} Começar a aventura`;
  let etapa = 0;
  let maiorEtapa = 0;
  let editandoRevisao = false;
  let alterado = false;
  let enviando = false;
  let vivo = true;

  const el = h(`
    <main class="wizard-criacao" aria-label="Criação de campanha e personagem">
      <div class="wizard-page">
        <header class="wizard-intro">
          <span class="wizard-eyebrow">NOVA AVENTURA <span aria-hidden="true">✦</span> CRIAÇÃO GUIADA</span>
          <div class="wizard-intro-line"><div><h1>Escreva sua lenda</h1><p>Um mundo para explorar. Um herói para chamar de seu.</p></div><span class="wizard-count" data-contador aria-live="polite">01 / 05</span></div>
          <nav class="wizard-progress" aria-label="Etapas da criação">
            ${etapas.map((item, i) => `<button type="button" class="wizard-step" data-ir-etapa="${i}" ${i ? 'disabled' : 'aria-current="step"'} aria-label="Etapa ${i + 1} de 5: ${item.nome}"><span class="wizard-step-num">${String(i + 1).padStart(2, '0')}</span><span class="wizard-step-label">${item.nome}</span></button>`).join('')}
          </nav>
        </header>

        <div class="wizard-layout">
          <form class="wizard-form" novalidate>
            <section class="wizard-panel" data-etapa="0" aria-labelledby="wizard-titulo-0">
              <div class="wizard-panel-head"><span class="wizard-panel-icon" aria-hidden="true">${iconeKitHtml('menu', 'locations')}</span><span class="wizard-kicker">CAPÍTULO I · O MUNDO</span><h2 id="wizard-titulo-0" tabindex="-1">Escolha o mundo</h2><p>${etapas[0].descricao}</p></div>
              <div class="wizard-section-label"><span>Cenário da aventura</span><small>Escolha um ponto de partida</small></div>
              <div class="wizard-scenarios" role="group" aria-label="Cenário da aventura">
                ${CENARIOS.map((c, i) => `<button type="button" class="wizard-scenario ${i === 0 ? 'sel' : ''}" data-i="${i}" aria-pressed="${i === 0}" ${c.arte ? `style="background-image:linear-gradient(180deg,rgba(11,10,9,.10),rgba(11,10,9,.96)),url('${arte(c.arte)}')"` : ''}><span class="wizard-scenario-mark" aria-hidden="true">${c.arte ? '✦' : '✧'}</span><strong>${esc(c.n)}</strong><small>${esc(c.d)}</small></button>`).join('')}
              </div>
              <div class="wizard-custom" data-custom hidden><label for="wizard-cenario-custom">Descreva seu mundo <span class="wizard-required">*</span></label><p>Conte ao mestre sobre a época, a magia e os lugares que tornam esse cenário único.</p><textarea id="wizard-cenario-custom" class="campo" data-f="cenarioCustom" aria-describedby="wizard-erro-cenarioCustom" placeholder="Ex.: cidades nas costas de gigantes, onde a magia é extraída das estrelas..."></textarea><span class="wizard-error" id="wizard-erro-cenarioCustom" data-erro="cenarioCustom" role="alert"></span></div>
            </section>

            <section class="wizard-panel" data-etapa="1" aria-labelledby="wizard-titulo-1" hidden>
              <div class="wizard-panel-head"><span class="wizard-panel-icon" aria-hidden="true">${iconeKitHtml('menu', 'quests')}</span><span class="wizard-kicker">CAPÍTULO II · A HISTÓRIA</span><h2 id="wizard-titulo-1" tabindex="-1">Dê vida à história</h2><p>${etapas[1].descricao}</p></div>
              <div class="wizard-field"><label for="wizard-nome">Nome da campanha <span class="wizard-required">*</span></label><p>Como esta jornada será lembrada?</p><input id="wizard-nome" class="campo" data-f="nome" maxlength="60" aria-describedby="wizard-erro-nome" placeholder="Ex.: A Queda de Vel'Darim"><span class="wizard-error" id="wizard-erro-nome" data-erro="nome" role="alert"></span></div>
              <div class="wizard-field"><label for="wizard-tom">Tom da narrativa</label><p>O mestre adapta as descrições e os acontecimentos a este clima.</p><select id="wizard-tom" class="campo" data-f="tom">${TONS.map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
              <div class="wizard-field"><span class="wizard-field-title" id="wizard-idioma-label">Idioma da história</span><p>Narração, falas e vozes usarão este idioma.</p><div class="wizard-idiomas" role="group" aria-labelledby="wizard-idioma-label"><button type="button" class="wizard-idioma sel" data-idioma="pt" aria-pressed="true"><span class="wizard-language-mark" aria-hidden="true">PT</span><span><b>Português</b><small>Vozes brasileiras</small></span></button><button type="button" class="wizard-idioma" data-idioma="en" aria-pressed="false"><span class="wizard-language-mark" aria-hidden="true">EN</span><span><b>English</b><small>American and British voices</small></span></button></div></div>
              <div class="wizard-field"><label for="wizard-premissa">Premissa ou gancho <small>opcional</small></label><p>Uma ideia inicial para o mestre desenvolver com você.</p><textarea id="wizard-premissa" class="campo" data-f="premissa" placeholder="Ex.: Você acorda num navio sem memória, com uma marca brilhando no pulso..."></textarea></div>
              <div class="wizard-note">Você poderá expandir os detalhes do mundo ao longo da aventura.</div>
            </section>

            <section class="wizard-panel" data-etapa="2" aria-labelledby="wizard-titulo-2" hidden>
              <div class="wizard-panel-head"><span class="wizard-panel-icon" aria-hidden="true">${iconeKitHtml('menu', 'npcs')}</span><span class="wizard-kicker">CAPÍTULO III · O HERÓI</span><h2 id="wizard-titulo-2" tabindex="-1">Conheça seu herói</h2><p>${etapas[2].descricao}</p></div>
              <div class="wizard-hero-top"><div class="wizard-hero-fields"><div class="wizard-field"><label for="wizard-heroi">Nome do herói <span class="wizard-required">*</span></label><p>O nome que os habitantes deste mundo vão conhecer.</p><input id="wizard-heroi" class="campo" data-f="heroi" maxlength="40" aria-describedby="wizard-erro-heroi" placeholder="Ex.: Kael Ventoferro"><span class="wizard-error" id="wizard-erro-heroi" data-erro="heroi" role="alert"></span></div><div class="wizard-field"><label for="wizard-raca">Raça</label><p>Sua origem concede bônus aos atributos.</p><select id="wizard-raca" class="campo" data-f="raca">${Object.keys(RACAS).map((r) => `<option>${esc(r)}</option>`).join('')}</select></div></div><button type="button" class="wizard-portrait" data-trocar-retrato aria-label="Trocar retrato do herói ou enviar uma imagem"><img data-img-retrato alt="Retrato atual do herói"><span>Trocar retrato</span></button></div>
              <div class="wizard-section-label"><span>Classe do herói</span><small>Seu estilo de jogo e equipamento inicial</small></div>
              <div class="wizard-classes" role="group" aria-label="Classe do herói">${Object.entries(CLASSES).map(([n, c]) => `<button type="button" class="wizard-class ${n === 'Guerreiro' ? 'sel' : ''}" data-c="${esc(n)}" aria-pressed="${n === 'Guerreiro'}" style="--classe-cor:${c.cor}"><span class="wizard-class-icon" aria-hidden="true">${iconeKitHtml('classes', ICONE_CLASSE[n])}</span><span><strong>${esc(n)}</strong><small>${esc(c.d)}</small></span><span class="wizard-class-check" aria-hidden="true">✓</span></button>`).join('')}</div>
            </section>

            <section class="wizard-panel" data-etapa="3" aria-labelledby="wizard-titulo-3" hidden>
              <div class="wizard-panel-head"><span class="wizard-panel-icon" aria-hidden="true">${iconeKitHtml('menu', 'dice')}</span><span class="wizard-kicker">CAPÍTULO IV · HABILIDADES</span><h2 id="wizard-titulo-3" tabindex="-1">Forje suas habilidades</h2><p>${etapas[3].descricao}</p></div>
              <div class="wizard-attribute-head"><div><span class="wizard-section-label solo">Atributos</span><p>Use até 27 pontos para ajustar os valores ou role os dados.</p></div><div class="wizard-attribute-actions"><button type="button" class="btn" data-padrao>↻ Padrão da classe</button><button type="button" class="btn" data-rolar>${iconeKitHtml('menu', 'dice')} Rolar 4d6</button></div></div>
              <div class="wizard-points" data-pontos aria-live="polite"></div><div class="wizard-attributes" data-atribs></div>
              <div class="wizard-field"><label for="wizard-aparencia">Aparência <small>opcional</small></label><p>O mestre pode usar estes detalhes ao descrever seu herói.</p><textarea id="wizard-aparencia" class="campo" data-f="aparencia" maxlength="1500" placeholder="Ex.: cabelo ruivo trançado, cicatriz no queixo e capa de viagem..."></textarea></div>
              <div class="wizard-field"><label for="wizard-voz">Voz do herói</label><p>Você pode ouvir uma amostra antes de começar.</p><div class="wizard-voice"><select id="wizard-voz" class="campo" data-voz-heroi></select><button type="button" class="btn" data-ouvir-voz aria-label="Ouvir amostra da voz do herói">▶ Ouvir</button></div></div>
              <div class="wizard-field"><label for="wizard-historia">História do personagem <small>opcional</small></label><p>De onde veio? O que busca? O que teme?</p><textarea id="wizard-historia" class="campo" data-f="historia" placeholder="Uma memória, uma promessa ou um segredo que o acompanha..."></textarea></div>
              <div class="wizard-starting" data-resumo></div>
            </section>

            <section class="wizard-panel" data-etapa="4" aria-labelledby="wizard-titulo-4" hidden>
              <div class="wizard-panel-head"><span class="wizard-panel-icon" aria-hidden="true">${iconeKitHtml('menu', 'grimoire')}</span><span class="wizard-kicker">CAPÍTULO V · REVISÃO</span><h2 id="wizard-titulo-4" tabindex="-1">Tudo pronto para começar?</h2><p>${etapas[4].descricao}</p></div>
              <div class="wizard-review" data-revisao></div>
              <div class="wizard-field wizard-coop"><label><input type="checkbox" data-coop-convidar> 🤝 Convidar amigos (co-op)</label><p>Abre uma sala assim que a campanha for criada — até 2 amigos na mesma rede entram com o código.</p><input class="campo" data-coop-nome maxlength="30" placeholder="Seu nome na mesa (ex.: Felipe)" hidden></div>
              <div class="wizard-error wizard-submit-error" data-erro-envio role="alert"></div>
            </section>
          </form>

          <aside class="wizard-preview" aria-label="Prévia da aventura"><div class="wizard-preview-art" data-preview-art></div><div class="wizard-preview-content"><span class="wizard-preview-kicker">SUA AVENTURA COMEÇA EM</span><div class="wizard-preview-location">${iconeKitHtml('menu', 'locations')}<strong data-preview-local></strong></div><p data-preview-mundo></p><div class="wizard-preview-divider"></div><span class="wizard-preview-kicker">SEU HERÓI</span><div class="wizard-preview-hero"><img data-preview-retrato alt=""><div><strong data-preview-heroi>Herói sem nome</strong><span data-preview-classe>Humano · Guerreiro</span></div></div></div></aside>
        </div>

        <footer class="wizard-actions"><div class="wizard-actions-copy"><span data-footer-etapa>Etapa 1 de 5</span><small data-footer-hint>Escolha o mundo que será seu ponto de partida.</small></div><div class="wizard-actions-buttons"><button type="button" class="btn wizard-back" data-anterior hidden>← Anterior</button><button type="button" class="btn primario wizard-next" data-proximo>Continuar <span aria-hidden="true">→</span></button><button type="button" class="btn primario wizard-create" data-criar hidden>${criarLabel}</button></div></footer>
      </div>
    </main>`);
  raiz.appendChild(el);
  const extra = h('<button type="button" class="btn" data-sair-criacao>← Sair da criação</button>');
  setBarra({ t1: 'Nova Campanha', t2: 'Forje um mundo e um herói', extra });

  const final = (a) => st.base[a] + (RACAS[st.raca][a] || 0);
  const gasto = () => ATRIBUTOS.reduce((total, a) => total + (CUSTO[st.base[a]] ?? 0), 0);
  const valoresHeroi = () => {
    const classe = CLASSES[st.classe];
    const con = mod(final('constituicao'));
    const magia = Math.max(mod(final('inteligencia')), mod(final('sabedoria')), mod(final('carisma')));
    return { vida: Math.max(6, classe.vida + con * 2), mana: Math.max(0, classe.mana + magia * 2), ouro: classe.ouro };
  };

  function mostrarErro(campo, mensagem = '') {
    const erro = $(`[data-erro="${campo}"]`, el);
    const input = $(`[data-f="${campo}"]`, el);
    if (erro) erro.textContent = mensagem;
    if (input) input.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
  }
  function validarEtapa(indice, focar = true) {
    if (indice === 0) {
      const invalido = st.cenario.n === 'Personalizado' && !st.cenarioCustom.trim();
      mostrarErro('cenarioCustom', invalido ? 'Descreva seu cenário para continuar.' : '');
      if (invalido) { if (focar) $('[data-f="cenarioCustom"]', el).focus(); return false; }
    }
    if (indice === 1) {
      const invalido = !st.nome.trim();
      mostrarErro('nome', invalido ? 'Dê um nome à campanha para continuar.' : '');
      if (invalido) { if (focar) $('[data-f="nome"]', el).focus(); return false; }
    }
    if (indice === 2) {
      const invalido = !st.heroi.trim();
      mostrarErro('heroi', invalido ? 'Dê um nome ao herói para continuar.' : '');
      if (invalido) { if (focar) $('[data-f="heroi"]', el).focus(); return false; }
    }
    return true;
  }

  function atualizarMundo() {
    const c = st.cenario;
    $('[data-preview-art]', el).style.backgroundImage = `url('${arte(c.arte || 'ruinas-antigas')}')`;
    $('[data-preview-local]', el).textContent = c.local || 'Um lugar a descobrir';
    $('[data-preview-mundo]', el).textContent = c.n === 'Personalizado' ? (st.cenarioCustom.trim() || 'Seu mundo ainda está sendo escrito.') : c.d;
  }
  function retratoPadrao() {
    return RETRATO_RACA[st.raca] || (st.classe === 'Mago' && st.raca !== 'Elfo' ? 'mago-anciao' : CLASSES[st.classe].retrato);
  }
  function atualizarRetrato() {
    if (!st.retratoManual) st.retrato = retratoPadrao();
    const url = st.imagem || urlRetrato(st.retrato);
    const retrato = $('[data-img-retrato]', el);
    const previa = $('[data-preview-retrato]', el);
    retrato.src = url || '';
    previa.src = url || '';
    retrato.classList.toggle('oculto', !url);
    previa.classList.toggle('oculto', !url);
  }
  function atualizarVoz() {
    if (!st.vozManual) st.voz = vozDoNpc({ nome: st.heroi || 'Herói', retrato: st.retrato, descricao: `${st.raca} ${st.classe} ${st.aparencia}` });
    $('[data-voz-heroi]', el).innerHTML = opcoesVoz(st.voz);
  }
  function atualizarPrevia() {
    atualizarMundo();
    $('[data-preview-heroi]', el).textContent = st.heroi.trim() || 'Herói sem nome';
    $('[data-preview-classe]', el).textContent = `${st.raca} · ${st.classe}`;
  }
  function renderAtribs() {
    const box = $('[data-atribs]', el);
    box.innerHTML = ATRIBUTOS.map((a) => {
      const bonus = RACAS[st.raca][a] || 0;
      const diminuir = st.base[a] <= 8;
      const aumentar = st.base[a] >= 15 || gasto() - CUSTO[st.base[a]] + CUSTO[st.base[a] + 1] > 27;
      return `<div class="wizard-attribute" data-a="${a}"><span class="wizard-attribute-icon" aria-hidden="true">${iconeKitHtml('attributes', ICONE_ATR[a])}</span><span class="wizard-attribute-name">${NOME_ATR[a]}</span><span class="wizard-attribute-total">${final(a)} <small>${fmtMod(mod(final(a)))}</small></span><span class="wizard-attribute-bonus">${bonus ? `+${bonus} raça` : 'sem bônus'}</span>${st.rolado ? '<span class="wizard-attribute-rolled">rolado</span>' : `<span class="wizard-attribute-controls"><button type="button" data-d="-1" aria-label="Diminuir ${NOME_ATR[a]}" ${diminuir ? 'disabled' : ''}>−</button><span aria-label="Valor base ${st.base[a]}">${st.base[a]}</span><button type="button" data-d="1" aria-label="Aumentar ${NOME_ATR[a]}" ${aumentar ? 'disabled' : ''}>+</button></span>`}</div>`;
    }).join('');
    $('[data-pontos]', el).innerHTML = st.rolado ? `${iconeKitHtml('menu', 'dice')} Atributos rolados com 4d6` : `Pontos restantes <strong>${27 - gasto()} / 27</strong>`;
    const valores = valoresHeroi();
    const classe = CLASSES[st.classe];
    $('[data-resumo]', el).innerHTML = `<div class="wizard-section-label solo">O que você leva para a aventura</div><div class="wizard-starting-stats"><span>${iconeKitHtml('status', 'health')} Vida <b>${valores.vida}</b></span><span>${iconeKitHtml('status', 'mana')} Mana <b>${valores.mana}</b></span><span>${iconeHtml('ouro')} Ouro <b>${valores.ouro}</b></span></div><ul>${classe.itens.map((item) => `<li>${iconeItemHtml(item)} <span>${esc(item.nome)}${item.quantidade > 1 ? ` ×${item.quantidade}` : ''}</span></li>`).join('')}</ul>`;
  }

  function renderRevisao() {
    const valores = valoresHeroi();
    const detalhe = (s) => esc(s || 'Não informado');
    const seletorVoz = $('[data-voz-heroi]', el);
    const nomeVoz = seletorVoz.selectedOptions[0]?.textContent || 'Automática';
    const equipamento = CLASSES[st.classe].itens.map((item) => item.nome).join(', ');
    $('[data-revisao]', el).innerHTML = `
      <article class="wizard-review-card"><div class="wizard-review-head"><div><small>01 · MUNDO</small><h3>${esc(st.cenario.n)}</h3></div><button type="button" class="btn" data-editar="0" aria-label="Editar mundo">Editar</button></div><p>${detalhe(st.cenario.n === 'Personalizado' ? st.cenarioCustom : st.cenario.d)}</p></article>
      <article class="wizard-review-card"><div class="wizard-review-head"><div><small>02 · HISTÓRIA</small><h3>${esc(st.nome.trim())}</h3></div><button type="button" class="btn" data-editar="1" aria-label="Editar história">Editar</button></div><dl><div><dt>Tom</dt><dd>${esc(st.tom)}</dd></div><div><dt>Idioma</dt><dd>${st.idioma === 'pt' ? 'Português' : 'English'}</dd></div></dl>${st.premissa.trim() ? `<p>${esc(st.premissa.trim())}</p>` : ''}</article>
      <article class="wizard-review-card"><div class="wizard-review-head"><div><small>03 · HERÓI</small><h3>${esc(st.heroi.trim())}</h3></div><button type="button" class="btn" data-editar="2" aria-label="Editar herói">Editar</button></div><dl><div><dt>Origem</dt><dd>${esc(st.raca)}</dd></div><div><dt>Classe</dt><dd>${esc(st.classe)}</dd></div></dl></article>
      <article class="wizard-review-card"><div class="wizard-review-head"><div><small>04 · ATRIBUTOS</small><h3>Pronto para a jornada</h3></div><button type="button" class="btn" data-editar="3" aria-label="Editar atributos">Editar</button></div><div class="wizard-review-stats">${ATRIBUTOS.map((a) => `<span title="${NOME_ATR[a]}">${ABREV_ATR[a]} <b>${final(a)}</b></span>`).join('')}</div><dl><div><dt>Vida</dt><dd>${valores.vida}</dd></div><div><dt>Mana</dt><dd>${valores.mana}</dd></div><div><dt>Ouro</dt><dd>${valores.ouro}</dd></div><div><dt>Voz</dt><dd>${esc(nomeVoz)}</dd></div></dl><p><b>Equipamento:</b> ${esc(equipamento)}</p>${st.aparencia.trim() ? `<p><b>Aparência:</b> ${esc(st.aparencia.trim())}</p>` : ''}${st.historia.trim() ? `<p><b>História:</b> ${esc(st.historia.trim())}</p>` : ''}</article>`;
  }

  function mostrarEtapa(indice, focar = true) {
    etapa = indice;
    maiorEtapa = Math.max(maiorEtapa, indice);
    if (indice === 4) { renderRevisao(); editandoRevisao = false; }
    $$('[data-etapa]', el).forEach((painel, i) => { painel.hidden = i !== indice; });
    $$('[data-ir-etapa]', el).forEach((botao, i) => {
      botao.disabled = i > maiorEtapa || enviando;
      botao.classList.toggle('atual', i === indice);
      botao.classList.toggle('concluida', i < maiorEtapa);
      if (i === indice) botao.setAttribute('aria-current', 'step'); else botao.removeAttribute('aria-current');
    });
    $('[data-contador]', el).textContent = `${String(indice + 1).padStart(2, '0')} / 05`;
    $('[data-footer-etapa]', el).textContent = `Etapa ${indice + 1} de 5 · ${etapas[indice].nome}`;
    $('[data-footer-hint]', el).textContent = etapas[indice].descricao;
    $('[data-anterior]', el).hidden = indice === 0;
    $('[data-proximo]', el).hidden = indice === 4;
    $('[data-proximo]', el).innerHTML = editandoRevisao ? 'Voltar à revisão <span aria-hidden="true">→</span>' : 'Continuar <span aria-hidden="true">→</span>';
    $('[data-criar]', el).hidden = indice !== 4;
    el.scrollTop = 0;
    if (focar) $(`#wizard-titulo-${indice}`, el).focus({ preventScroll: true });
  }

  $$('[data-f]', el).forEach((input) => input.addEventListener('input', () => {
    st[input.dataset.f] = input.value;
    alterado = true;
    mostrarErro(input.dataset.f);
    if (input.dataset.f === 'raca') { renderAtribs(); atualizarRetrato(); atualizarVoz(); }
    if (input.dataset.f === 'heroi' || input.dataset.f === 'aparencia') atualizarVoz();
    atualizarPrevia();
  }));
  $$('[data-i]', el).forEach((botao) => botao.addEventListener('click', () => {
    const cenario = CENARIOS[Number(botao.dataset.i)];
    const mudou = st.cenario !== cenario;
    st.cenario = cenario;
    $$('[data-i]', el).forEach((item) => { const selecionado = item === botao; item.classList.toggle('sel', selecionado); item.setAttribute('aria-pressed', String(selecionado)); });
    $('[data-custom]', el).hidden = st.cenario.n !== 'Personalizado';
    mostrarErro('cenarioCustom');
    if (mudou) alterado = true;
    audio.clique();
    setTema(st.cenario.tema);
    setCena(arte(st.cenario.arte || 'ruinas-antigas'));
    atualizarPrevia();
  }));
  $$('[data-idioma]', el).forEach((botao) => botao.addEventListener('click', () => {
    const mudou = st.idioma !== botao.dataset.idioma;
    st.idioma = botao.dataset.idioma;
    $$('[data-idioma]', el).forEach((item) => { const selecionado = item === botao; item.classList.toggle('sel', selecionado); item.setAttribute('aria-pressed', String(selecionado)); });
    if (mudou) alterado = true;
    audio.clique();
  }));
  $$('[data-c]', el).forEach((botao) => botao.addEventListener('click', () => {
    const mudou = st.classe !== botao.dataset.c;
    st.classe = botao.dataset.c;
    $$('[data-c]', el).forEach((item) => { const selecionado = item === botao; item.classList.toggle('sel', selecionado); item.setAttribute('aria-pressed', String(selecionado)); });
    if (mudou && !st.rolado) st.base = { ...CLASSES[st.classe].base };
    st.icone = CLASSES[st.classe].ic;
    if (mudou) alterado = true;
    audio.clique();
    renderAtribs();
    atualizarRetrato();
    atualizarVoz();
    atualizarPrevia();
  }));
  $('[data-atribs]', el).addEventListener('click', (event) => {
    const botao = event.target.closest('[data-d]');
    if (!botao || botao.disabled) return;
    const atributo = botao.closest('[data-a]').dataset.a;
    const direcao = botao.dataset.d;
    const anterior = st.base[atributo];
    st.base[atributo] += Number(direcao);
    if (st.base[atributo] < 8 || st.base[atributo] > 15 || gasto() > 27) { st.base[atributo] = anterior; return; }
    alterado = true;
    audio.clique();
    renderAtribs();
    const proximoFoco = $(`[data-a="${atributo}"] [data-d="${direcao}"]`, el);
    if (proximoFoco?.disabled) $(`[data-a="${atributo}"] [data-d="${direcao === '1' ? '-1' : '1'}"]`, el)?.focus();
    else proximoFoco?.focus();
  });
  $('[data-padrao]', el).addEventListener('click', () => {
    const padrao = CLASSES[st.classe].base;
    if (st.rolado || ATRIBUTOS.some((atributo) => st.base[atributo] !== padrao[atributo])) alterado = true;
    st.rolado = false;
    st.base = { ...padrao };
    renderAtribs();
  });
  $('[data-rolar]', el).addEventListener('click', () => {
    st.rolado = true;
    for (const atributo of ATRIBUTOS) { const dados = rolar(6, 4).sort((a, b) => b - a); st.base[atributo] = dados[0] + dados[1] + dados[2]; }
    alterado = true;
    audio.dado();
    renderAtribs();
  });
  $('[data-trocar-retrato]', el).addEventListener('click', async () => {
    const escolha = await escolherRetrato(st.retrato, { atualUrl: st.imagem });
    if (!escolha || !vivo) return;
    if (escolha.imagem) st.imagem = escolha.imagem;
    else { st.retrato = escolha.retrato; st.imagem = null; }
    st.retratoManual = true;
    alterado = true;
    atualizarRetrato();
    atualizarVoz();
  });
  $('[data-voz-heroi]', el).addEventListener('change', (event) => { st.voz = event.target.value; st.vozManual = true; alterado = true; });
  $('[data-ouvir-voz]', el).addEventListener('click', () => ouvirVoz(st.voz, { nome: st.heroi.trim(), idioma: st.idioma, cfg: S.cfg }));
  $('[data-proximo]', el).addEventListener('click', () => {
    if (enviando) return;
    if (!validarEtapa(etapa)) return;
    mostrarEtapa(editandoRevisao ? 4 : Math.min(4, etapa + 1));
    audio.clique();
  });
  $('[data-anterior]', el).addEventListener('click', () => { if (enviando) return; mostrarEtapa(Math.max(0, etapa - 1)); audio.clique(); });
  $$('[data-ir-etapa]', el).forEach((botao) => botao.addEventListener('click', () => { if (!enviando && !botao.disabled) mostrarEtapa(Number(botao.dataset.irEtapa)); }));
  $('[data-revisao]', el).addEventListener('click', (event) => {
    const botao = event.target.closest('[data-editar]');
    if (!botao || enviando) return;
    editandoRevisao = true;
    mostrarEtapa(Number(botao.dataset.editar));
  });
  // Enter num campo de uma linha = Continuar (o formulário tem vários campos e nenhum botão submit, então o navegador não envia sozinho)
  $('.wizard-form', el).addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.target.tagName !== 'INPUT') return;
    event.preventDefault();
    if (etapa === 4) criar(); else $('[data-proximo]', el).click();
  });
  $('.wizard-form', el).addEventListener('submit', (event) => { event.preventDefault(); if (etapa === 4) criar(); else $('[data-proximo]', el).click(); });
  extra.addEventListener('click', async () => {
    if (enviando) return;
    if (alterado && !await confirmar('Sair da criação?', 'Suas escolhas nesta campanha ainda não foram salvas.', { ok: 'Sair sem salvar', perigo: true })) return;
    if (vivo) irPara('inicio');
  });
  $('[data-criar]', el).addEventListener('click', criar);
  $('[data-coop-convidar]', el).addEventListener('change', (ev) => {
    const nomeCampo = $('[data-coop-nome]', el);
    nomeCampo.hidden = !ev.currentTarget.checked;
    if (!nomeCampo.hidden) { nomeCampo.value ||= lsGet('cronicas:coop-nome', ''); nomeCampo.focus(); }
  });

  async function criar() {
    if (enviando) return;
    for (let indice = 0; indice < 4; indice++) {
      if (!validarEtapa(indice, false)) {
        mostrarEtapa(indice, false);
        const campo = indice === 0 ? 'cenarioCustom' : indice === 1 ? 'nome' : 'heroi';
        $(`[data-f="${campo}"]`, el).focus();
        return;
      }
    }
    const classe = CLASSES[st.classe];
    const atributos = {};
    for (const atributo of ATRIBUTOS) atributos[atributo] = final(atributo);
    const botao = $('[data-criar]', el);
    enviando = true;
    botao.disabled = true;
    botao.textContent = 'Forjando o mundo…';
    $$('[data-ir-etapa], [data-anterior], [data-proximo]', el).forEach((item) => { item.disabled = true; });
    extra.disabled = true;
    $('[data-erro-envio]', el).textContent = '';
    try {
      const slug = await api.campanhas.criar({
        nome: st.nome.trim(),
        cenario: st.cenario.n === 'Personalizado' ? st.cenarioCustom.trim() : `${st.cenario.n} — ${st.cenario.d}`,
        tom: st.tom,
        idioma: st.idioma,
        premissa: st.premissa.trim(),
        temaInicial: st.cenario.tema,
        localInicial: st.cenario.local,
        personagem: {
          nome: st.heroi.trim(), raca: st.raca, classe: st.classe, icone: st.icone, retrato: st.retrato, historia: st.historia.trim(),
          imagem: st.imagem || undefined, aparencia: st.aparencia.trim(), voz: st.voz,
          atributos, vidaBase: classe.vida, manaBase: classe.mana, ouro: classe.ouro,
        },
        itensIniciais: classe.itens,
      });
      let convidar = false;
      if ($('[data-coop-convidar]', el).checked) {
        const nomeHost = $('[data-coop-nome]', el).value.trim() || 'Host';
        lsSet('cronicas:coop-nome', nomeHost);
        try {
          await api.coop.hospedar(slug, nomeHost);
          convidar = true;
        } catch (erroSala) {
          toast(`Campanha criada, mas a sala co-op não abriu: ${erroSala.message}. Abra depois no 🤝.`, 'erro');
        }
      }
      if (vivo) irPara('jogo', { slug, novo: true, ...(convidar ? { papel: 'host', convidar: true } : {}) });
    } catch (error) {
      const mensagem = error?.message || 'Não foi possível criar a aventura. Tente novamente.';
      $('[data-erro-envio]', el).textContent = mensagem;
      toast(mensagem, 'erro');
      botao.focus();
    } finally {
      enviando = false;
      if (vivo) {
        botao.disabled = false;
        botao.innerHTML = criarLabel;
        $('[data-anterior]', el).disabled = false;
        $('[data-proximo]', el).disabled = false;
        extra.disabled = false;
        mostrarEtapa(etapa, false);
      }
    }
  }

  renderAtribs();
  atualizarRetrato();
  atualizarVoz();
  atualizarPrevia();
  setTema(st.cenario.tema);
  setCena(arte(st.cenario.arte || 'ruinas-antigas'));
  mostrarEtapa(0, false);
  const focoInicial = setTimeout(() => { if (vivo) $('#wizard-titulo-0', el).focus({ preventScroll: true }); }, 60);
  return () => { vivo = false; clearTimeout(focoInicial); };
}
