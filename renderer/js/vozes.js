// ═══════════════════════════════════════════════════════════════════════
//  Vozes: o Mestre narra e cada personagem fala com a própria voz (KokoroSharp).
//  - O mestre manda um ROTEIRO: [{quem: 'narrador' | NPC | 'heroi', texto, emocao}]
//    (turnos antigos sem roteiro são quebrados por roteiro(), pelo travessão do diálogo)
//  - vozDoNpc(): escolhe uma voz estável para cada NPC (pelo retrato, gênero e nome)
//  - Narrador.falar(): sintetiza trecho a trecho e toca em sequência, adiantando o próximo
//  Motores: 'kokoro' (KokoroSharp, serviço C#) ou 'sistema' (voz do Windows/navegador, sem instalar nada).
// ═══════════════════════════════════════════════════════════════════════
import { audio } from './cenario.js';

/** Vozes prontas (o timbre de cada uma é um clipe de referência — veja src/main/voz-presets.js). */
export const PRESETS_VOZ = {
  'narrador-grave': { nome: 'Narrador grave', genero: 'm', vel: 0.96, tom: 0.85 },
  'narrador-classico': { nome: 'Narrador clássico', genero: 'm', vel: 1, tom: 1 },
  narradora: { nome: 'Narradora', genero: 'f', vel: 0.98, tom: 1 },
  'homem-jovem': { nome: 'Homem jovem', genero: 'm', vel: 1.03, tom: 1.05 },
  'homem-maduro': { nome: 'Homem maduro', genero: 'm', vel: 0.98, tom: 0.92 },
  'velho-sabio': { nome: 'Velho sábio', genero: 'm', vel: 0.92, tom: 0.8 },
  brutamontes: { nome: 'Brutamontes', genero: 'm', vel: 0.95, tom: 0.7 },
  malandro: { nome: 'Malandro', genero: 'm', vel: 1.06, tom: 1.1 },
  nobre: { nome: 'Nobre', genero: 'm', vel: 0.96, tom: 0.95 },
  sombrio: { nome: 'Sombrio', genero: 'm', vel: 0.92, tom: 0.75 },
  'mulher-jovem': { nome: 'Mulher jovem', genero: 'f', vel: 1.03, tom: 1.15 },
  'mulher-madura': { nome: 'Mulher madura', genero: 'f', vel: 0.98, tom: 0.95 },
  sussurrante: { nome: 'Sussurrante', genero: 'f', vel: 0.94, tom: 1 },
  rainha: { nome: 'Rainha', genero: 'f', vel: 0.95, tom: 1 },
  criatura: { nome: 'Criatura', genero: 'm', vel: 0.88, tom: 0.55 },
  goblin: { nome: 'Goblin', genero: 'm', vel: 1.1, tom: 1.5 },
};

/** Emoções que o mestre pode marcar em cada fala (mudam a intensidade e o ritmo da voz). */
export const EMOCOES = {
  neutro: { nome: 'neutro', icone: '' },
  calmo: { nome: 'calmo', icone: '😌' },
  alegre: { nome: 'alegre', icone: '😄' },
  raiva: { nome: 'raiva', icone: '😠' },
  medo: { nome: 'medo', icone: '😨' },
  triste: { nome: 'triste', icone: '😢' },
  sussurro: { nome: 'sussurro', icone: '🤫' },
  grito: { nome: 'grito', icone: '📢' },
  sarcastico: { nome: 'sarcástico', icone: '😏' },
  misterioso: { nome: 'misterioso', icone: '🔮' },
};

