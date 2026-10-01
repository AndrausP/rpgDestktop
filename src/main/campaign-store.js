// Cada campanha é uma pasta de verdade no disco — dá pra abrir, editar à mão, versionar no git
// e o Claude Code consegue ler tudo.
//
// <campanha>/
//   CLAUDE.md                     regras do mestre (Claude Code lê sozinho)
//   campanha.json                 nome, cenário, tema atual, capítulo, turno
//   personagem.json               ficha (vida, mana, xp, atributos, status)
//   inventario/<pasta>/<item>.json
//   missoes/*.json  npcs/*.json  lugares/*.json
//   historia/mensagens.json       log completo do chat
//   historia/cronica.md           a história narrada, legível
//   lore/*.md                     textos do seu mundo (o mestre usa como canon)

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { slugify, norm, exists, readJson, writeJson, listDirs, listFiles, clamp, toInt } = require('./util');
const { ATRIBUTOS, claudeMd, mod } = require('./gm-prompt');
const { TEMA_PADRAO } = require('./catalogo');
const memoria = require('./memoria');
const eventos = require('./eventos');
const diario = require('./diario');
const { repararMensagemMestre } = require('./turno');

const PASTAS_PADRAO = ['armas', 'armaduras', 'consumiveis', 'itens-chave', 'diversos'];
const RARIDADES = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico'];

const HEROI_PRINCIPAL = 'principal'; // o herói do host, na raiz da campanha

/** Ficha inicial de um herói (criação de campanha e herói de convidado no co-op). */
function montarPersonagem(dp = {}) {
  const at = {};
  for (const a of ATRIBUTOS) at[a] = clamp(toInt(dp.atributos?.[a], 10), 3, 20);
  const con = mod(at.constituicao);
  const intSab = Math.max(mod(at.inteligencia), mod(at.sabedoria), mod(at.carisma));
  const vidaMax = Math.max(6, toInt(dp.vidaBase, 10) + con * 2);
  const manaMax = Math.max(0, toInt(dp.manaBase, 4) + intSab * 2);
  return {
    nome: dp.nome || 'Aventureiro',
    raca: dp.raca || 'Humano',
    classe: dp.classe || 'Guerreiro',
    icone: dp.icone || '⚔️',
    retrato: dp.retrato || '',
    retratoCustom: '',
    aparencia: String(dp.aparencia || '').slice(0, 1500),
    voz: dp.voz || '',
    historia: dp.historia || '',
    nivel: 1,
    xp: 0,
    xpProximo: 100,
    vida: vidaMax,
    vidaMax,
    mana: manaMax,
    manaMax,
    ouro: toInt(dp.ouro, 15),
    atributos: at,
    status: [],
  };
}

class CampaignStore {
  constructor(root) {
    this.root = root;
    this.ultimaEscrita = 0; // usado pelo watcher para ignorar as próprias escritas
  }

  setRoot(root) {
    this.root = root;
  }

  dir(slug) {
    const d = path.join(this.root, slugify(slug));
    if (!d.startsWith(path.resolve(this.root))) throw new Error('Caminho inválido');
    return d;
  }

  marcar() {
    this.ultimaEscrita = Date.now();
  }

  async w(file, data) {
    this.marcar();
    await writeJson(file, data);
  }

  // ───────────────────────── campanhas ─────────────────────────

  async listar() {
    await fsp.mkdir(this.root, { recursive: true });
    const out = [];
    for (const nome of await listDirs(this.root)) {
      const d = path.join(this.root, nome);
      const c = await readJson(path.join(d, 'campanha.json'));
      if (!c) continue;
      const p = (await readJson(path.join(d, 'personagem.json'), {})) || {};
      out.push({
        slug: nome,
        nome: c.nome,
        cenario: c.cenario,
        tema: c.tema,
        cena: c.cena,
        local: c.local,
        dia: c.dia,
        capitulo: c.capitulo,
        turno: c.turno || 0,
        atualizadaEm: c.atualizadaEm,
        idioma: c.idioma || 'pt',
        personagem: { nome: p.nome, raca: p.raca, classe: p.classe, nivel: p.nivel, vida: p.vida, vidaMax: p.vidaMax, icone: p.icone, retrato: p.retrato, retratoCustom: p.retratoCustom || '' },
      });
    }
    return out.sort((a, b) => String(b.atualizadaEm).localeCompare(String(a.atualizadaEm)));
  }

