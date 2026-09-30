// Cada tema muda cores, partículas e o som ambiente. O Mestre escolhe o tema pela cena.
export const TEMAS = {
  taverna: {
    nome: 'Taverna', icone: '🍺',
    cores: { a: '#150c06', b: '#3b2211', c: '#6b3514', acento: '#f2a647', acento2: '#d0643a', texto: '#f4e7d2', suave: '#bfa88a', painel: 'rgba(30,18,10,.72)', borda: 'rgba(242,166,71,.22)' },
    particulas: { tipo: 'brasas', cor: [255, 160, 70], qtd: 45 },
    som: { nota: 98, forma: 'triangle', ruido: 0.06, filtroRuido: 1400, crepitar: true },
  },
  floresta: {
    nome: 'Floresta', icone: '🌲',
    cores: { a: '#06120a', b: '#12301b', c: '#2d5a2a', acento: '#8fdc7c', acento2: '#e0ec7a', texto: '#e6f2de', suave: '#9fb899', painel: 'rgba(10,26,15,.72)', borda: 'rgba(143,220,124,.2)' },
    particulas: { tipo: 'vagalumes', cor: [210, 255, 120], qtd: 40 },
    som: { nota: 130.8, forma: 'sine', ruido: 0.05, filtroRuido: 2600, passaros: true },
  },
  masmorra: {
    nome: 'Masmorra', icone: '🕯️',
    cores: { a: '#07080b', b: '#171a21', c: '#2b303b', acento: '#a9bdd2', acento2: '#e0b262', texto: '#dde3ea', suave: '#8a95a3', painel: 'rgba(14,16,21,.8)', borda: 'rgba(169,189,210,.16)' },
    particulas: { tipo: 'poeira', cor: [200, 205, 215], qtd: 70 },
    som: { nota: 55, forma: 'sine', ruido: 0.04, filtroRuido: 400, gotas: true },
  },
  cidade: {
    nome: 'Cidade', icone: '🏰',
    cores: { a: '#0b1124', b: '#1e2b52', c: '#3a3f73', acento: '#ecc463', acento2: '#6e9bff', texto: '#eef0fa', suave: '#a3abc9', painel: 'rgba(16,22,44,.74)', borda: 'rgba(236,196,99,.22)' },
    particulas: { tipo: 'luzes', cor: [255, 220, 140], qtd: 35 },
    som: { nota: 146.8, forma: 'triangle', ruido: 0.03, filtroRuido: 1800 },
  },
  batalha: {
    nome: 'Batalha', icone: '⚔️',
    cores: { a: '#160304', b: '#420b0b', c: '#7a1a10', acento: '#ff5446', acento2: '#ffb23f', texto: '#fbe9e4', suave: '#d09a90', painel: 'rgba(36,8,8,.78)', borda: 'rgba(255,84,70,.3)' },
    particulas: { tipo: 'faiscas', cor: [255, 140, 60], qtd: 90 },
    som: { nota: 73.4, forma: 'sawtooth', ruido: 0.07, filtroRuido: 700, pulso: 1.6 },
  },
  horror: {
    nome: 'Horror', icone: '💀',
    cores: { a: '#050407', b: '#150b1b', c: '#2a1026', acento: '#d0455f', acento2: '#8fae7d', texto: '#e2dbe4', suave: '#8e8194', painel: 'rgba(12,8,14,.84)', borda: 'rgba(208,69,95,.2)' },
    particulas: { tipo: 'nevoa', cor: [170, 150, 190], qtd: 22 },
    som: { nota: 46.2, forma: 'sine', ruido: 0.05, filtroRuido: 300, dissonante: true },
  },
  deserto: {
    nome: 'Deserto', icone: '🏜️',
    cores: { a: '#221205', b: '#5e3512', c: '#a0602a', acento: '#ffcb72', acento2: '#e8803f', texto: '#fff1dc', suave: '#d4b58e', painel: 'rgba(46,26,10,.72)', borda: 'rgba(255,203,114,.25)' },
    particulas: { tipo: 'areia', cor: [240, 200, 140], qtd: 110 },
    som: { nota: 110, forma: 'sine', ruido: 0.09, filtroRuido: 900, vento: true },
  },
  neve: {
    nome: 'Neve', icone: '❄️',
    cores: { a: '#0a1422', b: '#22395a', c: '#4a6a92', acento: '#c6ebff', acento2: '#87bfff', texto: '#f0f8ff', suave: '#a9bfd6', painel: 'rgba(14,26,44,.7)', borda: 'rgba(198,235,255,.24)' },
    particulas: { tipo: 'neve', cor: [240, 248, 255], qtd: 140 },
    som: { nota: 164.8, forma: 'sine', ruido: 0.08, filtroRuido: 1100, vento: true },
  },
  mar: {
    nome: 'Mar', icone: '🌊',
    cores: { a: '#031117', b: '#0a3441', c: '#11606a', acento: '#56d8c9', acento2: '#a5e9ff', texto: '#e3f8f7', suave: '#8fb9ba', painel: 'rgba(6,28,36,.74)', borda: 'rgba(86,216,201,.22)' },
    particulas: { tipo: 'chuva', cor: [170, 220, 240], qtd: 160 },
    som: { nota: 87.3, forma: 'sine', ruido: 0.12, filtroRuido: 600, ondas: true },
  },
  arcano: {
    nome: 'Arcano', icone: '🔮',
    cores: { a: '#0c051c', b: '#2a1060', c: '#51209a', acento: '#bb95ff', acento2: '#ff82e8', texto: '#f1eaff', suave: '#ab9ccc', painel: 'rgba(22,10,48,.74)', borda: 'rgba(187,149,255,.26)' },
    particulas: { tipo: 'runas', cor: [200, 160, 255], qtd: 55 },
    som: { nota: 174.6, forma: 'sine', ruido: 0.02, filtroRuido: 3000, brilho: true },
  },
  celestial: {
    nome: 'Celestial', icone: '✨',
    cores: { a: '#17152b', b: '#433a6e', c: '#8c6fa0', acento: '#ffe39a', acento2: '#ffffff', texto: '#fffaf0', suave: '#d8cfe6', painel: 'rgba(36,32,64,.66)', borda: 'rgba(255,227,154,.32)' },
    particulas: { tipo: 'luz', cor: [255, 235, 170], qtd: 60 },
    som: { nota: 196, forma: 'sine', ruido: 0.01, filtroRuido: 4000, brilho: true, coral: true },
  },
  inferno: {
    nome: 'Inferno', icone: '🔥',
    cores: { a: '#190400', b: '#541200', c: '#9a2800', acento: '#ff7d1f', acento2: '#ffd426', texto: '#fff0e0', suave: '#e0a27a', painel: 'rgba(40,8,0,.78)', borda: 'rgba(255,125,31,.3)' },
    particulas: { tipo: 'brasas', cor: [255, 110, 30], qtd: 130, rapido: true },
    som: { nota: 41.2, forma: 'sawtooth', ruido: 0.1, filtroRuido: 500, crepitar: true },
  },
  noite: {
    nome: 'Noite', icone: '🌙',
    cores: { a: '#02040c', b: '#0c1633', c: '#1d2a5c', acento: '#a2b8ff', acento2: '#efe8ff', texto: '#e8ecff', suave: '#8e98c0', painel: 'rgba(6,10,26,.76)', borda: 'rgba(162,184,255,.2)' },
    particulas: { tipo: 'estrelas', cor: [230, 235, 255], qtd: 120 },
    som: { nota: 123.5, forma: 'sine', ruido: 0.03, filtroRuido: 1500, grilos: true },
  },
};

/** Aplica as cores do tema em :root. As transições de CSS fazem o resto. */
export function aplicarCores(id) {
  const t = TEMAS[id] || TEMAS.taverna;
  const r = document.documentElement.style;
  const c = t.cores;
  r.setProperty('--bg-a', c.a);
  r.setProperty('--bg-b', c.b);
  r.setProperty('--bg-c', c.c);
  r.setProperty('--acento', c.acento);
  r.setProperty('--acento-2', c.acento2);
  r.setProperty('--texto', c.texto);
  r.setProperty('--texto-2', c.suave);
  r.setProperty('--painel', c.painel);
  r.setProperty('--borda', c.borda);
  document.documentElement.dataset.tema = id;
  return t;
}