const VOZ_POR_RETRATO = {
  taverneiro: 'homem-maduro', rei: 'nobre', rainha: 'rainha', 'ferreiro-anao': 'brutamontes', bandido: 'malandro',
  cultista: 'sombrio', demonio: 'criatura', anjo: 'mulher-jovem', orc: 'brutamontes', 'goblin-mercador': 'goblin',
  vampiro: 'sombrio', necromante: 'sombrio', 'mago-anciao': 'velho-sabio', 'maga-elfa': 'mulher-jovem', barbaro: 'brutamontes',
  paladina: 'mulher-madura', arqueira: 'mulher-jovem', mercenaria: 'mulher-madura', guerreiro: 'homem-jovem', 'ladino-encapuzado': 'malandro',
  // elenco de NPCs nomeados
  'alaric-dorne': 'homem-jovem',
  'aldren-valcor': 'homem-maduro',
  'alistair-vane': 'nobre',
  'barnabas': 'homem-maduro',
  'borin-martelo-negro': 'brutamontes',
  'bromir': 'malandro',
  'celestine': 'mulher-jovem',
  'draven': 'homem-maduro',
  'edric-iv': 'nobre',
  'elayne': 'mulher-jovem',
  'eryndor': 'nobre',
  'eveline-ravencroft': 'rainha',
  'fenrik': 'homem-maduro',
  'garrick-barrilvelho': 'homem-maduro',
  'grum': 'brutamontes',
  'helena-voss': 'mulher-madura',
  'homem-sem-nome': 'sombrio',
  'kaara-sangue-frio': 'mulher-madura',
  'kharza': 'criatura',
  'lucius-morn': 'sombrio',
  'malrec': 'sombrio',
  'mara-flint': 'mulher-jovem',
  'mathias': 'velho-sabio',
  'mira-vell': 'mulher-madura',
  'miriel-folha-serena': 'mulher-madura',
  'morwenna': 'sussurrante',
  'nessa-lua-clara': 'sussurrante',
  'nymera': 'sussurrante',
  'orren': 'velho-sabio',
  'orwyn': 'velho-sabio',
  'pipik-moeda-rapida': 'goblin',
  'rikkit': 'goblin',
  'severin': 'brutamontes',
  'silas-corvo': 'malandro',
  'thrag-pedranegra': 'brutamontes',
  'tomas-rato': 'malandro',
  'varek-mao-cinza': 'homem-maduro',
  'velkan-morten': 'sombrio',
  'vellin': 'velho-sabio',
  'ysara-veu-negro': 'mulher-madura',
};
const MASCULINAS = ['homem-jovem', 'homem-maduro', 'velho-sabio', 'nobre', 'malandro', 'brutamontes'];
const FEMININAS = ['mulher-jovem', 'mulher-madura', 'sussurrante', 'rainha'];

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Voz estável para um NPC: escolhida por você → pelo retrato → criatura → gênero + nome. */
export function vozDoNpc(npc) {
  if (!npc) return 'homem-maduro';
  if (npc.voz && PRESETS_VOZ[npc.voz]) return npc.voz;
  if (npc.retrato && VOZ_POR_RETRATO[npc.retrato]) return VOZ_POR_RETRATO[npc.retrato];
  const txt = norm(`${npc.nome} ${npc.descricao || ''}`);
  if (/lobo|drag|demon|besta|monstro|criatura|golem|troll|ogro|esquelet|zumbi|espectro/.test(txt)) return 'criatura';
  if (/goblin|kobold|diabrete/.test(txt)) return 'goblin';
  if (/\brei\b|lorde|duque|conde|nobre/.test(txt)) return 'nobre';
  if (/rainha|princesa|duquesa|condessa|dama/.test(txt)) return 'rainha';
  if (/velh|anci|sabio|eremita|arquimago/.test(txt)) return 'velho-sabio';
  const primeiro = norm(npc.nome).split(/\s+/)[0];
  const feminino = /\b(ela|mulher|moca|garota|senhora|irma|madre|capita|sacerdotisa|feiticeira|bruxa|rainha|taverneira|guerreira)\b/.test(txt)
    || (/a$/.test(primeiro) && !/^(capitao|joao|lucca|nicola)$/.test(primeiro));
  const lista = feminino ? FEMININAS : MASCULINAS;
  return lista[hash(npc.nome) % lista.length];
}

