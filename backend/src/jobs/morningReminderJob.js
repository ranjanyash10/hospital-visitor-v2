const { Admission, Patient, Relative, AuditLog } = require('../models');
const { Op } = require('sequelize');
const { sendRegistrationLink } = require('../services/otpService');
const { getStartOfTodayIST } = require('../config/visitingSchedule');

// Helper to get current date/time mapped to India Standard Time (IST)
const getISTDate = () => {
    const now = new Date();
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    return new Date(istString);
};

const startMorningReminderJob = () => {
    console.log('Starting Morning Reminder Job (every 60s)...');

    setInterval(async () => {
        try {
            const nowIST = getISTDate();
            
            // Check if it is currently 7:00 AM IST
            if (nowIST.getHours() === 7 && nowIST.getMinutes() === 0) {
                console.log('[Morning Reminder] Triggered at 7:00 AM IST. Fetching active admissions...');
                
                const activeAdmissions = await Admission.findAll({
                    where: { status: 'ACTIVE' },
                    include: [
                        { model: Patient },
                        { model: Relative, where: { is_primary: true }, required: false }
                    ]
                });

                console.log(`[Morning Reminder] Found ${activeAdmissions.length} active admission(s).`);

                const startOfToday = getStartOfTodayIST();
                const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

                for (const admission of activeAdmissions) {
                    try {
                        const patient = admission.Patient;
                        if (!patient) continue;
                        
                        // Resolve primary relative mobile number
                        let relativeMobile = null;
                        if (patient.Relatives && patient.Relatives.length > 0) {
                            relativeMobile = patient.Relatives[0].mobile_number;
                        } else {
                            // Try to look up relative directly
                            const rel = await Relative.findOne({
                                where: { patient_id: patient.id, is_primary: true }
                            });
                            relativeMobile = rel?.mobile_number;
                        }

                        if (!relativeMobile) {
                            console.warn(`[Morning Reminder] No primary relative found for patient ${patient.full_name} (${patient.uhid}). Skipping.`);
                            continue;
                        }

                        // Check database AuditLog to see if we already sent the reminder today
                        const alreadySent = await AuditLog.findOne({
                            where: {
                                action: 'MORNING_REMINDER_SENT',
                                details: `Admission ID: ${admission.id}`,
                                createdAt: { [Op.gte]: startOfToday }
                            }
                        });

                        if (alreadySent) {
                            console.log(`[Morning Reminder] Already sent today for admission ${admission.id} (Patient: ${patient.full_name}).`);
                            continue;
                        }

                        // Send the registration link
                        const cleanedMobile = relativeMobile.replace(/\D/g, '');
                        console.log(`[Morning Reminder] Dispatching to ${cleanedMobile} for patient ${patient.full_name}`);
                        
                        await sendRegistrationLink(
                            cleanedMobile,
                            patient.full_name,
                            patient.uhid,
                            admission.ward_type,
                            admission.bed_number,
                            admission.ward_category
                        );

                        // Log to AuditLog to prevent duplicate sends
                        await AuditLog.create({
                            action: 'MORNING_REMINDER_SENT',
                            details: `Admission ID: ${admission.id}`,
                            ip_address: '127.0.0.1'
                        });

                        // Space out sends by 10 to 15 seconds to prevent spam flagging
                        const randomMs = Math.floor(Math.random() * (15000 - 10000 + 1) + 10000);
                        console.log(`[Morning Reminder] Waiting ${randomMs / 1000}s before next message...`);
                        await delay(randomMs);

                    } catch (err) {
                        console.error(`[Morning Reminder] Error processing admission ${admission.id}:`, err.message);
                    }
                }
            }
        } catch (error) {
            console.error('[Morning Reminder Job Error]:', error);
        }
    }, 60000); // Run check every minute
};

module.exports = startMorningReminderJob;