  async criar(dados) {
    await fsp.mkdir(this.root, { recursive: true });
    let slug = slugify(dados.nome);
    let n = 2;
    while (await exists(path.join(this.root, slug))) slug = `${slugify(dados.nome)}-${n++}`;
    const d = path.join(this.root, slug);
    this.marcar();
    for (const sub of ['missoes', 'npcs', 'lugares', 'historia', 'lore', ...PASTAS_PADRAO.map((p) => `inventario/${p}`)])
      await fsp.mkdir(path.join(d, sub), { recursive: true });

    const agora = new Date().toISOString();
    const campanha = {
      nome: dados.nome || 'Nova Campanha',
      cenario: dados.cenario || 'Fantasia medieval',
      tom: dados.tom || '',
      premissa: dados.premissa || '',
      tema: dados.temaInicial || 'taverna',
      capitulo: 'Prólogo',
      turno: 0,
      criadaEm: agora,
      atualizadaEm: agora,
      claudeSessionId: null,
      cena: dados.cenaInicial || TEMA_PADRAO[dados.temaInicial] || 'taverna',
      falante: '',
      local: dados.localInicial || '',
      periodo: 'dia',
      dia: 1,
      idioma: dados.idioma === 'en' ? 'en' : 'pt',
    };
    const personagem = montarPersonagem(dados.personagem || {});
    if (dados.personagem?.imagem) personagem.retratoCustom = await this.gravarImagemHeroi(d, dados.personagem.imagem);
    await this.w(path.join(d, 'campanha.json'), campanha);
    await this.w(path.join(d, 'personagem.json'), personagem);
    await this.w(path.join(d, 'historia', 'mensagens.json'), []);
    await fsp.writeFile(path.join(d, 'historia', 'cronica.md'), `# ${campanha.nome}\n\n*${campanha.cenario}*\n\n`, 'utf8');
    await fsp.writeFile(path.join(d, 'CLAUDE.md'), claudeMd(campanha), 'utf8');
    await fsp.writeFile(
      path.join(d, 'lore', 'LEIA-ME.md'),
      '# Lore\n\nColoque aqui arquivos .md ou .txt sobre o seu mundo (reinos, deuses, facções, mapas descritos).\nO Mestre usa esses textos como verdade canônica da campanha.\n',
      'utf8'
    );
    await this.escreverLoreHeroi(d, personagem);
    for (const it of dados.itensIniciais || []) await this.ganharItem(slug, it);
    return slug;
  }