/** Limpa o texto para falar: tira markdown, emojis e símbolos que atrapalham a pronúncia. */
export function limparParaFala(t) {
  return String(t || '')
    .replace(/\*\*|__|\*|_/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\[(.*?)\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const ORDINAIS = { 1: ['primeiro', 'primeira'], 2: ['segundo', 'segunda'], 3: ['terceiro', 'terceira'], 4: ['quarto', 'quarta'], 5: ['quinto', 'quinta'], 6: ['sexto', 'sexta'], 7: ['sétimo', 'sétima'], 8: ['oitavo', 'oitava'], 9: ['nono', 'nona'], 10: ['décimo', 'décima'] };
/**
 * Texto em português como deve ser FALADO: o Kokoro lê "Sr." como "ésse érre", "10h" como "dez agá"
 * e "3ª" como "tercêira" mal acentuado (conferido no fonemizador). Só para a voz — a tela mostra o original.
 */
export function textoParaFalaPt(t) {
  return String(t || '')
    .replace(/\bSr\.(?=\s)/g, 'senhor').replace(/\bSra\.(?=\s)/g, 'senhora').replace(/\bSrta\.(?=\s)/g, 'senhorita')
    .replace(/\bDr\.(?=\s)/g, 'doutor').replace(/\bDra\.(?=\s)/g, 'doutora').replace(/\bSto\.(?=\s)/g, 'santo').replace(/\bSta\.(?=\s)/g, 'santa')
    .replace(/\b(\d{1,2})h(\d{2})\b/g, (_, h, m) => `${h} horas e ${+m}`)
    .replace(/\b(\d{1,2})h\b/g, (_, h) => `${h} ${+h === 1 ? 'hora' : 'horas'}`)
    .replace(/\b(\d{1,2})([ºª])/g, (m, n, g) => ORDINAIS[n]?.[g === 'ª' ? 1 : 0] || m)
    .replace(/\bCD\s?(\d+)/g, 'dificuldade $1').replace(/\bCA\s?(\d+)/g, 'armadura $1')
    .replace(/(\d+)\s?PV\b/g, '$1 pontos de vida').replace(/\bPV\b/g, 'pontos de vida')
    .replace(/(\d+)\s?XP\b/g, '$1 de experiência').replace(/\bXP\b/g, 'experiência')
    .replace(/(\d+)\s?PO\b/g, '$1 moedas de ouro')
    .replace(/\s*[—–]\s*/g, ', ') // travessão vira pausa (no meio da frase o Kokoro às vezes ignora)
    .replace(/^,\s*/, '').replace(/,\s*([.!?…])/g, '$1').replace(/,\s*,/g, ',');
}

/**
 * Divide uma fala longa em frases (até ~200 caracteres por pedaço) para a voz começar logo:
 * o 1º pedaço é só a 1ª frase, que o Kokoro sintetiza em ~1 s; o resto é sintetizado enquanto ela toca.
 */
export function dividirFala(texto, primeiro = false) {
  const frases = String(texto).match(/[^.!?…]+(?:[.!?…]+["”»]?|$)\s*/g)?.map((f) => f.trim()).filter(Boolean) || [texto];
  const out = [];
  let atual = '';
  for (const f of frases) {
    const limite = primeiro && !out.length ? 0 : 200;
    if (atual && (atual.length + f.length > limite)) { out.push(atual); atual = f; } else atual = atual ? `${atual} ${f}` : f;
  }
  if (atual) out.push(atual);
  // pedaços muito curtos ("Não." ) colam no anterior, para não picotar
  return out.reduce((acc, p) => (acc.length && p.length < 25 ? (acc[acc.length - 1] += ` ${p}`, acc) : (acc.push(p), acc)), []);
}

/** Emoção deduzida do verbo da narração ("— rosna Brom" → raiva). Usado quando o mestre não mandou roteiro. */
export function emocaoDoVerbo(txt) {
  const t = norm(txt);
  if (/grit|berr|brad|urr|vocifer/.test(t)) return 'grito';
  if (/rosn|esbravej|irrit|furios|rug|cosp/.test(t)) return 'raiva';
  if (/sussurr|murmur|cochich|baixa a voz/.test(t)) return 'sussurro';
  if (/gagu|trem|apavor|assust|balbuci/.test(t)) return 'medo';
  if (/solu|chor|lament|suspir/.test(t)) return 'triste';
  if (/ri\b|rindo|gargalh|sorri|anima|alegr/.test(t)) return 'alegre';
  if (/debocha|zomb|ironi|sarcas/.test(t)) return 'sarcastico';
  if (/enigm|misteri|sombri/.test(t)) return 'misterioso';
  return 'neutro';
}

/**
 * Transforma a narração em roteiro: [{quem: 'narrador' | nomeDoNpc, texto}].
 * Convenção de diálogo em pt-BR: "— Fala — diz Fulano. — Mais fala."
 */
export function roteiro(texto, { npcs = [], falante = '', heroi = '' } = {}) {
  const nomes = npcs.map((n) => n.nome).filter(Boolean);
  if (falante && !nomes.includes(falante)) nomes.push(falante);
  const acharNome = (trecho) => {
    const t = norm(trecho);
    let melhor = null;
    let pos = Infinity;
    for (const n of nomes) {
      if (heroi && norm(n) === norm(heroi)) continue;
      const variantes = [norm(n), norm(n).split(/\s+/).filter((p) => p.length > 3 && !/^(capit|senhor|madame|irma|lorde|mestre)/.test(p)).pop()].filter(Boolean);
      for (const v of variantes) {
        const i = t.indexOf(v);
        if (i >= 0 && i < pos) { pos = i; melhor = n; }
      }
    }
    return melhor;
  };
  const segs = [];
  const add = (quem, t, emocao = 'neutro') => {
    t = limparParaFala(t).replace(/^[—–-]\s*/, '').trim();
    if (!t || !/[\p{L}\d]/u.test(t)) return;
    const ult = segs[segs.length - 1];
    if (ult && ult.quem === quem && ult.emocao === emocao && (ult.texto.length + t.length) < 450) ult.texto += ' ' + t;
    else segs.push({ quem, texto: t, emocao });
  };
  let ultimoFalante = falante || null;
  // "…e baixa a voz: — Pago 50 moedas." → a fala depois dos dois-pontos vira um parágrafo de diálogo
  const paragrafos = String(texto).split(/\n{2,}|\n(?=\s*[—–])/).flatMap((p) => {
    const m = p.match(/^(.*?[:,])\s*[—–]\s+(.+)$/s);
    return m && !/^\s*[—–]/.test(p) ? [m[1], `— ${m[2]}`] : [p];
  });
  for (const par of paragrafos) {
    const p = par.trim();
    if (!p) continue;
    if (/^[—–]|^-\s/.test(p)) {
      // "— fala — narração — fala": partes pares são fala, ímpares são narração
      const partes = p.replace(/^[—–-]\s*/, '').split(/\s[—–]\s?/);
      const narracao = partes.filter((_, i) => i % 2 === 1).join(' ');
      const heroiFala = /\bvoc[eê]\s+(responde|diz|fala|grita|sussurra|pergunta|murmura|retruca)/i.test(narracao);
      const quem = heroiFala ? 'heroi' : acharNome(narracao) || acharNome(p) || ultimoFalante || 'narrador';
      if (quem !== 'narrador' && quem !== 'heroi') ultimoFalante = quem;
      const emo = emocaoDoVerbo(narracao);
      partes.forEach((t, i) => add(i % 2 === 0 ? quem : 'narrador', t, i % 2 === 0 ? emo : 'neutro'));
    } else if (/[“"«][^”"»]{2,}[”"»]/.test(p)) {
      const fora = p.replace(/[“"«][^”"»]*[”"»]/g, '');
      const quem = acharNome(fora) || ultimoFalante || 'narrador';
      const emo = emocaoDoVerbo(fora);
      p.split(/([“"«][^”"»]+[”"»])/).forEach((t) => {
        if (/^[“"«]/.test(t)) add(quem, t.replace(/[“”"«»]/g, ''), emo);
        else add('narrador', t);
      });
    } else {
      add('narrador', p);
    }
  }
  return segs;
}

/** Roteiro do mestre (campo `roteiro` do turno) → segmentos prontos para falar. */
export function roteiroDoTurno(rot) {
  return (rot || [])
    .map((r, i) => ({ quem: r.quem || 'narrador', texto: limparParaFala(r.texto), emocao: EMOCOES[r.emocao] ? r.emocao : 'neutro', bloco: i }))
    .filter((r) => r.texto && /[\p{L}\d]/u.test(r.texto));
}

/** Toca o roteiro com o motor escolhido. Só um "Narrador" fala por vez. */
export class Narrador {
  constructor() {
    this.geracao = 0;
    this.atual = null;
    this.lote = null;
    this.onFalante = () => {};
    this.estado = { status: 'parado' };
    this.cfg = {};
    window.rpg?.voz?.onEvento((ev) => {
      if (ev.tipo === 'estado') {
        this.estado = ev;
        this.onEstado?.(ev);
      } else if (ev.tipo === 'instalacao') {
        this.onInstalacao?.(ev.linha);
      }
    });
  }

  configurar(cfg) {
    this.cfg = cfg || {};
    audio.setVolumes({ voz: cfg.volVoz ?? 0.95 });
  }

  get ativo() {
    return this.cfg.vozAtiva !== false && this.cfg.vozMotor && this.cfg.vozMotor !== 'desligado';
  }

  parar() {
    this.geracao++;
    if (this.lote) window.rpg?.voz?.cancelar(this.lote).catch(() => {});
    this.lote = null;
    this.atual?.parar();
    this.atual = null;
    if (window.speechSynthesis) speechSynthesis.cancel();
    audio.abafar(false);
    this.onFalante(null, -1);
  }

  presetDe(quem, ctx) {
    if (quem === 'narrador') return PRESETS_VOZ[this.cfg.vozNarrador] ? this.cfg.vozNarrador : 'narrador-grave';
    if (quem === 'heroi') return PRESETS_VOZ[ctx.vozHeroi] ? ctx.vozHeroi : 'homem-jovem';
    if (quem.startsWith('heroi:')) { // co-op: cada herói fala com a voz que o jogador dele escolheu
      const v = ctx.vozesHerois?.[quem.slice(6)];
      return PRESETS_VOZ[v] ? v : vozDoNpc({ nome: quem.slice(6) });
    }
    const npc = (ctx.npcs || []).find((n) => n.nome === quem) || { nome: quem };
    return vozDoNpc(npc);
  }

  /**
   * Narra os trechos em sequência; o próximo já é sintetizado enquanto o atual toca.
   * @param {{quem: string, texto: string, emocao?: string}[]} segmentos
   * @param {{npcs?: object[], vozHeroi?: string, slug?: string, idioma?: 'pt'|'en'}} ctx
   */
  async falar(segmentos, ctx = {}) {
    this.parar();
    if (!this.ativo || !segmentos.length) return;
    const g = ++this.geracao;
    const vivo = () => g === this.geracao;
    const lote = `L${Date.now().toString(36)}${g}`;
    this.lote = lote;
    const velGlobal = this.cfg.vozVelocidade || 1;
    // falas longas viram frases: a voz começa ~1 s depois em vez de esperar o trecho inteiro ser sintetizado
    const pedidos = segmentos.flatMap((s, n) => dividirFala(s.texto, n === 0).map((texto, k) => ({ ...s, texto, parte: k, i: s.bloco ?? -1, preset: this.presetDe(s.quem, ctx) })));

    if (this.cfg.vozMotor === 'sistema' || this.semServico) return this.falarSistema(pedidos, vivo, velGlobal, ctx.idioma);

    const sintetizar = (p) => {
      const limpo = p.texto.replace(/\[[^\]]{1,20}\]/g, '');
      return window.rpg.voz.falar({
        texto: (ctx.idioma || 'pt') === 'pt' ? textoParaFalaPt(limpo) : limpo,
        preset: p.preset,
        idioma: ctx.idioma || 'pt',
        emocao: p.emocao || 'neutro',
        velocidade: velGlobal, // o ritmo de cada personagem e da emoção é aplicado no processo principal
        lote,
      }).then((r) => ({ buf: r.dados.buffer.slice(r.dados.byteOffset, r.dados.byteOffset + r.dados.byteLength), taxa: r.taxa || 1 }));
    };
    let i = 0;
    try {
      let proximo = sintetizar(pedidos[0]);
      proximo.catch(() => {});
      // 1ª vez: o modelo Kokoro (~320 MB) ainda está baixando/carregando → esta fala vai na voz do sistema,
      // sem deixar o jogador esperando em silêncio; a carga continua por trás e a próxima fala já sai no Kokoro
      const ESPERA = Symbol('espera');
      const primeiro = await Promise.race([proximo, new Promise((r) => setTimeout(() => r(ESPERA), this.esperaCarga ?? 6000))]);
      if (primeiro === ESPERA && ['baixando', 'iniciando'].includes(this.estado.status) && window.speechSynthesis) {
        if (!vivo()) return;
        window.rpg.voz.cancelar(lote).catch(() => {});
        this.onAviso?.(this.estado.status === 'baixando'
          ? 'Baixando a voz Kokoro pela 1ª vez (~320 MB). Enquanto isso, a narração usa a voz do sistema.'
          : 'Carregando a voz Kokoro… esta narração vai na voz do sistema.');
        return await this.falarSistema(pedidos, vivo, velGlobal, ctx.idioma);
      }
      for (; i < pedidos.length; i++) {
        const dados = await proximo;
        if (!vivo()) return;
        if (i + 1 < pedidos.length) proximo = sintetizar(pedidos[i + 1]);
        proximo?.catch(() => {}); // erro do próximo é tratado quando chegar a vez dele
        audio.abafar(true);
        this.onFalante(pedidos[i].quem, pedidos[i].i);
        this.atual = await audio.tocarVoz(dados.buf, { eco: pedidos[i].quem === 'narrador' ? 0.06 : 0.02, taxa: dados.taxa });
        await this.atual.promessa;
        if (!vivo()) return;
        // respiro entre falas: frases da mesma fala quase coladas; outro personagem, pausa maior
        const prox = pedidos[i + 1];
        await new Promise((r) => setTimeout(r, !prox ? 0 : prox.quem === pedidos[i].quem && prox.i === pedidos[i].i ? 60 : prox.quem === pedidos[i].quem ? 120 : 260));
      }
    } catch (e) {
      if (!vivo() || e.cancelado) return;
      // Kokoro não instalado → voz do sistema nesta sessão; outra falha (serviço caiu, arquivo ruim) → só nesta narração.
      // Em nenhum caso a narração para no meio.
      const naoInstalado = /instalad|instale|compilad|dotnet|ENOENT|não achei/i.test(e.message);
      if (naoInstalado) this.semServico = true;
      if (window.speechSynthesis) {
        this.onAviso?.(naoInstalado
          ? 'A voz Kokoro ainda não foi instalada — por enquanto é a voz do sistema (robótica). Instale em ⚙️ Configurações → Voz → 📦 Instalar.'
          : `A voz Kokoro falhou (${e.message.slice(0, 140)}). Esta narração continua na voz do sistema.`);
        return await this.falarSistema(pedidos.slice(i), vivo, velGlobal, ctx.idioma);
      }
      this.onErro?.(e);
    } finally {
      if (vivo()) {
        this.lote = null;
        audio.abafar(false);
        this.onFalante(null, -1);
      }
    }
  }

  /** Motor "voz do sistema" (SpeechSynthesis): não precisa instalar nada; varia tom e velocidade por personagem. */
  async falarSistema(pedidos, vivo, velGlobal, idioma = 'pt') {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const prefixo = idioma === 'en' ? /^en/i : /^pt/i;
    const vozes = synth.getVoices().filter((v) => prefixo.test(v.lang));
    const escolher = (genero) => vozes.find((v) => (genero === 'f' ? /female|maria|francisca|luciana|zira|aria|jenny|feminin/i : /male|daniel|antonio|david|guy|masculin/i).test(v.name)) || vozes[0];
    const ajusteEmo = { grito: [1.08, 1.1], raiva: [1.06, 0.95], sussurro: [0.9, 1.05], medo: [1.1, 1.1], triste: [0.88, 0.9], alegre: [1.06, 1.1] };
    for (const p of pedidos) {
      if (!vivo()) return;
      const v = PRESETS_VOZ[p.preset];
      const [kv, kt] = ajusteEmo[p.emocao] || [1, 1];
      const u = new SpeechSynthesisUtterance(p.texto.replace(/\[[^\]]{1,20}\]/g, ''));
      u.lang = idioma === 'en' ? 'en-US' : 'pt-BR';
      u.voice = escolher(v.genero) || null;
      u.rate = v.vel * velGlobal * kv;
      u.pitch = v.tom * kt;
      u.volume = this.cfg.volVoz ?? 0.95;
      audio.abafar(true);
      this.onFalante(p.quem, p.i);
      // limite de tempo: em sistemas sem voz no idioma o evento "end" pode nunca chegar
      await new Promise((res) => { u.onend = res; u.onerror = res; synth.speak(u); setTimeout(res, 3000 + p.texto.length * 110); });
    }
    if (vivo()) { audio.abafar(false); this.onFalante(null, -1); }
  }
}

export const narrador = new Narrador();
