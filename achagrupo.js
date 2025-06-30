const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('Código QR recebido. Escaneie com o WhatsApp no seu celular:');
    qrcode.generate(qr, {small: true});
});

client.on('ready', async () => {
    console.log('Cliente WhatsApp conectado!');

    // Listar todos os chats
    const chats = await client.getChats();

    console.log('===== LISTA DE CHATS =====');
    chats.forEach((chat, index) => {
        console.log(`[${index + 1}] Nome: ${chat.name}`);
        console.log(`   ID: ${chat.id._serialized}`);
        console.log(`   Tipo: ${chat.isGroup ? 'Grupo' : 'Conversa Individual'}`);
        console.log('----------------------------');
    });
});

client.initialize();
