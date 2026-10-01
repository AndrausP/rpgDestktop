// Voz da tela do jogo: liga o narrador (vozes.js) ao histórico — quem fala ganha destaque e o card do NPC.
import { $, $$, toast } from '../ui.js';
import { S, api } from '../app.js';
import { narrador, roteiro, roteiroDoTurno, vozDoNpc } from '../vozes.js';

/** @param {import('./contexto.js').CtxJogo} ctx */
export function criarNarracao(ctx) {
  const { el, slug, extra } = ctx;
  // ─────────────────────────── voz ───────────────────────────
  function ctxVoz() {
    const p = ctx.st.personagem;
    return {
      npcs: ctx.st.npcs, falante: ctx.st.campanha.falante, heroi: p.nome, slug, idioma: ctx.st.campanha.idioma || 'pt',
      vozHeroi: p.voz || vozDoNpc({ nome: p.nome, retrato: p.retrato }),
      vozesHerois: Object.fromEntries((ctx.st.grupo || []).map((h) => [h.nome, h.voz || vozDoNpc({ nome: h.nome, retrato: h.retrato })])),
    };
  }
  function falarComVoz(segmentos) {
    narrador.configurar(S.cfg);
    return narrador.falar(segmentos, ctxVoz());
  }
  let msgFalando = null;
  /** Narra uma mensagem do mestre: usa o roteiro dele (com emoções) ou quebra o texto antigo pelo travessão. */
  function narrarMsg(m, msgEl) {
    narrador.configurar(S.cfg);
    if (!narrador.ativo) return;
    msgFalando = msgEl;
    const segs = m.roteiro?.length ? roteiroDoTurno(m.roteiro) : roteiro(m.texto, ctxVoz());
    falarComVoz(segs);
  }
  let avisouErroVoz = false;
  narrador.onErro = (e) => {
    if (avisouErroVoz) return;
    avisouErroVoz = true;
    toast(`🗣️ Voz indisponível: ${e.message}`, 'erro', 7000);
  };
  narrador.onAviso = (msg) => { if (!avisouErroVoz) { avisouErroVoz = true; toast(`🗣️ ${msg}`, 'info', 7000); } };
  narrador.onFalante = (quem, i = -1) => {
    if (!ctx.vivo) return;
    $$('.msg.mestre.narrando', el).forEach((x) => x.classList.remove('narrando'));
    $$('.seg.falando', el).forEach((x) => x.classList.remove('falando'));
    if (quem === 'narrador' && msgFalando) msgFalando.classList.add('narrando');
    if (quem && i >= 0 && msgFalando) $(`.seg[data-seg="${i}"]`, msgFalando)?.classList.add('falando');
    const npc = quem && quem !== 'narrador' && quem !== 'heroi' && !quem.startsWith('heroi:') ? quem : null;
    ctx.renderNpc(npc);
  };
  function renderBotaoVoz() {
    const b = $('[data-voz]', extra);
    const on = S.cfg?.vozAtiva !== false && S.cfg?.vozMotor !== 'desligado';
    b.classList.toggle('on', on);
    b.style.opacity = on ? 1 : 0.5;
    b.title = on ? 'Voz ligada — clique para silenciar o mestre' : 'Voz desligada — clique para o mestre falar';
  }
  $('[data-voz]', extra).addEventListener('click', async () => {
    const vozAtiva = !(S.cfg?.vozAtiva !== false);
    S.cfg = await api.config.salvar({ vozAtiva, ...(vozAtiva && S.cfg.vozMotor === 'desligado' ? { vozMotor: 'kokoro' } : {}) });
    narrador.configurar(S.cfg);
    if (!vozAtiva) narrador.parar();
    renderBotaoVoz();
    toast(vozAtiva ? '🗣️ O mestre vai falar' : '🔇 Mestre em silêncio');
  });
  renderBotaoVoz();
  narrador.configurar(S.cfg);

  return { ctxVoz, falar: falarComVoz, narrarMsg, renderBotao: renderBotaoVoz };
}
