// Aplica os eventos do mestre (dano, cura, itens, missões, NPCs...) nas pastas da campanha
// e devolve o que mostrar ao jogador. No co-op, cada evento ganha o herói dono.
const path = require('path');
const { slugify, norm, clamp, toInt } = require('./util');
const { ATRIBUTOS, NOME_ATRIBUTO, mod } = require('./regras');

// ───────────────────────── eventos do mestre ─────────────────────────

/** Passa um turno: status com duração diminuem. */
function tickStatus(p) {
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

/**
 * Aplica os eventos do mestre nas pastas e devolve o que mostrar aos jogadores.
 * No grupo, cada evento de herói (dano, cura, item, xp...) vai para quem o mestre indicou em "heroi"
 * (pelo nome); sem indicação, para o herói padrão (quem agiu) ou o principal.
 * @param {{padrao?: string}} [op] id do herói que agiu nesta rodada, se foi um só
 */
async function aplicarEventos(store, slug, eventos, { padrao } = {}) {
  const grupo = await store.listarHerois(slug);
  const multi = grupo.length > 1;
  const fichas = new Map();
  const ficha = async (id) => {
    if (!fichas.has(id)) fichas.set(id, await store.lerFicha(slug, id));
    return fichas.get(id);
  };
  const alvoDe = (e) => {
    if (e.heroi) {
      const t = norm(e.heroi);
      const h = grupo.find((x) => norm(x.nome) === t) || grupo.find((x) => norm(x.nome).split(/\s+/)[0] === t.split(/\s+/)[0]);
      if (h) return h.id;
    }
    return padrao && grupo.some((x) => x.id === padrao) ? padrao : grupo[0]?.id || 'principal';
  };
  const logs = [];
  // o tempo passa para todos: efeitos com duração diminuem em cada herói
  for (const h of grupo) {
    const p = await ficha(h.id);
    for (const l of tickStatus(p)) logs.push({ ...l, heroi: h.id, texto: multi ? `${p.nome}: ${l.texto}` : l.texto });
  }
  let alvo = grupo[0]?.id || 'principal';
  const L = (tipo, icone, texto, deHeroi = true) => logs.push({ tipo, icone, texto: deHeroi && multi ? `${fichas.get(alvo)?.nome}: ${texto}` : texto, ...(deHeroi ? { heroi: alvo } : {}) });

  for (const e of eventos || []) {
    const deHeroi = ['dano', 'cura', 'mana', 'ouro', 'xp', 'atributo', 'status_add', 'status_remove', 'item_ganho', 'item_perdido'].includes(e.tipo);
    alvo = deHeroi ? alvoDe(e) : alvo;
    const p = deHeroi ? await ficha(alvo) : null;
    const v = toInt(e.valor, 0);
    const motivo = e.motivo ? ` — ${e.motivo}` : '';
    switch (e.tipo) {
      case 'dano': {
        const antes = p.vida;
        p.vida = clamp(p.vida - Math.abs(v), 0, p.vidaMax);
        L('dano', '💔', `−${antes - p.vida} vida${motivo}`);
        if (p.vida === 0 && !p.status.some((s) => norm(s.nome) === 'caido')) {
          p.status.push({ nome: 'Caído', descricao: 'À beira da morte', turnos: 0 });
          logs.push({ tipo: 'morte', icone: '☠️', texto: `${p.nome} caiu!`, heroi: alvo });
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
        const it = await store.ganharItem(slug, e, alvo);
        if (it) L('item_ganho', '🎒', `${it.nome}${toInt(e.quantidade, 1) > 1 ? ` x${e.quantidade}` : ''} → ${it.pasta}/`);
        break;
      }
      case 'item_perdido': {
        const it = await store.perderItem(slug, e.nome, e.quantidade, alvo);
        if (it) L('item_perdido', '🗑️', `${it.nome}${toInt(e.quantidade, 1) > 1 ? ` x${e.quantidade}` : ''} saiu do inventário`);
        break;
      }
      case 'missao': {
        if (!e.nome) break;
        const { novo, existia } = await store.upsertColecao(slug, 'missoes', e.nome, {
          descricao: e.descricao, estado: e.estado,
        }, { estado: 'ativa' });
        const icone = novo.estado === 'concluida' ? '✅' : novo.estado === 'falhou' ? '❌' : '📜';
        const acao = !existia ? 'Nova missão' : novo.estado === 'concluida' ? 'Missão concluída' : novo.estado === 'falhou' ? 'Missão falhou' : 'Missão atualizada';
        L('missao', icone, `${acao}: ${novo.nome}`, false);
        break;
      }
      case 'npc': {
        if (!e.nome) break;
        const temVida = e.vida !== undefined && e.vida !== null;
        const { novo, existia, antes } = await store.upsertColecao(slug, 'npcs', e.nome, {
          descricao: e.descricao, relacao: e.relacao, retrato: e.retrato, tamanho: e.tamanho, alcance: e.alcance,
          vidaMax: e.vidaMax !== undefined ? Math.max(1, toInt(e.vidaMax, 1)) : undefined,
        }, { relacao: 'desconhecido' });
        if (e.nota) await store.anotar(slug, 'npcs', e.nome, e.nota);
        if (temVida) {
          novo.vida = clamp(toInt(e.vida, 0), 0, novo.vidaMax || 9999);
          if (!novo.vidaMax) novo.vidaMax = Math.max(1, novo.vida);
          await store.w(path.join(store.dir(slug), 'npcs', `${slugify(e.nome)}.json`), novo);
          const perdeu = (antes?.vida ?? novo.vidaMax) - novo.vida;
          if (novo.vida === 0) L('npc_derrotado', '⚔️', `${e.nome} foi derrotado!`, false);
          else if (perdeu > 0) L('npc_dano', '🗡️', `${e.nome} −${perdeu} (${novo.vida}/${novo.vidaMax})`, false);
          else if (!existia) L('npc', '👹', `${e.nome} surge (${novo.vida}/${novo.vidaMax})`, false);
        } else if (!existia || e.relacao) {
          L('npc', '👤', `${existia ? 'NPC atualizado' : 'Conheceu'}: ${e.nome}${e.relacao ? ` (${e.relacao})` : ''}`, false);
        }
        break;
      }
      case 'lugar': {
        if (!e.nome) break;
        const { existia } = await store.upsertColecao(slug, 'lugares', e.nome, { descricao: e.descricao });
        if (e.nota) await store.anotar(slug, 'lugares', e.nome, e.nota);
        if (!existia) L('lugar', '🗺️', `Descobriu: ${e.nome}`, false);
        break;
      }
    }
  }
  for (const [id, p] of fichas) await store.salvarPersonagem(slug, p, id);
  return logs;
}

module.exports = { aplicarEventos, tickStatus };
