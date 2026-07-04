const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const os = require('os');
const path = require('path');
const fs = require('fs');

let client = null;
let isReady = false;
let currentQr = null;
let lastError = null;

const createClient = () => {
    console.log('[WhatsApp Web Client] Creating new client instance...');
    
    const userAgentStr = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: path.join(os.tmpdir(), '.wwebjs_auth')
        }),
        userAgent: userAgentStr,
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                `--user-agent=${userAgentStr}`
            ]
        }
    });

    client.on('qr', (qr) => {
        currentQr = qr;
        console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP (Settings -> Linked Devices) ---');
        qrcode.generate(qr, { small: true });
        console.log('--------------------------------------------------------------------\n');
    });

    client.on('ready', () => {
        console.log('[WhatsApp Web Client] Authenticated and fully ready!');
        isReady = true;
        currentQr = null;
    });

    client.on('auth_failure', (msg) => {
        console.error('[WhatsApp Web Client] Auth failure:', msg);
        clearSessionCache();
    });

    client.on('disconnected', (reason) => {
        console.warn('[WhatsApp Web Client] Disconnected:', reason);
        isReady = false;
        clearSessionCache();
    });

    client.on('message', async (msg) => {
        try {
            // Only respond to private chats, avoid group chats
            if (msg.from.endsWith('@c.us')) {
                const cleanedFrom = msg.from.replace('@c.us', '');
                // Find active admissions matching this mobile number
                const { Admission, Patient, Relative } = require('../models');
                const admissions = await Admission.findAll({
                    where: { status: 'ACTIVE' },
                    include: [{
                        model: Patient,
                        required: true,
                        include: [{
                            model: Relative,
                            required: false
                        }]
                    }]
                });

                const senderNum = cleanedFrom.slice(-10); // Check last 10 digits
                
                const matchedAdmission = admissions.find(adm => {
                    // Check if the primary relative or any authorized visitors match
                    const relatives = adm.Patient ? adm.Patient.Relatives || [] : [];
                    const matchesRelative = relatives.some(r => r.mobile_number && r.mobile_number.replace(/\D/g, '').endsWith(senderNum));
                    
                    return matchesRelative && adm.Patient.uhid;
                });

                if (matchedAdmission) {
                    const { VISITING_SCHEDULE, formatTimeDisplay } = require('../config/visitingSchedule');
                    const schedule = VISITING_SCHEDULE[matchedAdmission.ward_category] || VISITING_SCHEDULE[matchedAdmission.ward_type] || VISITING_SCHEDULE['WARD'];
                    const morningHours = `${formatTimeDisplay(schedule.morning.from)} - ${formatTimeDisplay(schedule.morning.to)}`;
                    const eveningHours = `${formatTimeDisplay(schedule.evening.from)} - ${formatTimeDisplay(schedule.evening.to)}`;
                    
                    const portalUrl = process.env.VISITOR_PORTAL_URL || 'http://127.0.0.1:5173/visitor/register';
                    const base = portalUrl.endsWith('/') ? portalUrl.slice(0, -1) : portalUrl;
                    const link = `${base}/${matchedAdmission.Patient.uhid}`;

                    const detailsMsg = `Thank you! Here are the visiting details for ${matchedAdmission.Patient.full_name}:\n\n🏥 Ward: ${matchedAdmission.ward_type}\n🛏️ Bed: ${matchedAdmission.bed_number}\n\n🕐 *Visiting Hours*\nMorning: ${morningHours}\nEvening: ${eveningHours}\n\n🎟️ Click here to register for your Digital QR Pass:\n${link}`;
                    
                    await client.sendMessage(msg.from, detailsMsg);
                    console.log(`[WhatsApp Responder] Automatically sent details for patient ${matchedAdmission.Patient.full_name} to ${msg.from}`);
                }
            }
        } catch (err) {
            console.error('[WhatsApp Responder] Error handling incoming reply:', err);
        }
    });
};

const clearSessionCache = () => {
    const sessionPath = path.join(os.tmpdir(), '.wwebjs_auth');
    if (fs.existsSync(sessionPath)) {
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('[WhatsApp Web Client] Session cache directory removed.');
        } catch (err) {
            console.error('[WhatsApp Web Client] Error removing session directory:', err.message);
        }
    }
};

const logoutWhatsApp = async () => {
    console.log('[WhatsApp Web Client] Requesting session logout/reset...');
    isReady = false;
    currentQr = null;
    if (client) {
        try {
            await client.destroy();
        } catch (err) {
            console.error('[WhatsApp Web Client] Error during client destroy:', err.message);
        }
        client = null;
    }
    clearSessionCache();
    initWhatsApp();
};

const initWhatsApp = () => {
    console.log('[WhatsApp Web Client] Initializing...');
    lastError = null;
    createClient();
    client.initialize().catch(err => {
        console.error('[WhatsApp Web Client] Initialization error:', err);
        lastError = err.message || String(err);
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
            if (!isReady || !client) {
                throw new Error('WhatsApp client is not ready. Message skipped.');
            }

            // Standardize format: ensure 91 prefix for India if 10 digits, and remove formatting
            let cleaned = toMobile.replace(/\D/g, '');
            if (cleaned.length === 10) {
                cleaned = '91' + cleaned;
            }
            const chatId = `${cleaned}@c.us`;

            console.log(`[WhatsApp Web Client] Sending message to ${chatId}...`);
            
            // 15-second timeout to prevent queue hangs
            const sendPromise = client.sendMessage(chatId, message);
            const timeoutPromise = new Promise((_, rej) =>
                setTimeout(() => rej(new Error('Send operation timed out after 15 seconds')), 15000)
            );

            await Promise.race([sendPromise, timeoutPromise]);
            console.log(`[WhatsApp Web Client] Message sent successfully to ${chatId}`);
            
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
    logoutWhatsApp,
    getCurrentQr: () => currentQr,
    getIsReady: () => isReady,
    getClient: () => client,
    getLastError: () => lastError
};