  /** Grava a imagem enviada pelo jogador (data URL png/jpeg/webp) em <campanha>/artes/heroi/. */
  async gravarImagemHeroi(d, dataUrl) {
    const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
    if (!m) throw new Error('Imagem inválida (use PNG, JPG ou WEBP).');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) throw new Error('Imagem muito grande (máx. 8 MB).');
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const dir = path.join(d, 'artes', 'heroi');
    await fsp.mkdir(dir, { recursive: true });
    this.marcar();
    // nome novo a cada troca: o cache de imagem não mostra a antiga
    for (const f of await fsp.readdir(dir).catch(() => [])) if (/^retrato-/.test(f)) await fsp.unlink(path.join(dir, f)).catch(() => {});
    const nome = `retrato-${Date.now().toString(36)}.${ext}`;
    await fsp.writeFile(path.join(dir, nome), buf);
    return `heroi/${nome}`;
  }

  async escreverLoreHeroi(d, p) {
    if (!p.historia && !p.aparencia) return;
    this.marcar();
    const partes = [`# ${p.nome}`, `${p.raca} ${p.classe}`];
    if (p.aparencia) partes.push(`## Aparência\n${p.aparencia}`);
    if (p.historia) partes.push(`## História\n${p.historia}`);
    await fsp.writeFile(path.join(d, 'lore', 'personagem.md'), partes.join('\n\n') + '\n', 'utf8');
  }

  /** Muda retrato (imagem própria ou da galeria), aparência e voz do herói. */
  async atualizarHeroi(slug, { imagem, retrato, aparencia, voz } = {}, heroi) {
    const d = this.dir(slug);
    const f = path.join(this.dirHeroi(slug, heroi), 'personagem.json');
    if (heroi && heroi !== HEROI_PRINCIPAL) imagem = null; // imagem própria só no PC do host (convidado usa a galeria)
    const p = await readJson(f);
    if (!p) throw new Error('Personagem não encontrado.');
    if (imagem) p.retratoCustom = await this.gravarImagemHeroi(d, imagem);
    else if (retrato !== undefined) {
      p.retrato = retrato;
      p.retratoCustom = '';
    }
    if (aparencia !== undefined) p.aparencia = String(aparencia).slice(0, 1500);
    if (voz !== undefined) p.voz = voz;
    await this.w(f, p);
    if (!heroi || heroi === HEROI_PRINCIPAL) await this.escreverLoreHeroi(d, p);
  }

  async excluir(slug, trashFn) {
    const d = this.dir(slug);
    if (trashFn) await trashFn(d);
    else await fsp.rm(d, { recursive: true, force: true });
  }

  /** Posições da grade de combate (quadrados de cada criatura); null encerra o combate. */
  async salvarCombate(slug, dados) {
    const f = path.join(this.dir(slug), 'historia', 'combate.json');
    this.marcar();
    if (!dados) return fsp.rm(f, { force: true });
    await writeJson(f, { mapa: String(dados.mapa || ''), turno: dados.turno ?? null, pos: Array.isArray(dados.pos) ? dados.pos.slice(0, 40) : [] });
  }

  // ───────────────────────── grupo (co-op) ─────────────────────────
  // O herói principal (do host) mora na raiz da campanha: personagem.json + inventario/.
  // Cada convidado tem herois/<id>/personagem.json + herois/<id>/inventario/ — mesma estrutura.

  dirHeroi(slug, heroi) {
    return !heroi || heroi === HEROI_PRINCIPAL ? this.dir(slug) : path.join(this.dir(slug), 'herois', slugify(heroi));
  }

  async lerFicha(slug, heroi) {
    const p = (await readJson(path.join(this.dirHeroi(slug, heroi), 'personagem.json'), {})) || {};
    p.atributos = p.atributos || {};
    for (const a of ATRIBUTOS) p.atributos[a] = toInt(p.atributos[a], 10);
    p.status = Array.isArray(p.status) ? p.status : [];
    p.id = heroi && heroi !== HEROI_PRINCIPAL ? slugify(heroi) : HEROI_PRINCIPAL;
    return p;
  }

  async lerInventario(slug, heroi) {
    const inventario = {};
    const invDir = path.join(this.dirHeroi(slug, heroi), 'inventario');
    for (const pasta of await listDirs(invDir)) {
      inventario[pasta] = [];
      for (const f of await listFiles(path.join(invDir, pasta), '.json')) {
        const item = await readJson(path.join(invDir, pasta, f));
        if (!item) continue;
        inventario[pasta].push({ ...item, id: `${pasta}/${f.replace(/\.json$/i, '')}`, pasta });
      }
      inventario[pasta].sort((a, b) => (b.equipado ? 1 : 0) - (a.equipado ? 1 : 0) || a.nome.localeCompare(b.nome));
    }
    return inventario;
  }

  /** Todos os heróis da campanha (resumo para a tela e para o mestre). O principal vem primeiro. */
  async listarHerois(slug) {
    const ids = [HEROI_PRINCIPAL, ...(await listDirs(path.join(this.dir(slug), 'herois')))];
    const out = [];
    for (const id of ids) {
      const p = await this.lerFicha(slug, id);
      if (!p.nome) continue;
      out.push({ id, nome: p.nome, raca: p.raca, classe: p.classe, nivel: p.nivel, vida: p.vida, vidaMax: p.vidaMax, mana: p.mana, manaMax: p.manaMax,
        icone: p.icone, retrato: p.retrato, retratoCustom: id === HEROI_PRINCIPAL ? p.retratoCustom : '', voz: p.voz, jogador: p.jogador || '', status: p.status });
    }
    return out;
  }

  /** Ficha + inventário de cada herói (vai para o prompt do mestre no co-op). */
  async carregarGrupo(slug) {
    const out = [];
    for (const h of await this.listarHerois(slug)) out.push({ ...(await this.lerFicha(slug, h.id)), inventario: await this.lerInventario(slug, h.id) });
    return out;
  }

  /** Cria o herói de um convidado (mesma regra de atributos/vida da criação de campanha). Devolve o id. */
  async criarHeroi(slug, dados = {}) {
    const p = montarPersonagem(dados);
    if (!p.nome || p.nome === 'Aventureiro') throw new Error('Dê um nome ao herói.');
    const grupo = await this.listarHerois(slug);
    if (grupo.some((h) => norm(h.nome) === norm(p.nome))) throw new Error(`Já existe um herói chamado ${p.nome} nesta campanha.`);
    let id = slugify(p.nome) || 'heroi';
    if (id === HEROI_PRINCIPAL) id = `${id}-2`;
    let n = 2;
    while (await exists(this.dirHeroi(slug, id))) id = `${slugify(p.nome)}-${n++}`;
    p.jogador = String(dados.jogador || '').slice(0, 40);
    const d = this.dirHeroi(slug, id);
    this.marcar();
    for (const sub of PASTAS_PADRAO) await fsp.mkdir(path.join(d, 'inventario', sub), { recursive: true });
    await this.w(path.join(d, 'personagem.json'), p);
    for (const it of dados.itensIniciais || []) await this.ganharItem(slug, it, id);
    return id;
  }

  /** Turno interrompido (app caiu no meio)? Volta tudo a como estava antes dele. Só com nenhum turno em curso. */
  async recuperarTurno(slug) {
    const desfez = await diario.recuperar(this.dir(slug));
    if (desfez) this.marcar();
    return desfez;
  }

  /**
   * Estado da campanha visto por um herói (a ficha e o inventário são os dele; o resto é de todos).
   * @param {string} slug
   * @param {{heroi?: string}} [op] id do herói (padrão: o principal, do host)
   */
  async carregar(slug, { heroi } = {}) {
    const d = this.dir(slug);
    const campanha = await readJson(path.join(d, 'campanha.json'));
    if (!campanha) throw new Error(`Campanha "${slug}" não encontrada`);
    const idHeroi = heroi && heroi !== HEROI_PRINCIPAL && (await exists(this.dirHeroi(slug, heroi))) ? slugify(heroi) : HEROI_PRINCIPAL;
    const personagem = await this.lerFicha(slug, idHeroi);
    const inventario = await this.lerInventario(slug, idHeroi);
    const grupo = await this.listarHerois(slug);
    const lerColecao = async (sub) => {
      const out = [];
      for (const f of await listFiles(path.join(d, sub), '.json')) {
        const x = await readJson(path.join(d, sub, f));
        if (x) out.push({ ...x, id: f.replace(/\.json$/i, '') });
      }
      return out.sort((a, b) => String(b.atualizadoEm || '').localeCompare(String(a.atualizadoEm || '')));
    };

    return {
      slug: slugify(slug),
      pasta: d,
      campanha,
      heroi: idHeroi,
      personagem,
      inventario,
      grupo,
      missoes: await lerColecao('missoes'),
      npcs: await lerColecao('npcs'),
      lugares: await lerColecao('lugares'),
      // turnos antigos que ficaram com o JSON cru do mestre no texto aparecem só com a narração
      mensagens: ((await readJson(path.join(d, 'historia', 'mensagens.json'), [])) || []).map(repararMensagemMestre),
      enredo: await readJson(path.join(d, 'historia', 'enredo.json'), null),
      combate: await readJson(path.join(d, 'historia', 'combate.json'), null),
      memoria: { ...memoria.MEMORIA_VAZIA, ...((await readJson(path.join(d, 'historia', 'memoria.json'), {})) || {}) },
    };
  }

  // ───────────────────────── enredo e memória ─────────────────────────
  // historia/enredo.json  → o rumo da história (criado pelo mestre no 1º turno, com segredos e atos)
  // historia/memoria.json → o que NÃO pode ser esquecido: fatos canônicos, linha do tempo curta, resumo geral
  // Vai em todo turno no lugar do histórico longo: gasta poucos tokens e segura a coerência.

  /** Enredo + memória compacta (ver ./memoria.js). */
  aplicarMemoria(slug, turno, info) {
    return memoria.aplicarMemoria(this, slug, turno, info);
  }

  async lerLore(slug, limite = 12000) {
    const d = path.join(this.dir(slug), 'lore');
    let txt = '';
    for (const f of await listFiles(d)) {
      if (!/\.(md|txt)$/i.test(f) || /^leia-me/i.test(f)) continue;
      const c = await fsp.readFile(path.join(d, f), 'utf8').catch(() => '');
      txt += `\n## ${f}\n${c.trim()}\n`;
      if (txt.length > limite) break;
    }
    return txt.slice(0, limite).trim();
  }

  async garantirClaudeMd(slug) {
    const d = this.dir(slug);
    const f = path.join(d, 'CLAUDE.md');
    const atual = (await exists(f)) ? await fsp.readFile(f, 'utf8') : null;
    if (atual && atual.includes('<!-- cronicas:v9 -->')) return;
    const c = await readJson(path.join(d, 'campanha.json'));
    this.marcar();
    if (atual) await fsp.writeFile(path.join(d, 'CLAUDE.antigo.md'), atual, 'utf8'); // guarda sua versão
    await fsp.writeFile(f, claudeMd(c), 'utf8');
  }

  async salvarCampanha(slug, campanha) {
    campanha.atualizadaEm = new Date().toISOString();
    await this.w(path.join(this.dir(slug), 'campanha.json'), campanha);
  }

  async salvarPersonagem(slug, p, heroi) {
    await this.w(path.join(this.dirHeroi(slug, heroi), 'personagem.json'), p);
  }

  async adicionarMensagens(slug, novas) {
    const d = this.dir(slug);
    const f = path.join(d, 'historia', 'mensagens.json');
    const msgs = (await readJson(f, [])) || [];
    const agora = Date.now();
    novas.forEach((m, i) => msgs.push({ id: `${agora}-${i}-${Math.random().toString(36).slice(2, 6)}`, t: new Date().toISOString(), ...m }));
    await this.w(f, msgs);
    // crônica legível
    let md = '';
    for (const m of novas) {
      if (m.papel === 'mestre') md += `${m.capituloNovo ? `\n## ${m.capituloNovo}\n\n` : ''}${m.texto}\n\n`;
      else if (m.papel === 'jogador') md += `> **${m.autorNome || 'Você'}:** ${m.texto}\n\n`;
      else if (m.papel === 'sistema') md += `> 🎲 ${m.texto}\n\n`;
    }
    if (md) {
      this.marcar();
      await fsp.appendFile(path.join(d, 'historia', 'cronica.md'), md, 'utf8');
    }
    return msgs;
  }

  async removerUltimaMensagem(slug) {
    const f = path.join(this.dir(slug), 'historia', 'mensagens.json');
    const msgs = (await readJson(f, [])) || [];
    msgs.pop();
    await this.w(f, msgs);
  }

  // ───────────────────────── inventário ─────────────────────────

  async acharItemPorNome(slug, nome, heroi) {
    const inv = path.join(this.dirHeroi(slug, heroi), 'inventario');
    const alvo = norm(nome);
    for (const pasta of await listDirs(inv)) {
      for (const f of await listFiles(path.join(inv, pasta), '.json')) {
        const file = path.join(inv, pasta, f);
        const it = await readJson(file);
        if (it && norm(it.nome) === alvo) return { file, item: it, pasta };
      }
    }
    return null;
  }

  async ganharItem(slug, dados, heroi) {
    const nome = String(dados.nome || '').trim();
    if (!nome) return null;
    const qtd = Math.max(1, toInt(dados.quantidade, 1));
    const ja = await this.acharItemPorNome(slug, nome, heroi);
    if (ja) {
      ja.item.quantidade = toInt(ja.item.quantidade, 1) + qtd;
      if (dados.descricao && !ja.item.descricao) ja.item.descricao = dados.descricao;
      await this.w(ja.file, ja.item);
      return { ...ja.item, pasta: ja.pasta };
    }
    const pasta = slugify(dados.pasta || 'diversos');
    const item = {
      nome,
      descricao: String(dados.descricao || ''),
      quantidade: qtd,
      raridade: RARIDADES.includes(dados.raridade) ? dados.raridade : 'comum',
      equipado: !!dados.equipado,
      icone: dados.icone ? String(dados.icone).slice(0, 8) : '',
      obtidoEm: new Date().toISOString(),
    };
    const dir = path.join(this.dirHeroi(slug, heroi), 'inventario', pasta);
    let base = slugify(nome);
    let file = path.join(dir, `${base}.json`);
    let n = 2;
    while (await exists(file)) file = path.join(dir, `${base}-${n++}.json`);
    await this.w(file, item);
    return { ...item, pasta };
  }

  async perderItem(slug, nome, quantidade, heroi) {
    const ja = await this.acharItemPorNome(slug, nome, heroi);
    if (!ja) return null;
    const q = Math.max(1, toInt(quantidade, 1));
    const resto = toInt(ja.item.quantidade, 1) - q;
    if (resto > 0) {
      ja.item.quantidade = resto;
      await this.w(ja.file, ja.item);
    } else {
      this.marcar();
      await fsp.unlink(ja.file);
    }
    return { ...ja.item, restante: Math.max(0, resto) };
  }

  itemFile(slug, id, heroi) {
    const [pasta, nome] = String(id).split('/');
    return path.join(this.dirHeroi(slug, heroi), 'inventario', slugify(pasta), `${slugify(nome)}.json`);
  }

  async moverItem(slug, id, destino, heroi) {
    const de = this.itemFile(slug, id, heroi);
    const pastaDest = slugify(destino);
    const dirDest = path.join(this.dirHeroi(slug, heroi), 'inventario', pastaDest);
    await fsp.mkdir(dirDest, { recursive: true });
    let para = path.join(dirDest, path.basename(de));
    let n = 2;
    while (await exists(para)) para = path.join(dirDest, `${path.basename(de, '.json')}-${n++}.json`);
    this.marcar();
    await fsp.rename(de, para);
  }

  async alternarEquipado(slug, id, heroi) {
    const f = this.itemFile(slug, id, heroi);
    const it = await readJson(f);
    if (!it) return;
    it.equipado = !it.equipado;
    await this.w(f, it);
  }

  async descartarItem(slug, id, heroi) {
    this.marcar();
    await fsp.unlink(this.itemFile(slug, id, heroi));
  }

  async criarPasta(slug, nome, heroi) {
    this.marcar();
    await fsp.mkdir(path.join(this.dirHeroi(slug, heroi), 'inventario', slugify(nome)), { recursive: true });
  }

  async excluirPasta(slug, nome, heroi) {
    const d = path.join(this.dirHeroi(slug, heroi), 'inventario', slugify(nome));
    const arquivos = await listFiles(d, '.json');
    if (arquivos.length) throw new Error('A pasta precisa estar vazia');
    this.marcar();
    await fsp.rm(d, { recursive: true, force: true });
  }

  // ───────────────────────── coleções ─────────────────────────

  /** Guarda um fato curto sobre um NPC/lugar (o que ele sabe, prometeu, esconde…). Máx. 8 por ficha. */
  async anotar(slug, sub, nome, nota) {
    const f = path.join(this.dir(slug), sub, `${slugify(nome)}.json`);
    const x = await readJson(f);
    if (!x) return;
    const n = String(nota).trim().slice(0, 200);
    if (!n) return;
    // nota que repete outra (mesmas palavras, mais ou menos) substitui a antiga em vez de acumular
    const palavras = (t) => new Set(norm(t).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
    const nova = palavras(n);
    const parecida = (o) => {
      const v = palavras(o);
      const comum = [...nova].filter((w) => v.has(w)).length;
      return comum / Math.max(1, Math.min(nova.size, v.size)) >= 0.6;
    };
    const notas = (x.notas || []).filter((o) => norm(o) !== norm(n) && !parecida(o));
    x.notas = [...notas, n].slice(-8);
    await this.w(f, x);
  }

  async upsertColecao(slug, sub, nome, campos, padroesSeNovo = {}) {
    const f = path.join(this.dir(slug), sub, `${slugify(nome)}.json`);
    const lido = await readJson(f);
    const atual = lido || { nome, criadoEm: new Date().toISOString(), ...padroesSeNovo };
    const novo = { ...atual };
    for (const [k, v] of Object.entries(campos)) if (v !== undefined && v !== null && v !== '') novo[k] = v;
    novo.atualizadoEm = new Date().toISOString();
    await this.w(f, novo);
    return { novo, existia: !!lido, antes: lido };
  }

  // ───────────────────────── eventos do mestre (ver ./eventos.js) ─────────────────────────
  tickStatus(p) {
    return eventos.tickStatus(p);
  }

  aplicarEventos(slug, lista, op) {
    return eventos.aplicarEventos(this, slug, lista, op);
  }
}

module.exports = { CampaignStore, PASTAS_PADRAO, HEROI_PRINCIPAL, montarPersonagem };
