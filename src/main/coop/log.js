// Log do co-op: console + arquivo (userData/coop.log), para diagnosticar quando o amigo não consegue entrar.
const fs = require('fs');
const path = require('path');

let arquivo = null;
function definirArquivo(p) { arquivo = p; }
function caminho() { return arquivo; }

function log(msg) {
  const linha = `[${new Date().toISOString()}] ${msg}`;
  console.log(`[coop] ${linha}`);
  if (!arquivo) return;
  try {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.appendFileSync(arquivo, linha + '\n');
  } catch { /* log nunca derruba o jogo */ }
}

/** Explica em português o código de erro de rede do Node/undici. */
function explicarRede(e) {
  const c = e?.cause?.code || e?.cause?.errors?.[0]?.code || e?.code || '';
  switch (c) {
    case 'ECONNREFUSED': return 'o host recusou a conexão (a sala não está aberta nessa porta, ou o endereço/porta está errado)';
    case 'ETIMEDOUT': case 'UND_ERR_CONNECT_TIMEOUT': return 'tempo esgotado — quase sempre é o Firewall do Windows do host bloqueando (libere o Crônicas/Electron em "Rede privada") ou IP de outra rede/adaptador virtual';
    case 'EHOSTUNREACH': case 'ENETUNREACH': return 'PC do host inalcançável (redes diferentes, Wi‑Fi com isolamento de clientes ou VPN ligada)';
    case 'ENOTFOUND': case 'EAI_AGAIN': return 'endereço não encontrado (digite o IP, ex.: 192.168.0.10)';
    case 'ECONNRESET': return 'conexão derrubada pelo host';
    default: return e?.name === 'TimeoutError' ? 'tempo esgotado (10 s) — provável Firewall do host' : (c || e?.message || 'erro desconhecido');
  }
}

module.exports = { log, definirArquivo, caminho, explicarRede };
