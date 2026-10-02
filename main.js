const { app, BrowserWindow, ipcMain, shell, dialog, Menu, protocol, net } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const settings = require('./src/main/settings');
const { CampaignStore } = require('./src/main/campaign-store');
const { Engine } = require('./src/main/engine');
const catalogo = require('./src/main/catalogo');
const mapa = require('./src/main/mapa');
const { Voz } = require('./src/main/voz');
const { Sala } = require('./src/main/coop/servidor');
const { Cliente } = require('./src/main/coop/cliente');
let voz;
let sala = null; // co-op: a sala que este PC hospeda
const cliente = new Cliente((ev) => win?.webContents.send('coop:evento', ev)); // co-op: a sala em que este PC é convidado

// pasta de dados fixa (%APPDATA%/Crônicas no Windows) — o instalador da voz (npm run voz:instalar) usa a mesma
app.setPath('userData', path.join(app.getPath('appData'), 'Crônicas'));

// arte:// serve imagens embutidas, da pasta _artes/ e da pasta artes/ de cada campanha
// o nome "Crônicas" entra no User-Agent e o acento quebra os headers do protocolo arte:// → UA só ASCII
app.userAgentFallback = app.userAgentFallback.replace(/[^\x20-\x7E]/g, 'o');
protocol.registerSchemesAsPrivileged([{ scheme: 'arte', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let win;
let store;
let engine;
let watcher = null;
let watchDebounce = null;

async function init() {
  const cfg = await settings.carregar();
  store = new CampaignStore(cfg.pastaCampanhas);
  engine = new Engine(store, settings.carregar, async (slug) => catalogo.montar(store.root, slug ? store.dir(slug) : null));
  voz = new Voz(settings.carregar, {
    dirDados: path.join(app.getPath('userData'), 'voz'),
    dirApp: __dirname,
    dirRecursos: process.resourcesPath,
    avisar: (ev) => win?.webContents.send('voz:evento', ev),
  });
  protocol.handle('arte', async (req) => {
    const u = new URL(req.url);
    const arquivo = u.host === 'voz' ? voz.arquivoCache(u.pathname.replace(/^\/+/, '')) : catalogo.resolverUrl(req.url, store.root);
    if (!arquivo || !fs.existsSync(arquivo)) {
      // convidado: artes da campanha e retratos enviados ficam no PC do host
      if (cliente.ativo && (u.host === 'campanha' || u.host === 'usuario')) return cliente.arte(req.url).catch(() => new Response('', { status: 404 }));
      return new Response('não encontrado', { status: 404 });
    }
    return net.fetch(pathToFileURL(arquivo).toString());
  });
}

function criarJanela() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1060,
    minHeight: 680,
    backgroundColor: '#0d0b09',
    title: 'Crônicas',
    frame: process.platform === 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    icon: path.join(__dirname, 'renderer', 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  // Windows: janela sem moldura maximizada pode passar das bordas da tela (a barra ficava cortada em cima);
  // manda à tela quanto sobrou para fora, para a barra compensar
  const avisarMax = () => {
    const max = win.isMaximized();
    let folga = 0;
    if (max && process.platform === 'win32') {
      const { screen } = require('electron');
      const area = screen.getDisplayMatching(win.getBounds()).workArea;
      folga = Math.max(0, area.y - win.getBounds().y, win.getContentBounds().y < area.y ? area.y - win.getContentBounds().y : 0);
    }
    win.webContents.send('janela:maximizada', max, folga);
  };
  win.webContents.on('did-finish-load', avisarMax);
  win.on('maximize', avisarMax);
  win.on('unmaximize', avisarMax);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (process.argv.includes('--dev')) win.webContents.openDevTools({ mode: 'detach' });
  // links externos abrem no navegador
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

/** Observa a pasta da campanha aberta: se você (ou o Claude Code) editar um arquivo, a tela atualiza. */
function observar(slug) {
  if (watcher) watcher.close();
  watcher = null;
  if (!slug) return;
  try {
    watcher = fs.watch(store.dir(slug), { recursive: true }, (_ev, arquivo) => {
      if (!arquivo || /\.tmp$|turno-backup|turno-pendente/.test(arquivo)) return;
      if (Date.now() - store.ultimaEscrita < 1500) return; // escrita do próprio app
      clearTimeout(watchDebounce);
      watchDebounce = setTimeout(async () => {
        try {
          const state = await store.carregar(slug);
          win?.webContents.send('campanha:mudou-externamente', { state, arquivo });
        } catch { /* arquivo em edição */ }
      }, 500);
    });
  } catch {
    watcher = null;
  }
}

// ─────────────────────────── IPC ───────────────────────────
const handle = (canal, fn) =>
  ipcMain.handle(canal, async (_e, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      if (!err?.cancelado) console.error(`[${canal}]`, err);
      return { ok: false, erro: err.message || String(err), cancelado: !!err?.cancelado };
    }
  });

// Convidado de uma sala co-op: os pedidos sobre a campanha vão para o host (o slug é o da campanha dele)
const remoto = (canal, fn) => handle(canal, (...args) => (cliente.ativo && args[0] === cliente.slug ? cliente.chamar(canal, args.slice(1)) : fn(...args)));
// Host: com a sala aberta, as jogadas entram na rodada do grupo (o resultado chega pelo evento coop:evento)
const naSala = (slug) => sala && sala.slug === slug;

handle('config:ler', () => settings.carregar());
handle('config:salvar', async (novo) => {
  const cfg = await settings.salvar(novo);
  store.setRoot(cfg.pastaCampanhas);
  return cfg;
});
handle('config:escolherPasta', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: 'Pasta das campanhas' });
  return r.canceled ? null : r.filePaths[0];
});
handle('mestre:testar', () => engine.testar());
remoto('catalogo:ler', async (slug) => catalogo.comUrls(await catalogo.montar(store.root, slug ? store.dir(slug) : null), slug));
handle('compendio:listar', async () => {
  const fichas = require('./src/data/compendio-fichas.json');
  const cat = catalogo.comUrls(await catalogo.montar(store.root, null), null);
  const itens = catalogo.ITENS.map((i) => ({ ...i, ...(fichas.itens[i.id] || {}), url: cat.itens[i.id]?.url || null }));
  const monstros = cat.retratos
    .filter((r) => r.monstro)
    .map((r) => ({ id: r.id, nome: r.nome, desc: String(r.desc || '').replace(/^monstro:\s*/i, ''), url: r.url, ...(fichas.monstros[r.id] || {}) }));
  return { itens, monstros };
});
handle('mapa:ler', () => mapa.paraTela());
handle('mapa:rota', (de, para) => ({ ...mapa.rota(de, para), texto: mapa.descreverRota(de, para) }));
handle('artes:abrirPasta', () => shell.openPath(path.join(store.root, '_artes')));
handle('janela:minimizar', () => win.minimize());
handle('janela:maximizar', () => (win.isMaximized() ? win.unmaximize() : win.maximize(), win.isMaximized()));
handle('janela:fechar', () => win.close());
handle('janela:plataforma', () => process.platform);

