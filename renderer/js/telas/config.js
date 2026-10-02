import { $, $$, esc, modal, toast } from '../ui.js';
import { S, api, recarregarConfig } from '../app.js';
import { ligarSom, audio, particulas } from '../cenario.js';
import { PRESETS_VOZ, narrador } from '../vozes.js';

const PROVEDORES = [
  { id: 'api', ic: '🧠', n: 'Claude API', d: 'Usa sua chave da API da Anthropic. Mais rápido; o mestre responde em JSON garantido via tool use.' },
  { id: 'claude-code', ic: '⌨️', n: 'Claude Code', d: 'Usa o CLI "claude" instalado no seu PC (sua assinatura). Roda dentro da pasta da campanha, lê o CLAUDE.md, a lore e mantém a sessão.' },
  { id: 'demo', ic: '🎭', n: 'Demonstração', d: 'Mestre offline com roteiro simples, para testar a interface, as pastas e os temas.' },
];

const MODELOS = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-haiku-4-5-20251001'];

export async function abrirConfig() {
  const c = { ...(await recarregarConfig()) };
  const m = modal(`
    <h2>⚙️ Configurações</h2>
    <h3>Mestre</h3>
    <div class="provedores" style="margin-top:10px">
      ${PROVEDORES.map((p) => `
        <div class="provedor ${c.provedor === p.id ? 'sel' : ''}" data-prov="${p.id}">
          <div class="ic">${p.ic}</div><div><div class="n">${p.n}</div><div class="d">${p.d}</div></div>
        </div>`).join('')}
    </div>

    <div class="cfg-bloco" data-bloco="api">
      <label class="rotulo" style="margin-top:0">Chave da API (Anthropic)</label>
      <input class="campo" type="password" data-k="apiKey" value="${esc(c.apiKey)}" placeholder="sk-ant-...">
      <div class="ajuda">Guardada criptografada pelo cofre do sistema operacional. Crie em console.anthropic.com.</div>
      <label class="rotulo">Modelo</label>
      <input class="campo" data-k="modelo" list="lista-modelos" value="${esc(c.modelo)}">
      <datalist id="lista-modelos">${MODELOS.map((x) => `<option value="${x}">`).join('')}</datalist>
    </div>

    <div class="cfg-bloco" data-bloco="claude-code">
      <label class="rotulo" style="margin-top:0">Comando do Claude Code</label>
      <input class="campo" data-k="claudePath" value="${esc(c.claudePath)}" placeholder="claude">
      <div class="ajuda">Instale com <code>npm i -g @anthropic-ai/claude-code</code> e rode <code>claude</code> uma vez para logar.</div>
      <label class="rotulo">Modelo (opcional)</label>
      <input class="campo" data-k="claudeModelo" value="${esc(c.claudeModelo)}" placeholder="padrão do Claude Code (ex.: sonnet, opus)">
      <label class="rotulo">Ritmo do mestre</label>
      <select class="campo" data-k="claudeModoMestre">
        ${[['rapido', 'Rápido — responde em ~8-12 s (recomendado)'], ['equilibrado', 'Equilibrado — pensa um pouco mais'], ['profundo', 'Profundo — pensa antes de narrar (bem mais lento)']].map(([v, t]) => `<option value="${v}" ${(c.claudeModoMestre || 'rapido') === v ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <div class="ajuda">As regras, a ficha e as tabelas de dificuldade já vão prontas a cada turno, então o mestre não precisa "pensar" para narrar bem.</div>
    </div>

    <div class="linha-flex" style="margin-top:12px">
      <button class="btn" data-testar>🔌 Testar conexão</button>
      <div class="resultado-teste suave" data-res></div>
    </div>

    <h3 style="margin-top:24px">Campanhas</h3>
    <label class="rotulo">Pasta onde as campanhas são salvas</label>
    <div class="linha-flex">
      <input class="campo" data-k="pastaCampanhas" value="${esc(c.pastaCampanhas)}">
      <button class="btn" data-pasta>📁</button>
    </div>

    <h3 style="margin-top:24px">Som</h3>
    <div class="alternar"><span>🔊 Som (ambiente e efeitos)</span><div class="switch ${c.som ? 'on' : ''}" data-sw="som"></div></div>
    <div class="alternar"><span>🎻 Música generativa (muda com o tema)</span><div class="switch ${c.musica !== false ? 'on' : ''}" data-sw="musica"></div></div>
    <div class="mixer">
      ${[['volume', '🎚️ Geral'], ['volMusica', '🎻 Música'], ['volAmbiente', '🌲 Ambiente'], ['volEfeitos', '🎲 Efeitos']].map(([k, n]) => `
        <label>${n}</label><input type="range" min="0" max="1" step="0.05" value="${c[k] ?? 0.6}" data-k="${k}"><button class="btn pequeno" data-testar-som="${k}" title="Ouvir">▶</button>`).join('')}
    </div>

    <h3 style="margin-top:24px">Voz do Mestre e dos personagens</h3>
    <div class="motores-voz">
      ${[['kokoro', '🎭 Kokoro', 'Voz neural local (KokoroSharp, Kokoro TTS 82M). Pronúncia pt-BR nativa, uma voz para cada personagem.'], ['sistema', '💻 Voz do sistema', 'Vozes do Windows. Nada para instalar.'], ['desligado', '🔇 Desligada', 'Só texto.']].map(([id, n, d]) => `
        <div class="provedor ${(c.vozMotor || 'kokoro') === id ? 'sel' : ''}" data-motor="${id}"><div><div class="n">${n}</div><div class="d">${d}</div></div></div>`).join('')}
    </div>
    <div class="cfg-bloco" data-bloco-neural>
      <div class="linha-flex"><div class="status-voz" data-voz-status>…</div>
        <button class="btn pequeno" data-voz-instalar>📦 Instalar</button>
        <button class="btn pequeno primario" data-voz-iniciar>⚡ Carregar voz</button></div>
      <div class="barra-download oculto" data-voz-barra><i></i></div>
      <pre class="log-instalacao oculto" data-voz-log></pre>
      <div class="ajuda">Instalar compila o serviço de voz com o <b>.NET 8 SDK</b> (se faltar, o app tenta instalar pelo winget). Ao carregar pela 1ª vez, o modelo Kokoro (~320 MB) é baixado. Roda na CPU, sem placa de vídeo.</div>
      <div class="alternar"><span>🎭 Emoção muda o ritmo das falas (grito acelera, tristeza desacelera)</span><div class="switch ${c.vozEmocao !== false ? 'on' : ''}" data-sw="vozEmocao"></div></div>
      <label class="rotulo">Biblioteca de vozes <span class="dica">cada voz é uma mistura de vozes do Kokoro — a 1ª dá o sotaque, a 2ª colore o timbre</span></label>
      <div class="biblioteca-vozes" data-biblioteca>…</div>
    </div>
    <label class="rotulo">Voz do narrador</label>
    <div class="linha-flex">
      <select class="campo" data-k="vozNarrador">${Object.entries(PRESETS_VOZ).map(([id, v]) => `<option value="${id}" ${(c.vozNarrador || 'narrador-grave') === id ? 'selected' : ''}>${esc(v.nome)}</option>`).join('')}</select>
      <button class="btn" data-ouvir-narrador>▶ Ouvir</button>
    </div>
    <div class="mixer">
      <label>🗣️ Volume</label><input type="range" min="0" max="1" step="0.05" value="${c.volVoz ?? 0.95}" data-k="volVoz"><span></span>
      <label>⏩ Velocidade</label><input type="range" min="0.7" max="1.3" step="0.05" value="${c.vozVelocidade ?? 1}" data-k="vozVelocidade"><span></span>
    </div>
    <div class="alternar"><span>🧝 Ler minhas falas com a voz do herói</span><div class="switch ${c.vozLerJogador ? 'on' : ''}" data-sw="vozLerJogador"></div></div>

    <h3 style="margin-top:24px">Experiência</h3>
    <div class="alternar"><span>✨ Partículas do cenário</span><div class="switch ${c.particulas !== false ? 'on' : ''}" data-sw="particulas"></div></div>
    <label class="rotulo" style="margin-top:4px">Velocidade do texto do mestre</label>
    <input type="range" min="0" max="40" step="2" value="${40 - c.velocidadeTexto}" data-vel>
    <div class="ajuda">Arraste até o fim para texto instantâneo. Clique na narração para pular.</div>

    <div class="modal-acoes">
      <button class="btn fantasma" data-fechar>Cancelar</button>
      <button class="btn primario" data-salvar>Salvar</button>
    </div>`, { classe: '' });

  const el = m.el;
  const mostrarBlocos = () => $$('[data-bloco]', el).forEach((b) => b.classList.toggle('oculto', b.dataset.bloco !== c.provedor));
  mostrarBlocos();

  $$('[data-prov]', el).forEach((p) => p.addEventListener('click', () => {
    c.provedor = p.dataset.prov;
    $$('[data-prov]', el).forEach((x) => x.classList.toggle('sel', x === p));
    mostrarBlocos();
    $('[data-res]', el).textContent = '';
  }));
  $$('[data-k]', el).forEach((i) => i.addEventListener('input', () => {
    c[i.dataset.k] = i.type === 'range' ? parseFloat(i.value) : i.value;
    if (/^vol/.test(i.dataset.k)) audio.setVolumes({ master: c.volume, musica: c.volMusica, ambiente: c.volAmbiente, efeitos: c.volEfeitos, voz: c.volVoz });
  }));
  $('[data-vel]', el).addEventListener('input', (e) => (c.velocidadeTexto = 40 - parseInt(e.target.value, 10)));
  $$('[data-sw]', el).forEach((s) => s.addEventListener('click', () => {
    const k = s.dataset.sw;
    c[k] = !(k === 'particulas' || k === 'musica' ? c[k] !== false : c[k]);
    s.classList.toggle('on', c[k]);
    if (k === 'som') ligarSom(c.som);
    if (k === 'musica') audio.setMusica(c.musica);
    if (k === 'particulas') particulas.ativo = c.particulas;
  }));
  const mostrarMotor = () => $('[data-bloco-neural]', el).classList.toggle('oculto', (c.vozMotor || 'kokoro') !== 'kokoro');
  mostrarMotor();
  $$('[data-motor]', el).forEach((m) => m.addEventListener('click', async () => {
    c.vozMotor = m.dataset.motor;
    c.vozAtiva = c.vozMotor !== 'desligado';
    $$('[data-motor]', el).forEach((x) => x.classList.toggle('sel', x === m));
    mostrarMotor();
    if (c.vozMotor === 'kokoro') {
      await api.config.salvar(c);
      narrador.semServico = false;
      api.voz.estado().then(pintarStatus).catch(() => {});
    }
  }));
  const NOMES_STATUS = { parado: '⚪ Parada', ausente: '⚠️ Não instalada', instalando: '📦 Instalando…', iniciando: '⏳ Iniciando…', baixando: '⬇️ Baixando o modelo', pronto: '🟢 Pronta', erro: '🔴 Erro' };
  const pintarStatus = (e) => {
    const st = $('[data-voz-status]', el);
    if (!st) return;
    const comPct = ['baixando', 'semeando', 'instalando', 'iniciando'].includes(e.status);
    st.innerHTML = `${NOMES_STATUS[e.status] || e.status}${comPct && e.pct ? ` ${Math.round(e.pct * 100)}%` : ''}${e.texto ? `<div class="ajuda">${esc(e.texto)}</div>` : ''}${e.erro && e.status === 'erro' || e.status === 'ausente' ? `<div class="ajuda" style="color:#ff9d9d">${esc(e.erro || '')}</div>` : ''}`;
    if (e.instalado === false && e.status !== 'instalando') st.innerHTML = `${NOMES_STATUS.ausente}<div class="ajuda">Clique em 📦 Instalar (uma vez).</div>`;
    const barra = $('[data-voz-barra]', el);
    barra.classList.toggle('oculto', !comPct);
    $('i', barra).style.width = `${Math.round((e.pct || 0) * 100)}%`;
    if (e.status === 'pronto') pintarBiblioteca();
  };
  const log = $('[data-voz-log]', el);
  api.voz.estado().then(pintarStatus).catch(() => {});
  const desligarEventosVoz = api.voz.onEvento((ev) => {
    if (ev.tipo === 'estado') pintarStatus(ev);
    if (ev.tipo === 'instalacao') {
      log.classList.remove('oculto');
      log.textContent = (log.textContent + '\n' + ev.linha).split('\n').slice(-200).join('\n');
      log.scrollTop = log.scrollHeight;
    }
  });
  m.promessa.then(desligarEventosVoz);
  $('[data-voz-instalar]', el).addEventListener('click', async () => {
    await api.config.salvar(c);
    log.textContent = '';
    api.voz.instalar().then(() => { toast('📦 Voz instalada. Agora clique em ⚡ Carregar voz.'); api.voz.estado().then(pintarStatus); })
      .catch((e) => pintarStatus({ status: 'erro', erro: e.message }));
  });
  $('[data-voz-iniciar]', el).addEventListener('click', async () => {
    await api.config.salvar(c);
    narrador.semServico = false;
    api.voz.iniciar().then(pintarStatus).catch((e) => pintarStatus({ status: 'erro', erro: e.message }));
  });
  $('[data-ouvir-narrador]', el).addEventListener('click', async () => {
    if ((c.vozMotor || 'kokoro') === 'desligado') { c.vozMotor = 'kokoro'; }
    await api.config.salvar(c);
    narrador.configurar({ ...c, vozAtiva: true });
    narrador.onErro = (e) => toast(`Voz: ${e.message}`, 'erro', 6000);
    narrador.falar([{ quem: 'narrador', texto: 'A noite cai sobre Vel\'Darim. Os sinos da velha capela voltam a tocar, e você sente que algo antigo despertou.', emocao: 'misterioso' }], {});
  });

  // biblioteca: cada voz é uma mistura de 2 vozes do Kokoro (sotaque + timbre); dá para trocar e ouvir
  const VOZES_PT = [['pm_santa', '♂ Santa (pt, grave)'], ['pm_alex', '♂ Alex (pt)'], ['pf_dora', '♀ Dora (pt)']];
  const VOZES_COR = [['', '— sem mistura —'], ['bm_george', '♂ George (britânico)'], ['bm_fable', '♂ Fable (britânico)'], ['bm_lewis', '♂ Lewis (britânico)'], ['bm_daniel', '♂ Daniel (britânico)'],
    ['am_onyx', '♂ Onyx (grave)'], ['am_fenrir', '♂ Fenrir (áspero)'], ['am_michael', '♂ Michael'], ['am_adam', '♂ Adam'], ['am_eric', '♂ Eric'], ['am_puck', '♂ Puck (moleque)'], ['am_echo', '♂ Echo'],
    ['bf_emma', '♀ Emma (britânica)'], ['bf_isabella', '♀ Isabella (britânica)'], ['af_bella', '♀ Bella'], ['af_heart', '♀ Heart'], ['af_nicole', '♀ Nicole (sussurrada)'], ['af_sky', '♀ Sky'], ['af_kore', '♀ Kore'], ['pm_santa', '♂ Santa (pt)'], ['pm_alex', '♂ Alex (pt)'], ['pf_dora', '♀ Dora (pt)']];
  async function pintarBiblioteca() {
    const box = $('[data-biblioteca]', el);
    if (!box) return;
    let lista = [];
    try { lista = await api.voz.vozes(); } catch { /* ok */ }
    const opt = (lst, v) => lst.map(([id, n]) => `<option value="${id}" ${id === v ? 'selected' : ''}>${n}</option>`).join('');
    box.innerHTML = lista.map((v) => `<div class="voz-item ${v.trocada ? 'sua' : ''}" data-id="${v.id}">
        <span class="n">${esc(v.nome)}</span>
        <select class="campo mini" data-base title="Voz principal (sotaque)">${opt(VOZES_PT, v.mix[0]?.[0])}</select>
        <select class="campo mini" data-cor title="Mistura (timbre)">${opt(VOZES_COR, v.mix[1]?.[0] || '')}</select>
        <button class="btn pequeno" data-a="ouvir" title="Ouvir">▶</button>
        ${v.trocada ? '<button class="btn pequeno" data-a="padrao" title="Voltar ao padrão">↺</button>' : ''}
      </div>`).join('');
    $$('.voz-item', box).forEach((it) => {
      const id = it.dataset.id;
      const salvarMix = async () => {
        const base = $('[data-base]', it).value;
        const cor = $('[data-cor]', it).value;
        c.vozMixes = { ...(c.vozMixes || {}), [id]: cor && cor !== base ? [[base, 0.7], [cor, 0.3]] : [[base, 1]] };
        await api.config.salvar(c);
        it.classList.add('sua');
      };
      $$('select', it).forEach((sel) => sel.addEventListener('change', salvarMix));
      it.addEventListener('click', async (ev) => {
        const a = ev.target.closest('[data-a]')?.dataset.a;
        if (!a) return;
        try {
          if (a === 'padrao') {
            const m = { ...(c.vozMixes || {}) };
            delete m[id];
            c.vozMixes = m;
            await api.config.salvar(c);
            return pintarBiblioteca();
          }
          await api.config.salvar(c);
          narrador.configurar({ ...c, vozAtiva: true, vozMotor: c.vozMotor === 'desligado' ? 'kokoro' : c.vozMotor });
          narrador.onErro = (e) => toast(`Voz: ${e.message}`, 'erro', 6000);
          const t = /^narrad/.test(id) ? 'Esta é a voz que conta a sua história.' : 'Ei, forasteiro! Você não é daqui, é?';
          if (/^narrad/.test(id)) narrador.falar([{ quem: 'narrador', texto: t }], {});
          else narrador.falar([{ quem: 'heroi', texto: t, emocao: 'neutro' }], { vozHeroi: id });
        } catch (e) { toast(e.message, 'erro'); }
      });
    });
  }
  pintarBiblioteca();
  $$('[data-testar-som]', el).forEach((b) => b.addEventListener('click', () => {
    if (!c.som) { c.som = true; $('[data-sw="som"]', el).classList.add('on'); ligarSom(true); }
    const k = b.dataset.testarSom;
    if (k === 'volEfeitos') audio.dado();
    else if (k === 'volMusica') { c.musica = true; $('[data-sw="musica"]', el).classList.add('on'); audio.setMusica(true); }
    else audio.item('epico');
  }));
  $('[data-pasta]', el).addEventListener('click', async () => {
    const p = await api.config.escolherPasta();
    if (p) {
      c.pastaCampanhas = p;
      $('[data-k="pastaCampanhas"]', el).value = p;
    }
  });
  $('[data-testar]', el).addEventListener('click', async () => {
    const res = $('[data-res]', el);
    res.textContent = 'Testando...';
    try {
      await api.config.salvar(c);
      res.textContent = await api.mestre.testar();
    } catch (e) {
      res.innerHTML = `<span style="color:#ff9d9d">❌ ${esc(e.message)}</span>`;
    }
  });
  let salvou = false;
  $('[data-salvar]', el).addEventListener('click', async () => {
    try {
      S.cfg = await api.config.salvar(c);
      salvou = true;
      toast('Configurações salvas', 'ok');
      m.fechar(true);
    } catch (e) {
      toast(e.message, 'erro');
    }
  });
  await m.promessa;
  if (!salvou) {
    // desfaz prévias ao vivo (som/partículas/volume)
    const cfg = await recarregarConfig();
    ligarSom(!!cfg.som);
    audio.setMusica(cfg.musica !== false);
  }
  return salvou;
}
