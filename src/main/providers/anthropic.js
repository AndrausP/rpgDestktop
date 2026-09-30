// Mestre via Claude API (Messages API + tool use forçado → JSON garantido).
const { TOOL } = require('../gm-prompt');

const URL = 'https://api.anthropic.com/v1/messages';

/** Converte o histórico do app em mensagens alternadas user/assistant. */
function montarMensagens(historico, atual, maxMsgs = 40) {
  const recorte = historico.slice(-maxMsgs);
  const msgs = [];
  const push = (role, text) => {
    if (!text) return;
    const last = msgs[msgs.length - 1];
    if (last && last.role === role) last.content += `\n\n${text}`;
    else msgs.push({ role, content: text });
  };
  for (const m of recorte) {
    if (m.papel === 'mestre') push('assistant', m.texto);
    else if (m.papel === 'jogador') push('user', m.texto);
    else if (m.papel === 'sistema') push('user', `[${m.texto}]`);
  }
  if (msgs[0]?.role === 'assistant') msgs.unshift({ role: 'user', content: '(A aventura começou.)' });
  push('user', atual);
  return msgs;
}

async function chamar(settings, body, timeoutMs = 120000, externo = null) {
  if (!settings.apiKey) throw new Error('Configure sua chave da API da Anthropic em ⚙️ Configurações.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const repassar = () => ctrl.abort();
  if (externo) {
    if (externo.aborted) ctrl.abort();
    else externo.addEventListener('abort', repassar, { once: true });
  }
  try {
    const res = await fetch(URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`API ${res.status}: ${data?.error?.message || res.statusText}`);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(externo?.aborted ? 'Turno cancelado.' : 'A API demorou demais para responder (timeout).');
    throw e;
  } finally {
    clearTimeout(timer);
    externo?.removeEventListener('abort', repassar);
  }
}

async function turno({ settings, systemPrompt, historico, atual, tool = TOOL, signal = null }) {
  const data = await chamar(settings, {
    model: settings.modelo || 'claude-sonnet-5-5',
    max_tokens: 2500,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: montarMensagens(historico, atual),
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
  }, 120000, signal);
  const uso = data.content?.find((c) => c.type === 'tool_use');
  if (!uso) throw new Error('O modelo não retornou o turno no formato esperado.');
  return { turno: uso.input, uso: data.usage };
}

async function testar(settings) {
  const data = await chamar(settings, {
    model: settings.modelo || 'claude-sonnet-5-5',
    max_tokens: 20,
    messages: [{ role: 'user', content: 'Responda apenas: "O mestre está pronto."' }],
  }, 30000);
  const txt = data.content?.find((c) => c.type === 'text')?.text || 'ok';
  return `✅ Conectado (${data.model}): ${txt.trim()}`;
}

module.exports = { turno, testar, montarMensagens };
