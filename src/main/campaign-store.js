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
const { ATRIBUTOS, NOME_ATRIBUTO, claudeMd, mod } = require('./gm-prompt');
const { TEMA_PADRAO } = require('./catalogo');

const PASTAS_PADRAO = ['armas', 'armaduras', 'consumiveis', 'itens-chave', 'diversos'];
const RARIDADES = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico'];

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
    const at = {};
    for (const a of ATRIBUTOS) at[a] = clamp(toInt(dados.personagem?.atributos?.[a], 10), 3, 20);
    const con = mod(at.constituicao);
    const intSab = Math.max(mod(at.inteligencia), mod(at.sabedoria), mod(at.carisma));
    const vidaMax = Math.max(6, toInt(dados.personagem?.vidaBase, 10) + con * 2);
    const manaMax = Math.max(0, toInt(dados.personagem?.manaBase, 4) + intSab * 2);
    const personagem = {
      nome: dados.personagem?.nome || 'Aventureiro',
      raca: dados.personagem?.raca || 'Humano',
      classe: dados.personagem?.classe || 'Guerreiro',
      icone: dados.personagem?.icone || '⚔️',
      retrato: dados.personagem?.retrato || '',
      retratoCustom: '',
      aparencia: String(dados.personagem?.aparencia || '').slice(0, 1500),
      voz: dados.personagem?.voz || '',
      historia: dados.personagem?.historia || '',
      nivel: 1,
      xp: 0,
      xpProximo: 100,
      vida: vidaMax,
      vidaMax,
      mana: manaMax,
      manaMax,
      ouro: toInt(dados.personagem?.ouro, 15),
      atributos: at,
      status: [],
    };
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
  async atualizarHeroi(slug, { imagem, retrato, aparencia, voz } = {}) {
    const d = this.dir(slug);
    const f = path.join(d, 'personagem.json');
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
    await this.escreverLoreHeroi(d, p);
  }

  async excluir(slug, trashFn) {
    const d = this.dir(slug);
    if (trashFn) await trashFn(d);
    else await fsp.rm(d, { recursive: true, force: true });
  }

  async carregar(slug) {
    const d = this.dir(slug);
    const campanha = await readJson(path.join(d, 'campanha.json'));
    if (!campanha) throw new Error(`Campanha "${slug}" não encontrada`);
    const personagem = await readJson(path.join(d, 'personagem.json'), {});
    personagem.atributos = personagem.atributos || {};
    for (const a of ATRIBUTOS) personagem.atributos[a] = toInt(personagem.atributos[a], 10);
    personagem.status = Array.isArray(personagem.status) ? personagem.status : [];

    const inventario = {};
    const invDir = path.join(d, 'inventario');
    for (const pasta of await listDirs(invDir)) {
      inventario[pasta] = [];
      for (const f of await listFiles(path.join(invDir, pasta), '.json')) {
        const item = await readJson(path.join(invDir, pasta, f));
        if (!item) continue;
        inventario[pasta].push({ ...item, id: `${pasta}/${f.replace(/\.json$/i, '')}`, pasta });
      }
      inventario[pasta].sort((a, b) => (b.equipado ? 1 : 0) - (a.equipado ? 1 : 0) || a.nome.localeCompare(b.nome));
    }

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
      personagem,
      inventario,
      missoes: await lerColecao('missoes'),
      npcs: await lerColecao('npcs'),
      lugares: await lerColecao('lugares'),
      mensagens: (await readJson(path.join(d, 'historia', 'mensagens.json'), [])) || [],
    };
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
    if (atual && atual.includes('<!-- cronicas:v4 -->')) return;
    const c = await readJson(path.join(d, 'campanha.json'));
    this.marcar();
    if (atual) await fsp.writeFile(path.join(d, 'CLAUDE.antigo.md'), atual, 'utf8'); // guarda sua versão
    await fsp.writeFile(f, claudeMd(c), 'utf8');
  }

  async salvarCampanha(slug, campanha) {
    campanha.atualizadaEm = new Date().toISOString();
    await this.w(path.join(this.dir(slug), 'campanha.json'), campanha);
  }

  async salvarPersonagem(slug, p) {
    await this.w(path.join(this.dir(slug), 'personagem.json'), p);
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
      else if (m.papel === 'jogador') md += `> **Você:** ${m.texto}\n\n`;
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

  async acharItemPorNome(slug, nome) {
    const inv = path.join(this.dir(slug), 'inventario');
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

  async ganharItem(slug, dados) {
    const nome = String(dados.nome || '').trim();
    if (!nome) return null;
    const qtd = Math.max(1, toInt(dados.quantidade, 1));
    const ja = await this.acharItemPorNome(slug, nome);
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
    const dir = path.join(this.dir(slug), 'inventario', pasta);
    let base = slugify(nome);
    let file = path.join(dir, `${base}.json`);
    let n = 2;
    while (await exists(file)) file = path.join(dir, `${base}-${n++}.json`);
    await this.w(file, item);
    return { ...item, pasta };
  }

  async perderItem(slug, nome, quantidade) {
    const ja = await this.acharItemPorNome(slug, nome);
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

  itemFile(slug, id) {
    const [pasta, nome] = String(id).split('/');
    return path.join(this.dir(slug), 'inventario', slugify(pasta), `${slugify(nome)}.json`);
  }

  async moverItem(slug, id, destino) {
    const de = this.itemFile(slug, id);
    const pastaDest = slugify(destino);
    const dirDest = path.join(this.dir(slug), 'inventario', pastaDest);
    await fsp.mkdir(dirDest, { recursive: true });
    let para = path.join(dirDest, path.basename(de));
    let n = 2;
    while (await exists(para)) para = path.join(dirDest, `${path.basename(de, '.json')}-${n++}.json`);
    this.marcar();
    await fsp.rename(de, para);
  }

  async alternarEquipado(slug, id) {
    const f = this.itemFile(slug, id);
    const it = await readJson(f);
    if (!it) return;
    it.equipado = !it.equipado;
    await this.w(f, it);
  }

  async descartarItem(slug, id) {
    this.marcar();
    await fsp.unlink(this.itemFile(slug, id));
  }

  async criarPasta(slug, nome) {
    this.marcar();
    await fsp.mkdir(path.join(this.dir(slug), 'inventario', slugify(nome)), { recursive: true });
  }

  async excluirPasta(slug, nome) {
    const d = path.join(this.dir(slug), 'inventario', slugify(nome));
    const arquivos = await listFiles(d, '.json');
    if (arquivos.length) throw new Error('A pasta precisa estar vazia');
    this.marcar();
    await fsp.rm(d, { recursive: true, force: true });
  }

  // ───────────────────────── coleções ─────────────────────────

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

  // ───────────────────────── eventos do mestre ─────────────────────────

  /** Passa um turno: status com duração diminuem. */
  tickStatus(p) {
    const logs = [];
    p.status = (p.status || []).filter((s) => {
      if (!s.turnos) return true;
      s.turnos -= 1;
      if (s.turnos <= 0) {
        logs.push({ tipo: 'status_remove', icone: '✨', texto: `${s.nome} passou` });
        return false;
      }
      return true;
    });
    return logs;
  }

  /** Aplica os eventos do mestre nas pastas e devolve o que mostrar ao jogador. */
  async aplicarEventos(slug, eventos) {
    const p = (await readJson(path.join(this.dir(slug), 'personagem.json'))) || {};
    p.status = p.status || [];
    const logs = [...this.tickStatus(p)];
    const L = (tipo, icone, texto) => logs.push({ tipo, icone, texto });

    for (const e of eventos || []) {
      const v = toInt(e.valor, 0);
      const motivo = e.motivo ? ` — ${e.motivo}` : '';
      switch (e.tipo) {
        case 'dano': {
          const antes = p.vida;
          p.vida = clamp(p.vida - Math.abs(v), 0, p.vidaMax);
          L('dano', '💔', `−${antes - p.vida} vida${motivo}`);
          if (p.vida === 0 && !p.status.some((s) => norm(s.nome) === 'caido')) {
            p.status.push({ nome: 'Caído', descricao: 'À beira da morte', turnos: 0 });
            L('morte', '☠️', `${p.nome} caiu!`);
          }
          break;
        }
        case 'cura': {
          const antes = p.vida;
          p.vida = clamp(p.vida + Math.abs(v), 0, p.vidaMax);
          if (p.vida > 0) p.status = p.status.filter((s) => norm(s.nome) !== 'caido');
          L('cura', '💚', p.vida - antes > 0 ? `+${p.vida - antes} vida${motivo}` : `Vida já está cheia${motivo}`);
          break;
        }
        case 'mana': {
          const antes = p.mana;
          p.mana = clamp(p.mana + v, 0, p.manaMax);
          const d = p.mana - antes;
          L('mana', '🔷', `${d >= 0 ? '+' : ''}${d} mana${motivo}`);
          break;
        }
        case 'ouro': {
          const antes = p.ouro;
          p.ouro = Math.max(0, p.ouro + v);
          const d = p.ouro - antes;
          L('ouro', '🪙', `${d >= 0 ? '+' : ''}${d} ouro${motivo}`);
          break;
        }
        case 'xp': {
          p.xp += Math.abs(v);
          L('xp', '⭐', `+${Math.abs(v)} XP${motivo}`);
          while (p.xp >= p.xpProximo) {
            p.xp -= p.xpProximo;
            p.nivel += 1;
            p.xpProximo = Math.round(p.xpProximo * 1.5);
            const ganhoVida = 5 + Math.max(0, mod(p.atributos.constituicao));
            p.vidaMax += ganhoVida;
            p.vida = p.vidaMax;
            p.manaMax += 3;
            p.mana = p.manaMax;
            L('nivel', '🏆', `NÍVEL ${p.nivel}! +${ganhoVida} vida máx, +3 mana máx`);
          }
          break;
        }
        case 'atributo': {
          if (!ATRIBUTOS.includes(e.atributo)) break;
          p.atributos[e.atributo] = clamp(toInt(p.atributos[e.atributo], 10) + v, 1, 30);
          L('atributo', '📈', `${NOME_ATRIBUTO[e.atributo]} ${v >= 0 ? '+' : ''}${v}${motivo}`);
          break;
        }
        case 'status_add': {
          if (!e.nome) break;
          p.status = p.status.filter((s) => norm(s.nome) !== norm(e.nome));
          const positivo = typeof e.positivo === 'boolean' ? e.positivo : !/envenen|sangr|atordo|exaust|congel|amaldi|ca[ií]do|medo|ferid|cego|lento|fraco|doen|queim|arrepi|paralis/i.test(e.nome);
          p.status.push({ nome: e.nome, descricao: e.descricao || '', turnos: Math.max(0, toInt(e.turnos, 0)), positivo });
          L('status_add', positivo ? '✨' : '🩸', `${e.nome}${e.turnos ? ` (${e.turnos} turnos)` : ''}`);
          break;
        }
        case 'status_remove': {
          const antes = p.status.length;
          p.status = p.status.filter((s) => norm(s.nome) !== norm(e.nome));
          if (p.status.length < antes) L('status_remove', '✨', `${e.nome} removido`);
          break;
        }
        case 'item_ganho': {
          const it = await this.ganharItem(slug, e);
          if (it) L('item_ganho', '🎒', `${it.nome}${toInt(e.quantidade, 1) > 1 ? ` x${e.quantidade}` : ''} → ${it.pasta}/`);
          break;
        }
        case 'item_perdido': {
          const it = await this.perderItem(slug, e.nome, e.quantidade);
          if (it) L('item_perdido', '🗑️', `${it.nome}${toInt(e.quantidade, 1) > 1 ? ` x${e.quantidade}` : ''} saiu do inventário`);
          break;
        }
        case 'missao': {
          if (!e.nome) break;
          const { novo, existia } = await this.upsertColecao(slug, 'missoes', e.nome, {
            descricao: e.descricao, estado: e.estado,
          }, { estado: 'ativa' });
          const icone = novo.estado === 'concluida' ? '✅' : novo.estado === 'falhou' ? '❌' : '📜';
          const acao = !existia ? 'Nova missão' : novo.estado === 'concluida' ? 'Missão concluída' : novo.estado === 'falhou' ? 'Missão falhou' : 'Missão atualizada';
          L('missao', icone, `${acao}: ${novo.nome}`);
          break;
        }
        case 'npc': {
          if (!e.nome) break;
          const temVida = e.vida !== undefined && e.vida !== null;
          const { novo, existia, antes } = await this.upsertColecao(slug, 'npcs', e.nome, {
            descricao: e.descricao, relacao: e.relacao, retrato: e.retrato,
            vidaMax: e.vidaMax !== undefined ? Math.max(1, toInt(e.vidaMax, 1)) : undefined,
          }, { relacao: 'desconhecido' });
          if (temVida) {
            novo.vida = clamp(toInt(e.vida, 0), 0, novo.vidaMax || 9999);
            if (!novo.vidaMax) novo.vidaMax = Math.max(1, novo.vida);
            await this.w(path.join(this.dir(slug), 'npcs', `${slugify(e.nome)}.json`), novo);
            const perdeu = (antes?.vida ?? novo.vidaMax) - novo.vida;
            if (novo.vida === 0) L('npc_derrotado', '⚔️', `${e.nome} foi derrotado!`);
            else if (perdeu > 0) L('npc_dano', '🗡️', `${e.nome} −${perdeu} (${novo.vida}/${novo.vidaMax})`);
            else if (!existia) L('npc', '👹', `${e.nome} surge (${novo.vida}/${novo.vidaMax})`);
          } else if (!existia || e.relacao) {
            L('npc', '👤', `${existia ? 'NPC atualizado' : 'Conheceu'}: ${e.nome}${e.relacao ? ` (${e.relacao})` : ''}`);
          }
          break;
        }
        case 'lugar': {
          if (!e.nome) break;
          const { existia } = await this.upsertColecao(slug, 'lugares', e.nome, { descricao: e.descricao });
          if (!existia) L('lugar', '🗺️', `Descobriu: ${e.nome}`);
          break;
        }
      }
    }
    await this.salvarPersonagem(slug, p);
    return logs;
  }
}

module.exports = { CampaignStore, PASTAS_PADRAO };
