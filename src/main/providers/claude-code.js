// Mestre via Claude Code CLI (`claude -p`). Roda DENTRO da pasta da campanha:
// o CLAUDE.md de lá vira as regras do mestre e ele pode ler lore/, npcs/, historia/...
// A sessão é retomada com --resume, então o Claude Code mantém a memória da campanha.
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

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

// O mestre não programa: troca o prompt de sistema de programação do Claude Code (~15 mil tokens) por um curto.
// As regras do jogo continuam vindo do CLAUDE.md da pasta da campanha.
const PROMPT_SISTEMA = 'Você é o Mestre de RPG do app Crônicas. As regras completas estão no CLAUDE.md desta pasta (já carregado no contexto). Leia lore/, npcs/ e historia/ só se precisar. Responda SEMPRE apenas com o objeto JSON do turno, compacto (uma linha, sem cercas de código), sem texto fora dele.';
// Flags novas do CLI: se a versão instalada não conhecer alguma, o app lembra e para de mandar
let flagsRapidas = true;

/**
 * Argumentos de velocidade. Medido (3 turnos reais, Sonnet): esforço baixo + prompt de sistema curto + só as
 * ferramentas de leitura = turnos ~25-35% mais rápidos e entrada ~45% mais barata, sem perder qualidade do JSON.
 */
const ESFORCO = { rapido: 'low', equilibrado: 'medium', profundo: 'high' };
function argsVelocidade(settings) {
  if (!flagsRapidas) return [];
  return ['--effort', ESFORCO[settings.claudeModoMestre] || 'low', '--system-prompt-file', arquivoPrompt(), '--tools', 'Read,Glob,Grep'];
}
/** O prompt curto vai por arquivo: no Windows a linha de comando (cmd.exe) estraga acentos e aspas. */
function arquivoPrompt() {
  const f = path.join(os.tmpdir(), 'cronicas-mestre-sistema.md');
  try { if (fs.readFileSync(f, 'utf8') === PROMPT_SISTEMA) return f; } catch { /* ainda não existe */ }
  fs.writeFileSync(f, PROMPT_SISTEMA, 'utf8');
  return f;
}

function executar(settings, args, { cwd, stdin, timeoutMs = 300000, signal = null } = {}) {
  return new Promise((resolve, reject) => {
    const win = process.platform === 'win32';
    let cmd = settings.claudePath || 'claude';
    if (win && /\s/.test(cmd) && !cmd.startsWith('"')) cmd = `"${cmd}"`;
    let proc;
    try {
      // sem "pensar" antes de responder: o turno já vem com regras e estado prontos (com o Haiku, pensar levava
      // o turno de ~27 s para ~92 s). Quem quiser liga em Configurações → Ritmo do mestre → Profundo.
      const env = { ...process.env };
      if (settings.claudeModoMestre !== 'profundo') env.MAX_THINKING_TOKENS = '0';
      // no Windows (shell:true) caminho com espaço precisa de aspas
      const a = win ? args.map((x) => (/\s/.test(x) && !/^".*"$/.test(x) ? `"${x}"` : x)) : args;
      proc = spawn(cmd, a, { cwd, shell: win, windowsHide: true, detached: !win, env });
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
  const montarBase = () => {
    const b = ['-p', '--output-format', 'json', '--allowedTools', 'Read,Glob,Grep', ...argsVelocidade(settings)];
    if (settings.claudeModelo) b.push('--model', settings.claudeModelo);
    return b;
  };
  let base = montarBase();

  const rodar = async (sid, comId = true) => {
    // sessão nova com id próprio: o app sabe de antemão qual sessão é dele (versões antigas do CLI ignoram → sem a flag)
    const novoId = !sid && comId ? crypto.randomUUID() : null;
    const args = sid ? [...base, '--resume', sid] : novoId ? [...base, '--session-id', novoId] : base;
    const r = await executar(settings, args, { cwd, stdin: sid ? prompt : promptNovo || prompt, signal });
    // CLI antigo sem --effort/--tools/--system-prompt: tira as flags de velocidade e tenta de novo
    if (r.code !== 0 && flagsRapidas && /unknown option|unrecognized|effort|--tools|system-prompt/i.test(r.err || '') && !parseResultado(r.out)) {
      flagsRapidas = false;
      base = montarBase();
      return rodar(sid, comId);
    }
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