// voz (KokoroSharp)
handle('voz:estado', () => voz.info());
handle('voz:iniciar', () => voz.iniciar());
handle('voz:instalar', () => voz.instalar());
handle('voz:falar', async (pedido) => {
  const r = await voz.falar(pedido);
  // devolve os bytes do WAV direto pelo IPC (fetch em protocolo próprio esbarra em CORS)
  const dados = await fs.promises.readFile(voz.arquivoCache(r.arquivo));
  return { ...r, dados: new Uint8Array(dados.buffer, dados.byteOffset, dados.byteLength) };
});
handle('voz:cancelar', (lote) => voz.cancelar(lote));
handle('voz:parar', () => voz.parar());
handle('voz:vozes', () => voz.listarVozes());
remoto('npc:definirVoz', async (slug, npcId, presetVoz) => {
  const f = path.join(store.dir(slug), 'npcs', `${npcId}.json`);
  const npc = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (presetVoz) npc.voz = presetVoz;
  else delete npc.voz;
  store.marcar();
  fs.writeFileSync(f, JSON.stringify(npc, null, 2), 'utf8');
  return store.carregar(slug);
});

remoto('personagem:atualizar', async (slug, dados) => {
  await store.atualizarHeroi(slug, dados);
  if (naSala(slug)) sala.avisarGrupo();
  return store.carregar(slug);
});
handle('campanhas:listar', () => store.listar());
handle('campanhas:criar', (dados) => store.criar(dados));
remoto('campanhas:carregar', async (slug) => {
  if (!engine.emCurso(slug)) await store.recuperarTurno(slug);
  const s = await store.carregar(slug);
  observar(slug);
  return s;
});
handle('campanhas:fechar', () => observar(null));
handle('campanhas:excluir', (slug) => store.excluir(slug, (d) => shell.trashItem(d)));
handle('campanhas:abrirPasta', (slug, sub) => {
  if (cliente.ativo && slug === cliente.slug) throw new Error('A pasta da campanha fica no computador do host.');
  return shell.openPath(slug ? path.join(store.dir(slug), sub || '') : store.root);
});

