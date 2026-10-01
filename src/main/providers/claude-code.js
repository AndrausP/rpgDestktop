// Mestre via Claude Code CLI (`claude -p`). Roda DENTRO da pasta da campanha:
// o CLAUDE.md de lá vira as regras do mestre e ele pode ler lore/, npcs/, historia/...
// A sessão é retomada com --resume, então o Claude Code mantém a memória da campanha.
const { spawn } = require('child_process');
const crypto = require('crypto');

function matar(proc) {
  if (!proc || proc.exitCode != null) return;
  // no Windows com shell:true o filho real é neto do cmd.exe: taskkill /T derruba a árvore
  if (process.platform === 'win32' && proc.pid) {
    try { spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true }); return; } catch { /* segue */ }
  }
  // no Linux/mac o processo roda no próprio grupo: mata o grupo inteiro (claude + filhos)
  try { process.kill(-proc.pid, 'SIGTERM'); return; } catch { /* sem grupo */ }
  try { proc.kill(); } catch { /* já morreu */ }
}

function executar(settings, args, { cwd, stdin, timeoutMs = 300000, signal = null } = {}) {
  return new Promise((resolve, reject) => {
    const win = process.platform === 'win32';
    let cmd = settings.claudePath || 'claude';
    if (win && /\s/.test(cmd) && !cmd.startsWith('"')) cmd = `"${cmd}"`;
    let proc;
    try {
      proc = spawn(cmd, args, { cwd, shell: win, windowsHide: true, detached: !win, env: { ...process.env } });
    } catch (e) {
      return reject(e);
    }
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      matar(proc);
      reject(new Error('O Claude Code demorou demais (timeout de 5 min).'));
    }, timeoutMs);
    const abortar = () => {
      clearTimeout(timer);
      matar(proc);
      reject(new Error('Turno cancelado.'));
    };
    if (signal) {
      if (signal.aborted) return abortar();
      signal.addEventListener('abort', abortar, { once: true });
    }
    proc.stdout.on('data', (d) => (out += d.toString('utf8')));
    proc.stderr.on('data', (d) => (err += d.toString('utf8')));
    proc.on('error', (e) => {
      clearTimeout(timer);
      if (e.code === 'ENOENT')
        reject(new Error('Claude Code não encontrado. Instale com "npm i -g @anthropic-ai/claude-code", rode "claude" uma vez para fazer login, ou ajuste o caminho em Configurações.'));
      else reject(e);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abortar);
      resolve({ code, out, err });
    });
    if (stdin != null) {
      proc.stdin.on('error', () => {});
      proc.stdin.write(stdin, 'utf8');
    }
    proc.stdin.end();
  });
}

function parseResultado(out) {
  // --output-format json devolve um único objeto; em versões antigas pode vir uma linha por evento.
  const linhas = out.trim().split(/\r?\n/).reverse();
  for (const l of [out.trim(), ...linhas]) {
    try {
      const j = JSON.parse(l);
      if (j && (j.type === 'result' || 'result' in j)) return j;
    } catch { /* próxima */ }
  }
  return null;
}

async function turno({ settings, cwd, prompt, promptNovo, sessionId, signal = null }) {
  const base = ['-p', '--output-format', 'json', '--allowedTools', 'Read,Glob,Grep'];
  if (settings.claudeModelo) base.push('--model', settings.claudeModelo);

  const rodar = async (sid, comId = true) => {
    // sessão nova com id próprio: o app sabe de antemão qual sessão é dele (versões antigas do CLI ignoram → sem a flag)
    const novoId = !sid && comId ? crypto.randomUUID() : null;
    const args = sid ? [...base, '--resume', sid] : novoId ? [...base, '--session-id', novoId] : base;
    const r = await executar(settings, args, { cwd, stdin: sid ? prompt : promptNovo || prompt, signal });
    if (novoId && r.code !== 0 && /unknown option|session-id/i.test(r.err || '')) return rodar(null, false);
    const j = parseResultado(r.out);
    if (!j) {
      const msg = (r.err || r.out || '').trim().slice(0, 400);
      const e = new Error(`Claude Code falhou (código ${r.code}). ${msg}`);
      e.resumeFalhou = !!sid && /session|conversation|resume/i.test(msg);
      throw e;
    }
    if (j.is_error || j.subtype === 'error') {
      const e = new Error(`Claude Code: ${j.result || j.error || j.subtype}`);
      e.resumeFalhou = !!sid;
      throw e;
    }
    return { texto: j.result, sessionId: novoId || j.session_id, custo: j.total_cost_usd };
  };

  try {
    return await rodar(sessionId);
  } catch (e) {
    if (signal?.aborted) throw e;
    if (sessionId && e.resumeFalhou) return { ...(await rodar(null)), sessaoNova: true };
    throw e;
  }
}

async function testar(settings) {
  const r = await executar(settings, ['--version'], { timeoutMs: 20000 });
  if (r.code !== 0) throw new Error((r.err || r.out || 'erro desconhecido').trim());
  return `✅ Claude Code encontrado: ${r.out.trim()}`;
}

module.exports = { turno, testar };
