// Utilitários compartilhados pelos módulos da tela do jogo.
export const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };
export const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** "+ 3" / "− 1" para contas de rolagem. */
export const conta = (b) => (b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`);
