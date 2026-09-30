const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function slugify(s) {
  return (
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'sem-nome'
  );
}

/** Normaliza para comparação (sem acento, minúsculo, sem espaços extras). */
function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file, fallback = null) {
  try {
    const raw = await fsp.readFile(file, 'utf8');
    return JSON.parse(raw.replace(/^﻿/, ''));
  } catch {
    return fallback;
  }
}

/** Escrita atômica: grava em .tmp e renomeia, para não corromper o save se o app fechar no meio. */
async function writeJson(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, file);
}

async function listDirs(dir) {
  try {
    const ents = await fsp.readdir(dir, { withFileTypes: true });
    return ents.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
  } catch {
    return [];
  }
}

async function listFiles(dir, ext) {
  try {
    const ents = await fsp.readdir(dir, { withFileTypes: true });
    return ents
      .filter((e) => e.isFile() && (!ext || e.name.toLowerCase().endsWith(ext)))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function toInt(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

module.exports = { slugify, norm, exists, readJson, writeJson, listDirs, listFiles, clamp, toInt };
