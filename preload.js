const { contextBridge, ipcRenderer } = require('electron');

// Cada chamada devolve {ok, data} | {ok:false, erro}; aqui vira Promise que resolve/rejeita.
const call = async (canal, ...args) => {
  const r = await ipcRenderer.invoke(canal, ...args);
  if (!r.ok) {
    const e = new Error(r.erro);
    e.cancelado = !!r.cancelado;
    throw e;
  }
  return r.data;
};

contextBridge.exposeInMainWorld('rpg', {
  config: {
    ler: () => call('config:ler'),
    salvar: (c) => call('config:salvar', c),
    escolherPasta: () => call('config:escolherPasta'),
  },
  mestre: { testar: () => call('mestre:testar') },
  catalogo: {
    ler: (slug) => call('catalogo:ler', slug),
    abrirPasta: () => call('artes:abrirPasta'),
  },
  janela: {
    minimizar: () => call('janela:minimizar'),
    maximizar: () => call('janela:maximizar'),
    fechar: () => call('janela:fechar'),
    plataforma: () => call('janela:plataforma'),
    onMaximizada: (fn) => ipcRenderer.on('janela:maximizada', (_e, v) => fn(v)),
  },
  voz: {
    estado: () => call('voz:estado'),
    iniciar: () => call('voz:iniciar'),
    instalar: () => call('voz:instalar'),
    falar: (pedido) => call('voz:falar', pedido),
    cancelar: (lote) => call('voz:cancelar', lote),
    parar: () => call('voz:parar'),
    vozes: () => call('voz:vozes'),
    salvarRef: (id, dados, slug) => call('voz:salvarRef', id, dados, slug),
    importarRef: (id, slug) => call('voz:importarRef', id, slug),
    removerRef: (id, slug) => call('voz:removerRef', id, slug),
    abrirPasta: () => call('voz:abrirPasta'),
    definirVozNpc: (slug, npcId, preset) => call('npc:definirVoz', slug, npcId, preset),
    onEvento: (fn) => {
      const h = (_e, ev) => fn(ev);
      ipcRenderer.on('voz:evento', h);
      return () => ipcRenderer.removeListener('voz:evento', h);
    },
  },
  personagem: {
    atualizar: (slug, dados) => call('personagem:atualizar', slug, dados),
  },
  campanhas: {
    listar: () => call('campanhas:listar'),
    criar: (d) => call('campanhas:criar', d),
    carregar: (s) => call('campanhas:carregar', s),
    fechar: () => call('campanhas:fechar'),
    excluir: (s) => call('campanhas:excluir', s),
    abrirPasta: (s, sub) => call('campanhas:abrirPasta', s, sub),
  },
  jogo: {
    iniciar: (s) => call('jogo:iniciar', s),
    acao: (s, texto, papel) => call('jogo:acao', s, texto, papel),
    repetir: (s) => call('jogo:repetir', s),
    cancelar: (s) => call('jogo:cancelar', s),
    desfazerUltima: (s) => call('jogo:desfazerUltima', s),
  },
  inventario: {
    mover: (s, id, dest) => call('inventario:mover', s, id, dest),
    equipar: (s, id) => call('inventario:equipar', s, id),
    descartar: (s, id) => call('inventario:descartar', s, id),
    criarPasta: (s, nome) => call('inventario:criarPasta', s, nome),
    excluirPasta: (s, nome) => call('inventario:excluirPasta', s, nome),
  },
  onMudancaExterna: (fn) => {
    const h = (_e, payload) => fn(payload);
    ipcRenderer.on('campanha:mudou-externamente', h);
    return () => ipcRenderer.removeListener('campanha:mudou-externamente', h);
  },
});
