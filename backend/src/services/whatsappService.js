const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

let isReady = false;

client.on('qr', (qr) => {
    console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP (Settings -> Linked Devices) ---');
    qrcode.generate(qr, { small: true });
    console.log('--------------------------------------------------------------------\n');
});

client.on('ready', () => {
    console.log('[WhatsApp Web Client] Authenticated and fully ready!');
    isReady = true;
});

client.on('auth_failure', (msg) => {
    console.error('[WhatsApp Web Client] Auth failure:', msg);
});

client.on('disconnected', (reason) => {
    console.warn('[WhatsApp Web Client] Disconnected:', reason);
    isReady = false;
});

// Initialize client
const initWhatsApp = () => {
    console.log('[WhatsApp Web Client] Initializing...');
    client.initialize().catch(err => {
        console.error('[WhatsApp Web Client] Initialization error:', err);
    });
};

// Queue system to serialize sending and avoid anti-spam bans
const queue = [];
let processing = false;

const processQueue = async () => {
    if (processing) return;
    processing = true;

    while (queue.length > 0) {
        const { toMobile, message, resolve, reject } = queue.shift();
        try {
            if (!isReady) {
                throw new Error('WhatsApp client is not ready. Message skipped.');
            }

            // Standardize format: ensure 91 prefix for India if 10 digits, and remove formatting
            let cleaned = toMobile.replace(/\D/g, '');
            if (cleaned.length === 10) {
                cleaned = '91' + cleaned;
            }
            const chatId = `${cleaned}@c.us`;

            console.log(`[WhatsApp Web Client] Sending message to ${chatId}...`);
            await client.sendMessage(chatId, message);
            
            // Add a small delay between message sends (e.g. 2 seconds) to avoid spam flagging
            await new Promise(r => setTimeout(r, 2000));
            resolve(true);
        } catch (error) {
            console.error(`[WhatsApp Web Client] Failed to send to ${toMobile}:`, error.message);
            reject(error);
        }
    }

    processing = false;
};

const sendWhatsAppMessage = (toMobile, message) => {
    return new Promise((resolve, reject) => {
        queue.push({ toMobile, message, resolve, reject });
        processQueue();
    });
};

module.exports = {
    initWhatsApp,
    sendWhatsAppMessage,
    client
};
