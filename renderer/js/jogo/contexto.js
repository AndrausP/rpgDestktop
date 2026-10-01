// Contrato entre a tela do jogo (telas/jogo.js) e os seus módulos.
// Hoje o estado vem do processo principal pelo IPC; no co-op, o mesmo contexto passa a ser alimentado
// pela rede (estado vindo do anfitrião) sem que os módulos mudem.

/**
 * @typedef {object} CtxJogo
 * @property {string} slug                      campanha aberta
 * @property {HTMLElement} el                   raiz da tela
 * @property {HTMLElement} hist                 caixa do histórico
 * @property {HTMLTextAreaElement} entrada      caixa de texto do jogador
 * @property {HTMLElement} extra                botões da barra do topo
 * @property {object} api                      window.rpg (solo/host) ou o adaptador de rede do convidado
 * @property {'solo'|'host'|'convidado'} papel   quem é este jogador na partida
 * @property {{jogadores: Object<string, {nome: string, online: boolean, enviou: boolean, host?: boolean}>, acoes: {heroi: string, texto: string, papel: string}[], prazo: number|null, resolvendo: boolean}|null} coop   última rodada da sala (co-op)
 * @property {object} st                        estado da campanha (leitura e escrita)
 * @property {boolean} ocupado                  o mestre está narrando
 * @property {boolean} vivo                     a tela ainda está aberta
 * @property {(texto: string, papel?: string) => Promise<void>} enviar
 * @property {(chamada: () => Promise<object>, op?: object) => Promise<void>} turno
 * @property {() => void} autoAltura
 * @property {() => void} renderFicha
 * @property {() => void} renderBarra
 * @property {(nome?: string|null) => void} renderNpc
 * @property {(sugestoes?: string[]) => void} renderAcoes
 * @property {() => object|null} npcEmCena
 * @property {() => boolean} emCombate
 * @property {(segmentos: object[]) => Promise<void>} falarComVoz
 * @property {(m: object, el: HTMLElement) => void} narrarMsg
 * @property {(rol: object) => void} mostrarCardRolagem
 * @property {Function} animarRolagem
 * @property {(forcar?: boolean) => void} rolarFim
 */
export {};
