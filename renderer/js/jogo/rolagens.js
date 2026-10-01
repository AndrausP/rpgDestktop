// Rolagens de dados: card de teste pedido pelo mestre, teste livre de atributo e o overlay do dado girando.
import { $, esc, h, NOME_ATR, mod, fmtMod, rolar } from '../ui.js';
import { audio, particulas } from '../cenario.js';
import { conta, norm } from './util.js';

const D20_SVG = `<svg viewBox="0 0 100 100"><polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="rgba(0,0,0,.6)" stroke="var(--ouro-2)" stroke-width="2.5" stroke-linejoin="round"/><polygon points="50,24 76,68 24,68" fill="none" stroke="var(--ouro-2)" stroke-width="1.4" opacity=".55"/><path d="M50 3 L50 24 M93 27 L76 68 M93 73 L76 68 M50 97 L76 68 M50 97 L24 68 M7 73 L24 68 M7 27 L24 68 M7 27 L50 24 M93 27 L50 24" stroke="var(--ouro-2)" stroke-width="1" opacity=".35" fill="none"/></svg>`;

/** @param {import('./contexto.js').CtxJogo} ctx */
export function criarRolagens(ctx) {
  const { hist } = ctx;
  // ─────────────────────────── rolagens ───────────────────────────
  function mostrarCardRolagem(rol) {
    // co-op: o mestre pediu a rolagem a outro herói — você só acompanha
    const grupo = ctx.st.grupo || [];
    if (rol.heroi && grupo.length > 1 && norm(rol.heroi) !== norm(ctx.st.personagem.nome) && grupo.some((g) => norm(g.nome) === norm(rol.heroi))) {
      hist.appendChild(h(`<div class="card-rolagem outro"><div class="d20">🎲</div>
        <div class="info"><b>${esc(rol.motivo)}</b><div>${esc(rol.heroi)} vai rolar ${esc(rol.dado)}${rol.atributo ? ` + ${NOME_ATR[rol.atributo]}` : ''}${rol.dificuldade ? ` · dificuldade ${rol.dificuldade}` : ''}</div></div>
        <span class="suave">aguardando</span></div>`));
      ctx.rolarFim();
      return;
    }
    const mb = rol.atributo ? mod(ctx.st.personagem.atributos[rol.atributo]) : 0;
    const card = h(`<div class="card-rolagem">
      <div class="d20">🎲</div>
      <div class="info"><b>${esc(rol.motivo)}</b>
        <div>${esc(rol.dado)}${rol.atributo ? ` + ${NOME_ATR[rol.atributo]} (${fmtMod(mb)})` : ''}${rol.dificuldade ? ` · dificuldade ${rol.dificuldade}` : ''}</div>
      </div>
      <button class="btn primario">Rolar ${esc(rol.dado)}</button>
    </div>`);
    $('button', card).addEventListener('click', () => { card.remove(); testePedido(rol); });
    hist.appendChild(card);
    ctx.rolarFim();
  }

  function veredito(nat, total, lados, dif) {
    if (lados === 20 && nat === 20) return { txt: 'CRÍTICO!', cls: 'sucesso', critico: true };
    if (lados === 20 && nat === 1) return { txt: 'DESASTRE!', cls: 'falha', desastre: true };
    if (dif == null) return null;
    return total >= dif ? { txt: 'SUCESSO', cls: 'sucesso' } : { txt: 'FALHA', cls: 'falha' };
  }

  async function testePedido(rol) {
    const lados = parseInt(String(rol.dado).replace(/\D/g, ''), 10) || 20;
    const [nat] = rolar(lados);
    const mb = rol.atributo ? mod(ctx.st.personagem.atributos[rol.atributo]) : 0;
    const total = nat + mb;
    const v = veredito(nat, total, lados, rol.dificuldade);
    await animarRolagem(lados, nat, { titulo: rol.motivo, total, bonus: mb, veredito: v });
    if (!ctx.vivo) return;
    const partes = `${rol.dado} = ${nat}${rol.atributo ? ` ${conta(mb)} = ${total}` : ''}`;
    ctx.enviar(`🎲 ${rol.atributo ? `Teste de ${NOME_ATR[rol.atributo]}` : 'Rolagem'}${rol.dificuldade ? ` (CD ${rol.dificuldade})` : ''} — ${rol.motivo}: ${partes}${v ? ` → ${v.txt.replace('!', '')}` : ''}`, 'sistema');
  }

  async function testeLivre(atr) {
    if (ctx.ocupado) return;
    const [nat] = rolar(20);
    const mb = atr ? mod(ctx.st.personagem.atributos[atr]) : 0;
    const total = nat + mb;
    const v = veredito(nat, total, 20, null);
    const enviarAoMestre = await animarRolagem(20, nat, { titulo: atr ? `Teste de ${NOME_ATR[atr]}` : 'd20 livre', total, bonus: mb, veredito: v, perguntarEnvio: true });
    if (!ctx.vivo) return;
    const txtConta = atr ? `d20 = ${nat} ${conta(mb)} = ${total}` : `d20 = ${nat}`;
    if (enviarAoMestre) ctx.enviar(`🎲 ${atr ? `Teste livre de ${NOME_ATR[atr]}` : 'Rolagem livre'}: ${txtConta}${v ? ` → ${v.txt.replace('!', '')}` : ''}`, 'sistema');
  }

  /** Overlay com o dado girando. Retorna true se o jogador pediu para enviar ao mestre. */
  function animarRolagem(lados, nat, { titulo, total, bonus = 0, veredito: v = null, perguntarEnvio = false, mostrarDetalhe = '' }) {
    return new Promise((resolve) => {
      audio.dado();
      const ov = h(`<div class="rolagem-overlay"><div>
        <div class="dado-grande girando">${D20_SVG}<span>?</span></div>
        <div class="res"><div class="suave">${esc(titulo || '')}</div><div data-det></div><div class="veredito" data-ver></div>
        <div class="linha-flex" style="justify-content:center;margin-top:14px" data-botoes></div></div>
      </div></div>`);
      document.body.appendChild(ov);
      const face = $('.dado-grande span', ov);
      const giro = setInterval(() => (face.textContent = rolar(lados)[0]), 60);
      setTimeout(() => {
        clearInterval(giro);
        const dado = $('.dado-grande', ov);
        dado.classList.remove('girando');
        face.textContent = nat;
        audio.pousarDado();
        if (v?.critico) { dado.classList.add('critico'); audio.critico(); particulas.rajada([255, 215, 90], 90); }
        if (v?.desastre) { dado.classList.add('desastre'); audio.falhaCritica(); }
        $('[data-det]', ov).innerHTML = mostrarDetalhe
          ? `${esc(mostrarDetalhe)} = <b style="font-size:24px">${total}</b>`
          : bonus ? `${nat} ${conta(bonus)} = <b style="font-size:24px">${total}</b>` : '';
        if (v) { const ver = $('[data-ver]', ov); ver.textContent = v.txt; ver.classList.add(v.cls); }
        const bot = $('[data-botoes]', ov);
        const fechar = (val) => { ov.remove(); document.removeEventListener('keydown', tecla); resolve(val); };
        const tecla = (e) => (e.key === 'Escape' || e.key === 'Enter') && fechar(e.key === 'Enter' && perguntarEnvio);
        document.addEventListener('keydown', tecla);
        if (perguntarEnvio) {
          const b1 = h('<button class="btn primario">Enviar ao mestre</button>');
          const b2 = h('<button class="btn fantasma">Só olhar</button>');
          b1.addEventListener('click', () => fechar(true));
          b2.addEventListener('click', () => fechar(false));
          bot.append(b2, b1);
        } else {
          ov.addEventListener('click', () => fechar(false));
          setTimeout(() => ov.isConnected && fechar(false), 1700);
        }
      }, 800);
    });
  }

  return { mostrarCard: mostrarCardRolagem, testeLivre, animar: animarRolagem };
}
