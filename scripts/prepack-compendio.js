// electron-builder chama este hook antes de copiar extraResources.
module.exports = async function gerarCompendioAntesDoPacote() {
  require('./gerar-compendio');
};
