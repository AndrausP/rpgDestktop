// Gera um SQLite distribuível a partir do catálogo existente e das fichas textuais.
// Execute: npm run compendio:gerar. Nunca edite o binário manualmente.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { ITENS, RETRATOS } = require('../src/main/catalogo');
const fichas = require('../src/data/compendio-fichas.json');

const dir = path.resolve(__dirname, '../src/data');
const destino = path.join(dir, 'compendio.sqlite');
const temporario = path.join(dir, 'compendio.sqlite.tmp');
const monstros = RETRATOS.filter((r) => r.monstro);

function normalizar(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function conferir(nome, entradas, dados, quantidade) {
  const ids = entradas.map((e) => e.id);
  if (ids.length !== quantidade || new Set(ids).size !== quantidade) throw new Error(`${nome}: contagem ou IDs duplicados`);
  const faltam = ids.filter((id) => !Object.hasOwn(dados, id));
  const extras = Object.keys(dados).filter((id) => !ids.includes(id));
  if (faltam.length || extras.length) throw new Error(`${nome}: faltam ${faltam.join(', ') || 'nenhum'}; extras ${extras.join(', ') || 'nenhum'}`);
  for (const entrada of entradas) {
    const ficha = dados[entrada.id];
    if (!entrada.nome || !entrada.desc || !ficha.historia?.trim()) throw new Error(`${nome}: ficha incompleta ${entrada.id}`);
    if (nome === 'monstros' && (!ficha.habitat || !['medio', 'grande', 'enorme'].includes(ficha.tamanho)
      || !Number.isInteger(ficha.vida_max) || ficha.vida_max <= 0 || !ficha.ataque
      || !ficha.dano_formula || !ficha.tipo_dano || !['corpo', 'distancia'].includes(ficha.alcance)
      || !Array.isArray(ficha.habilidades) || !ficha.habilidades.length)) throw new Error(`Monstro incompleto: ${entrada.id}`);
    if (nome === 'itens' && (!entrada.pasta || !entrada.raridade || !entrada.icone
      || !Object.hasOwn(ficha, 'dano_formula') || !Object.hasOwn(ficha, 'efeito')))
      throw new Error(`Item incompleto: ${entrada.id}`);
    if (!fs.existsSync(path.resolve(__dirname, '../renderer/assets', entrada.arquivo)))
      throw new Error(`Arte ausente: ${entrada.arquivo}`);
  }
}

conferir('itens', ITENS, fichas.itens, 28);
conferir('monstros', monstros, fichas.monstros, 20);

fs.mkdirSync(dir, { recursive: true });
if (fs.existsSync(temporario)) fs.rmSync(temporario);
const db = new DatabaseSync(temporario);
try {
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE items (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT NOT NULL, historia TEXT NOT NULL,
      raridade TEXT NOT NULL, pasta TEXT NOT NULL, icone TEXT NOT NULL, arquivo TEXT NOT NULL,
      dano_formula TEXT, tipo_dano TEXT, alcance TEXT, efeito TEXT, familia TEXT NOT NULL,
      busca TEXT NOT NULL
    ) STRICT;
    CREATE TABLE item_aliases (
      alias TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE
    ) STRICT;
    CREATE TABLE monsters (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT NOT NULL, historia TEXT NOT NULL,
      habitat TEXT NOT NULL, tamanho TEXT NOT NULL CHECK (tamanho IN ('medio','grande','enorme')),
      vida_max INTEGER NOT NULL CHECK (vida_max > 0), ataque TEXT NOT NULL,
      dano_formula TEXT NOT NULL, tipo_dano TEXT NOT NULL,
      alcance TEXT NOT NULL CHECK (alcance IN ('corpo','distancia')),
      habilidades TEXT NOT NULL, arquivo TEXT NOT NULL, busca TEXT NOT NULL
    ) STRICT;
    CREATE INDEX items_busca_idx ON items(busca);
    CREATE INDEX monsters_busca_idx ON monsters(busca);`);
  db.exec('BEGIN');
  const inserirItem = db.prepare(`INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const inserirAlias = db.prepare(`INSERT INTO item_aliases VALUES (?,?)`);
  const inserirMonstro = db.prepare(`INSERT INTO monsters VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const item of ITENS) {
    const f = fichas.itens[item.id];
    inserirItem.run(item.id, item.nome, item.desc, f.historia, item.raridade, item.pasta,
      item.icone, item.arquivo, f.dano_formula, f.tipo_dano, f.alcance, f.efeito,
      JSON.stringify(item.familia || []), normalizar([item.nome, item.desc, f.historia, ...(item.apelidos || [])].join(' ')));
    for (const alias of item.apelidos || []) inserirAlias.run(alias, item.id);
  }
  for (const monstro of monstros) {
    const f = fichas.monstros[monstro.id];
    inserirMonstro.run(monstro.id, monstro.nome, monstro.desc.replace(/^monstro:\s*/, ''), f.historia,
      f.habitat, f.tamanho, f.vida_max, f.ataque, f.dano_formula, f.tipo_dano,
      f.alcance, JSON.stringify(f.habilidades), monstro.arquivo,
      normalizar([monstro.nome, monstro.desc, f.historia, f.habitat].join(' ')));
  }
  db.exec('COMMIT');
  const [i, m, a] = [db.prepare('SELECT COUNT(*) AS n FROM items').get().n,
    db.prepare('SELECT COUNT(*) AS n FROM monsters').get().n,
    db.prepare('SELECT COUNT(*) AS n FROM item_aliases').get().n];
  if (i !== 28 || m !== 20 || a !== ITENS.reduce((n, x) => n + (x.apelidos?.length || 0), 0))
    throw new Error('Contagem final inválida');
  if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Aliases órfãos');
  console.log(`Compêndio gerado: ${i} itens, ${m} monstros, ${a} apelidos.`);
} finally {
  db.close();
}
if (fs.existsSync(destino)) fs.rmSync(destino);
fs.renameSync(temporario, destino);
