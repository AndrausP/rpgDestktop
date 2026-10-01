// Diário do turno: deixa a aplicação de um turno do mestre "tudo ou nada".
// Antes de mexer nas pastas, guarda uma cópia do que pode mudar (historia/.turno-backup) e o arquivo
// historia/turno-pendente.json. Se o app cair no meio, ao abrir a campanha de novo tudo volta a como
// estava antes do turno — nada é aplicado pela metade nem em dobro — e o jogador pode pedir de novo.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { readJson, writeJson } = require('./util');

// o que um turno pode alterar (pastas e arquivos relativos à campanha)
const ALVOS = ['campanha.json', 'personagem.json', 'herois', 'inventario', 'npcs', 'missoes', 'lugares', 'historia/enredo.json', 'historia/memoria.json', 'historia/mensagens.json', 'historia/combate.json'];

const arqPendente = (dir) => path.join(dir, 'historia', 'turno-pendente.json');
const dirBackup = (dir) => path.join(dir, 'historia', '.turno-backup');
const existe = (p) => fsp.access(p).then(() => true, () => false);

/** Abre o turno: copia o estado atual e grava o pendente. */
async function iniciar(dir, info = {}) {
  const bk = dirBackup(dir);
  await fsp.rm(bk, { recursive: true, force: true });
  await fsp.mkdir(bk, { recursive: true });
  const presentes = [];
  for (const alvo of ALVOS) {
    const de = path.join(dir, alvo);
    if (!(await existe(de))) continue;
    await fsp.cp(de, path.join(bk, alvo), { recursive: true });
    presentes.push(alvo);
  }
  const cronica = path.join(dir, 'historia', 'cronica.md');
  const tamCronica = (await fsp.stat(cronica).catch(() => null))?.size ?? null;
  await writeJson(arqPendente(dir), { ...info, presentes, tamCronica, criadoEm: new Date().toISOString() });
}

/** Fecha o turno: tudo foi gravado, o backup não serve mais. */
async function concluir(dir) {
  await fsp.rm(arqPendente(dir), { force: true });
  await fsp.rm(dirBackup(dir), { recursive: true, force: true });
}

/** Desfaz um turno interrompido (chamado ao carregar a campanha). Devolve true se desfez algo. */
async function recuperar(dir) {
  const p = await readJson(arqPendente(dir), null);
  if (!p) return false;
  const bk = dirBackup(dir);
  if (await existe(bk)) {
    for (const alvo of ALVOS) {
      const atual = path.join(dir, alvo);
      const copia = path.join(bk, alvo);
      // o que o turno criou do zero some; o que existia volta como era
      await fsp.rm(atual, { recursive: true, force: true });
      if ((p.presentes || []).includes(alvo) && (await existe(copia))) await fsp.cp(copia, atual, { recursive: true });
    }
    const cronica = path.join(dir, 'historia', 'cronica.md');
    if (p.tamCronica != null && (await existe(cronica))) await fsp.truncate(cronica, p.tamCronica);
  }
  await concluir(dir);
  return true;
}

module.exports = { iniciar, concluir, recuperar, ALVOS };
