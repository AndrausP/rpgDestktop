import { $, $$, esc, h, modal, toast, ATRIBUTOS, ABREV_ATR, NOME_ATR, mod, fmtMod, rolar, FLAMULA } from '../ui.js';
import { api, irPara, S } from '../app.js';
import { setTema, setCena, audio } from '../cenario.js';
import { setBarra } from '../barra.js';
import { urlCena, urlRetrato, iconeItemHtml } from '../arte.js';
import { escolherRetrato, opcoesVoz, ouvirVoz } from '../heroi.js';
import { gravarVoz } from '../gravador.js';
import { vozDoNpc } from '../vozes.js';

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
const RACAS = {
  Humano: { forca: 1, destreza: 1, constituicao: 1, inteligencia: 1, sabedoria: 1, carisma: 1 },
  Elfo: { destreza: 2, inteligencia: 1 },
  Anão: { constituicao: 2, forca: 1 },
  Halfling: { destreza: 2, carisma: 1 },
  'Meio-orc': { forca: 2, constituicao: 1 },
  Tiefling: { carisma: 2, inteligencia: 1 },
  Draconato: { forca: 2, carisma: 1 },
};
const CLASSES = {
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

const ICONE_ATR = { forca: '💪', destreza: '🪶', constituicao: '❤️', inteligencia: '📖', sabedoria: '👁️', carisma: '✨' };
const RETRATO_RACA = { Anão: 'ferreiro-anao', 'Meio-orc': 'orc' };

/** Tela cheia de criação: O Mundo (esquerda) e O Herói (direita). */
export function telaCriacao(raiz) {
  const st = {
    nome: '', cenario: CENARIOS[0], cenarioCustom: '', tom: TONS[0], premissa: '',
    heroi: '', raca: 'Humano', classe: 'Guerreiro', icone: '⚔️', historia: '',
    retrato: 'guerreiro', retratoManual: false, imagem: null, aparencia: '', voz: '', vozManual: false, vozGravada: null, idioma: 'pt',
    base: { ...CLASSES.Guerreiro.base }, rolado: false,
  };
  const arte = (id) => urlCena(id) || '';

  const el = h(`
    <div class="criacao-tela">
      <section class="moldura painel-criacao">
        ${FLAMULA}
        <header class="cab-arte" data-cab-mundo>
          <span class="ic-grande">🌍</span>
          <div><h1>O Mundo</h1><div class="sub">Crie o cenário da sua aventura</div></div>
        </header>
        <div class="corpo-painel">
          <div class="rotulo">Nome da campanha</div>
          <div class="com-ic"><span class="ic">🪶</span><input class="campo" data-f="nome" placeholder="Ex.: A Queda de Vel'Darim" maxlength="60"></div>

          <div class="rotulo"><span class="ic">🧭</span>Cenário <span class="dica">Escolha o tipo de mundo e o clima da sua história.</span></div>
          <div class="cenarios">
            ${CENARIOS.map((c, i) => `
              <button class="cenario-card ${i === 0 ? 'sel' : ''}" data-i="${i}" style="${c.arte ? `background-image:url('${arte(c.arte)}')` : ''}">
                ${c.arte ? '' : '<span class="ic-roda">☸️</span>'}<span>${esc(c.n)}</span>
              </button>`).join('')}
          </div>
          <div class="desc-cenario" data-cen-desc>${esc(CENARIOS[0].d)}</div>
          <textarea class="campo oculto" data-f="cenarioCustom" placeholder="Descreva seu cenário: época, tecnologia, magia, clima..." style="margin-top:10px"></textarea>

          <div class="divisor"></div>
          <div class="rotulo" style="margin-top:0"><span class="ic">🗣️</span>Idioma da história <span class="dica">narração, falas e vozes</span></div>
          <div class="idiomas">
            <button class="idioma sel" data-idioma="pt"><span class="band">🇧🇷</span><span><b>Português</b><small>Chatterbox multilíngue</small></span></button>
            <button class="idioma" data-idioma="en"><span class="band">🇺🇸</span><span><b>English</b><small>Chatterbox Turbo · risos e suspiros</small></span></button>
          </div>
          <div class="linha-campos">
            <div class="rotulo" style="margin-top:0"><span class="ic">🎭</span>Tom</div>
            <select class="campo" data-f="tom">${TONS.map((t) => `<option>${t}</option>`).join('')}</select>
            <div class="rotulo"><span class="ic">📜</span>Premissa / gancho <span class="dica">(opcional)</span></div>
            <textarea class="campo" data-f="premissa" placeholder="Ex.: Você acorda num navio sem memória, com uma marca brilhando no pulso..."></textarea>
            <div class="ajuda">Depois você pode colocar arquivos .md na pasta <b>lore/</b> da campanha — o mestre usa como canon.</div>
          </div>
        </div>
      </section>

      <section class="moldura painel-criacao">
        <header class="cab-arte heroi" data-cab-heroi style="background-image:url('${arte('ruinas-antigas')}')">
          <span class="ic-grande">🛡️</span>
          <div><h1>O Herói</h1><div class="sub">Crie seu personagem</div></div>
          <button class="retrato-cab" data-trocar-retrato title="Trocar retrato ou enviar sua imagem"><img data-img-retrato alt=""><span>📤 Sua imagem / 🖼️ galeria</span></button>
        </header>
        <div class="corpo-painel">
          <div class="duas-col">
            <div><div class="rotulo" style="margin-top:4px"><span class="ic">👤</span>Nome</div>
              <div class="com-ic"><span class="ic">🧝</span><input class="campo" data-f="heroi" placeholder="Ex.: Kael Ventoferro" maxlength="40"></div></div>
            <div><div class="rotulo" style="margin-top:4px"><span class="ic">👥</span>Raça</div>
              <div class="com-ic"><span class="ic">🧬</span><select class="campo" data-f="raca">${Object.keys(RACAS).map((r) => `<option>${r}</option>`).join('')}</select></div></div>
          </div>

          <div class="rotulo"><span class="ic">🛡️</span>Classe <span class="dica">Escolha o caminho que define seu estilo de jogo.</span></div>
          <div class="classes">
            ${Object.entries(CLASSES).map(([n, c]) => `
              <button class="classe ${n === 'Guerreiro' ? 'sel' : ''}" data-c="${n}" style="--cor:${c.cor}; background-image: linear-gradient(180deg, color-mix(in srgb, ${c.cor} 62%, transparent), rgba(10,7,5,.94) 92%), url('${arte('fortaleza-sombria')}')">
                <span class="check">✓</span>
                <span class="ic">${c.ic}</span><span class="n">${n}</span><span class="d">${c.d}</span>
              </button>`).join('')}
          </div>

          <div class="pontos-info">
            <span data-pontos></span>
            <span class="linha-flex"><button class="btn" data-padrao>↻ Padrão</button><button class="btn" data-rolar>🎲 Rolar 4d6</button></span>
          </div>
          <div class="atrib-grade" data-atribs></div>

          <div class="rotulo"><span class="ic">🪞</span>Aparência <span class="dica">o mestre descreve você assim</span></div>
          <textarea class="campo" data-f="aparencia" maxlength="1500" placeholder="Ex.: alta, cabelo ruivo trançado, cicatriz no queixo, olhos verdes, capa de lã gasta e botas de viagem..." style="min-height:60px"></textarea>

          <div class="rotulo"><span class="ic">🗣️</span>Voz do herói <span class="dica">lê as suas falas (opcional, em Configurações)</span></div>
          <div class="linha-flex voz-heroi">
            <select class="campo" data-voz-heroi></select>
            <button class="btn" data-ouvir-voz title="Ouvir">▶</button>
            <button class="btn" data-gravar-voz title="Gravar a sua própria voz para o herói">🎙️ Gravar</button>
          </div>

          <div class="rotulo"><span class="ic">📖</span>História do personagem <span class="dica">(opcional)</span></div>
          <textarea class="campo" data-f="historia" placeholder="De onde veio? O que busca? O que teme?" style="min-height:60px"></textarea>

          <div class="resumo-heroi moldura leve" data-resumo></div>
        </div>
      </section>
    </div>`);
  raiz.appendChild(el);

  // barra: onde começa + ações
  const extra = h(`<div class="linha-flex" style="gap:10px">
    <div class="info-barra"><span class="sol">☀️</span><div><div class="l1">A campanha começa em</div><div class="l2" data-inicio-local></div></div></div>
    <button class="btn" data-voltar>← Voltar</button>
    <button class="btn primario grande" data-criar>⚔️ Começar a aventura</button>
  </div>`);
  setBarra({ t1: 'Nova Campanha', t2: 'Forje um mundo e um herói', extra });

  const final = (a) => st.base[a] + (RACAS[st.raca][a] || 0);
  const gasto = () => ATRIBUTOS.reduce((s, a) => s + (CUSTO[st.base[a]] ?? 0), 0);

  function atualizarMundo() {
    const c = st.cenario;
    $('[data-cab-mundo]', el).style.backgroundImage = c.arte ? `url('${arte(c.arte)}')` : `url('${arte('ruinas-antigas')}')`;
    $('[data-inicio-local]', extra).textContent = c.local || 'um lugar a descobrir';
    setTema(c.tema);
    setCena(arte(c.arte || 'ruinas-antigas'));
  }

  function retratoPadrao() {
    return RETRATO_RACA[st.raca] || (st.classe === 'Mago' && st.raca !== 'Elfo' ? 'mago-anciao' : CLASSES[st.classe].retrato);
  }
  function atualizarRetrato() {
    if (!st.retratoManual) st.retrato = retratoPadrao();
    const url = st.imagem || urlRetrato(st.retrato);
    const img = $('[data-img-retrato]', el);
    img.src = url || '';
    img.classList.toggle('oculto', !url);
  }

  function renderAtribs() {
    const box = $('[data-atribs]', el);
    box.innerHTML = ATRIBUTOS.map((a) => {
      const b = RACAS[st.raca][a] || 0;
      return `<div class="atrib-edit" data-a="${a}">
        <div class="ab" title="${NOME_ATR[a]}">${ABREV_ATR[a]}</div>
        <div class="ic">${ICONE_ATR[a]}</div>
        <div class="v">${final(a)}</div>
        <div class="m">${fmtMod(mod(final(a)))}</div>
        <div class="bonus">${b ? `+${b} raça` : '&nbsp;'}</div>
        ${st.rolado ? '' : `<div class="ctl"><button data-d="-1">−</button><button data-d="1">+</button></div>`}
      </div>`;
    }).join('');
    $('[data-pontos]', el).innerHTML = st.rolado ? '🎲 Atributos <b>rolados</b>' : `🏺 Pontos restantes: <b>${27 - gasto()} / 27</b>`;
    $$('[data-d]', box).forEach((btn) => btn.addEventListener('click', () => {
      const a = btn.closest('[data-a]').dataset.a;
      const nv = st.base[a] + parseInt(btn.dataset.d, 10);
      if (nv < 8 || nv > 15) return;
      const antes = st.base[a];
      st.base[a] = nv;
      if (gasto() > 27) st.base[a] = antes;
      audio.clique();
      renderAtribs();
    }));
    const c = CLASSES[st.classe];
    const con = mod(final('constituicao'));
    const magia = Math.max(mod(final('inteligencia')), mod(final('sabedoria')), mod(final('carisma')));
    $('[data-resumo]', el).innerHTML = `
      <div class="stats-resumo">
        <span>❤️ Vida <b>${Math.max(6, c.vida + con * 2)}</b></span>
        <span>💧 Mana <b>${Math.max(0, c.mana + magia * 2)}</b></span>
        <span>🪙 <b>${c.ouro}</b> ouro</span>
      </div>
      <div class="equip-resumo"><div class="t">Equipamento inicial</div>
        <ul>${c.itens.map((i) => `<li>${iconeItemHtml(i)} ${esc(i.nome)}${i.quantidade > 1 ? ` x${i.quantidade}` : ''} <span class="suave">→ ${i.pasta}/</span></li>`).join('')}</ul>
      </div>`;
  }

  $$('[data-f]', el).forEach((i) => i.addEventListener('input', () => {
    st[i.dataset.f] = i.value;
    if (i.dataset.f === 'raca') { renderAtribs(); atualizarRetrato(); atualizarVoz(); }
  }));
  function atualizarVoz() {
    if (!st.vozManual) st.voz = vozDoNpc({ nome: st.heroi || 'Herói', retrato: st.retrato, descricao: `${st.raca} ${st.classe} ${st.aparencia}` });
    $('[data-voz-heroi]', el).innerHTML = opcoesVoz(st.voz);
  }
  $('[data-voz-heroi]', el).addEventListener('change', (e) => { st.voz = e.target.value; st.vozManual = true; });
  $('[data-ouvir-voz]', el).addEventListener('click', () => {
    if (st.vozGravada) return audio.tocarVoz(st.vozGravada.slice().buffer);
    ouvirVoz(st.voz, { nome: st.heroi.trim(), idioma: st.idioma, cfg: S.cfg });
  });
  $('[data-gravar-voz]', el).addEventListener('click', async () => {
    const wav = await gravarVoz({ titulo: `Voz de ${st.heroi.trim() || 'seu herói'}`, idioma: st.idioma });
    if (!wav) return;
    st.vozGravada = wav;
    $('[data-gravar-voz]', el).textContent = '🎙️ Gravada ✓';
  });
  $$('.idioma', el).forEach((b) => b.addEventListener('click', () => {
    st.idioma = b.dataset.idioma;
    $$('.idioma', el).forEach((x) => x.classList.toggle('sel', x === b));
    audio.clique();
  }));
  $$('.cenario-card', el).forEach((o) => o.addEventListener('click', () => {
    st.cenario = CENARIOS[+o.dataset.i];
    $$('.cenario-card', el).forEach((x) => x.classList.toggle('sel', x === o));
    $('[data-cen-desc]', el).textContent = st.cenario.d;
    $('[data-f="cenarioCustom"]', el).classList.toggle('oculto', st.cenario.n !== 'Personalizado');
    audio.clique();
    atualizarMundo();
  }));
  $$('.classe', el).forEach((o) => o.addEventListener('click', () => {
    st.classe = o.dataset.c;
    $$('.classe', el).forEach((x) => x.classList.toggle('sel', x === o));
    if (!st.rolado) st.base = { ...CLASSES[st.classe].base };
    st.icone = CLASSES[st.classe].ic;
    audio.clique();
    renderAtribs();
    atualizarRetrato();
    atualizarVoz();
  }));
  $('[data-rolar]', el).addEventListener('click', () => {
    st.rolado = true;
    for (const a of ATRIBUTOS) {
      const d = rolar(6, 4).sort((x, y) => y - x);
      st.base[a] = d[0] + d[1] + d[2];
    }
    audio.dado();
    renderAtribs();
  });
  $('[data-padrao]', el).addEventListener('click', () => {
    st.rolado = false;
    st.base = { ...CLASSES[st.classe].base };
    renderAtribs();
  });
  $('[data-trocar-retrato]', el).addEventListener('click', async () => {
    const r = await escolherRetrato(st.retrato, { atualUrl: st.imagem });
    if (!r) return;
    if (r.imagem) st.imagem = r.imagem;
    else { st.retrato = r.retrato; st.imagem = null; }
    st.retratoManual = true;
    atualizarRetrato();
    atualizarVoz();
  });
  $('[data-voltar]', extra).addEventListener('click', () => irPara('inicio'));
  $('[data-criar]', extra).addEventListener('click', criar);

  async function criar() {
    if (!st.nome.trim()) return toast('Dê um nome à campanha', 'erro'), $('[data-f="nome"]', el).focus();
    if (!st.heroi.trim()) return toast('Dê um nome ao herói', 'erro'), $('[data-f="heroi"]', el).focus();
    if (st.cenario.n === 'Personalizado' && !st.cenarioCustom.trim()) return toast('Descreva seu cenário', 'erro');
    const c = CLASSES[st.classe];
    const atributos = {};
    for (const a of ATRIBUTOS) atributos[a] = final(a);
    const btn = $('[data-criar]', extra);
    btn.disabled = true;
    btn.textContent = 'Forjando o mundo...';
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
          atributos, vidaBase: c.vida, manaBase: c.mana, ouro: c.ouro,
        },
        itensIniciais: c.itens,
      });
      if (st.vozGravada) await api.voz.salvarRef('heroi', st.vozGravada, slug).catch((e) => toast(`Voz do herói: ${e.message}`, 'erro'));
      irPara('jogo', { slug, novo: true });
    } catch (e) {
      toast(e.message, 'erro');
      btn.disabled = false;
      btn.textContent = '⚔️ Começar a aventura';
    }
  }

  renderAtribs();
  atualizarMundo();
  atualizarRetrato();
  atualizarVoz();
  setTimeout(() => $('[data-f="nome"]', el).focus(), 60);
  return () => {};
}
