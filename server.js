/**
 * NetView v3.2.0
 * 
 * Vitor Cavalcante (vtrcav) - 2025
 * Repositório: https://github.com/vtrcav/netview
 * 
 * Este é o ponto de entrada. Abaixo estão os dois modos de uso:
 * 
 * 1.   CLI interativo:
 *    - Execute com: `npm start` ou `node server.js --cli`
 *    - Inicia o servidor, habilita a interface web e o terminal interativo.
 *    - É por aqui que você:
 *        • Conecta o WhatsApp (QR Code)
 *        • Adiciona, edita e remove dispositivos
 *        • Define o grupo de notificações
 *        • Visualiza histórico e logs em tempo real
 * 
 * 2.   Modo background:
 *    - Execute com: `node server.js`
 *    - Ideal para rodar o sistema com PM2 ou como serviço.
 *    - Só use este modo depois que tudo estiver configurado via CLI.
 */

const { NetViewServer } = require('./src/core/NetViewServer');
const logger = require('./src/utils/Logger');
(async () => {
    try {
        const isCliMode = process.argv.includes('--cli') || process.argv.includes('-c');
        const server = new NetViewServer();
        await server.start({ cli: isCliMode });
    } catch (error) {
        logger.error('Erro fatal ao iniciar o NetView:', error);
        process.exit(1);
    }
})();