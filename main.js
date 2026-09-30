const { app, BrowserWindow, ipcMain, shell, dialog, Menu, protocol, net } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const settings = require('./src/main/settings');
const { CampaignStore } = require('./src/main/campaign-store');
const { Engine } = require('./src/main/engine');
const catalogo = require('./src/main/catalogo');
const { Voz } = require('./src/main/voz');
let voz;

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
    getRaiz: () => store.root,
    dirCampanha: (slug) => store.dir(slug),
    avisar: (ev) => win?.webContents.send('voz:evento', ev),
  });
  protocol.handle('arte', async (req) => {
    const u = new URL(req.url);
    const arquivo = u.host === 'voz' ? voz.arquivoCache(u.pathname.replace(/^\/+/, '')) : catalogo.resolverUrl(req.url, store.root);
    if (!arquivo || !fs.existsSync(arquivo)) return new Response('não encontrado', { status: 404 });
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
  // microfone só para gravar a voz de um personagem (Configurações → Voz → 🎙️); nada além disso
  const ses = win.webContents.session;
  ses.setPermissionRequestHandler((_wc, permissao, cb, detalhes) => {
    cb(permissao === 'media' && (detalhes?.mediaTypes || ['audio']).every((t) => t === 'audio'));
  });
  ses.setPermissionCheckHandler((_wc, permissao) => permissao === 'media');
  const avisarMax = () => win.webContents.send('janela:maximizada', win.isMaximized());
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
      if (!arquivo || /\.tmp$/.test(arquivo)) return;
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
handle('catalogo:ler', async (slug) => catalogo.comUrls(await catalogo.montar(store.root, slug ? store.dir(slug) : null), slug));
handle('artes:abrirPasta', () => shell.openPath(path.join(store.root, '_artes')));
handle('janela:minimizar', () => win.minimize());
handle('janela:maximizar', () => (win.isMaximized() ? win.unmaximize() : win.maximize(), win.isMaximized()));
handle('janela:fechar', () => win.close());
handle('janela:plataforma', () => process.platform);

// voz (Chatterbox)
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
handle('voz:salvarRef', (id, dados, slug) => voz.salvarReferencia({ id, slug, dados, ext: '.wav' }));
handle('voz:removerRef', (id, slug) => voz.removerReferencia({ id, slug }));
handle('voz:importarRef', async (id, slug) => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Escolha uma gravação de voz (10 a 20 segundos, uma pessoa falando, sem música)',
    filters: [{ name: 'Áudio', extensions: ['wav', 'flac', 'mp3', 'ogg'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return voz.importarReferencia({ id, slug, origem: r.filePaths[0] });
});
handle('voz:abrirPasta', async () => {
  const d = voz.pastaVozesUsuario();
  await fs.promises.mkdir(d, { recursive: true });
  return shell.openPath(d);
});
handle('npc:definirVoz', async (slug, npcId, presetVoz) => {
  const f = path.join(store.dir(slug), 'npcs', `${npcId}.json`);
  const npc = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (presetVoz) npc.voz = presetVoz;
  else delete npc.voz;
  store.marcar();
  fs.writeFileSync(f, JSON.stringify(npc, null, 2), 'utf8');
  return store.carregar(slug);
});

handle('personagem:atualizar', async (slug, dados) => (await store.atualizarHeroi(slug, dados), store.carregar(slug)));
handle('campanhas:listar', () => store.listar());
handle('campanhas:criar', (dados) => store.criar(dados));
handle('campanhas:carregar', async (slug) => {
  const s = await store.carregar(slug);
  observar(slug);
  return s;
});
handle('campanhas:fechar', () => observar(null));
handle('campanhas:excluir', (slug) => store.excluir(slug, (d) => shell.trashItem(d)));
handle('campanhas:abrirPasta', (slug, sub) => shell.openPath(slug ? path.join(store.dir(slug), sub || '') : store.root));

handle('jogo:cancelar', (slug) => engine.cancelar(slug));
handle('jogo:iniciar', (slug) => engine.jogar(slug, { inicio: true }));
handle('jogo:acao', (slug, texto, papel) => engine.jogar(slug, { texto, papel }));
handle('jogo:repetir', (slug) => engine.jogar(slug, { repetir: true }));
handle('jogo:desfazerUltima', async (slug) => {
  await store.removerUltimaMensagem(slug);
  return store.carregar(slug);
});

handle('inventario:mover', async (slug, id, destino) => (await store.moverItem(slug, id, destino), store.carregar(slug)));
handle('inventario:equipar', async (slug, id) => (await store.alternarEquipado(slug, id), store.carregar(slug)));
handle('inventario:descartar', async (slug, id) => (await store.descartarItem(slug, id), store.carregar(slug)));
handle('inventario:criarPasta', async (slug, nome) => (await store.criarPasta(slug, nome), store.carregar(slug)));
handle('inventario:excluirPasta', async (slug, nome) => (await store.excluirPasta(slug, nome), store.carregar(slug)));

app.whenReady().then(async () => {
  await init();
  criarJanela();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('before-quit', () => {
  engine?.cancelar(null); // derruba turnos em curso (processo do Claude Code incluído)
  voz?.parar();
});

app.on('window-all-closed', () => {
  if (watcher) watcher.close();
  if (process.platform !== 'darwin') app.quit();
});