remoto('combate:salvar', async (slug, dados) => {
  await store.salvarCombate(slug, dados);
  if (naSala(slug)) sala.avisarCombate(dados || null);
});
remoto('jogo:cancelar', (slug) => engine.cancelar(slug));
remoto('jogo:iniciar', (slug) => (naSala(slug) ? sala.executar({ inicio: true }) : engine.jogar(slug, { inicio: true })));
remoto('jogo:acao', (slug, texto, papel) => (naSala(slug) ? sala.acao('principal', texto, papel) : engine.jogar(slug, { texto, papel })));
remoto('jogo:repetir', (slug) => (naSala(slug) ? sala.executar({ repetir: true }) : engine.jogar(slug, { repetir: true })));
remoto('jogo:desfazerUltima', async (slug) => {
  if (naSala(slug) && (sala.resolvendo || sala.acoes.size)) throw new Error('Espere a rodada do grupo terminar.');
  await store.removerUltimaMensagem(slug);
  return store.carregar(slug);
});

remoto('inventario:mover', async (slug, id, destino) => (await store.moverItem(slug, id, destino), store.carregar(slug)));
remoto('inventario:equipar', async (slug, id) => (await store.alternarEquipado(slug, id), store.carregar(slug)));
remoto('inventario:descartar', async (slug, id) => (await store.descartarItem(slug, id), store.carregar(slug)));
remoto('inventario:criarPasta', async (slug, nome) => (await store.criarPasta(slug, nome), store.carregar(slug)));
remoto('inventario:excluirPasta', async (slug, nome) => (await store.excluirPasta(slug, nome), store.carregar(slug)));

// co-op
handle('coop:hospedar', async (slug, nome) => {
  sala?.fechar();
  sala = new Sala({ store, engine, slug, nomeHost: nome, avisarHost: (ev) => win?.webContents.send('coop:evento', ev) });
  try {
    return await sala.abrir();
  } catch (e) {
    sala = null;
    throw e;
  }
});
handle('coop:info', () => sala?.info() || (cliente.ativo ? { convidado: true, rodada: cliente.ultimaRodada || null } : null));
handle('coop:parar', () => { sala?.fechar(); sala = null; return true; });
handle('coop:resolver', () => sala?.resolver() || null);
handle('coop:conectar', (dados) => cliente.conectar(dados || {}));
handle('coop:escolherHeroi', (heroi) => cliente.escolherHeroi(heroi));
handle('coop:criarHeroi', (dados) => cliente.criarHeroi(dados));
handle('coop:sair', () => (cliente.sair(), true));

app.whenReady().then(async () => {
  await init();
  criarJanela();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('before-quit', () => {
  engine?.cancelar(null); // derruba turnos em curso (processo do Claude Code incluído)
  sala?.fechar();
  cliente.sair();
  voz?.parar();
});

app.on('window-all-closed', () => {
  if (watcher) watcher.close();
  if (process.platform !== 'darwin') app.quit();
});
