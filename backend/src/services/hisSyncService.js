/**
 * HIS Sync Service
 * -----------------
 * Polls the HIS API Bridge every 30 seconds.
 * - Auto-Admits new patients into the VMS.
 * - Auto-Discharges patients no longer in the HIS.
 *
 * Environment Variables:
 *   HIS_API_URL  – e.g. http://192.168.1.10:4000/api/inpatients
 *   HIS_SYNC_ENABLED – set to 'true' to enable (disabled by default)
 *   HIS_SYNC_INTERVAL_MS – polling interval (default: 30000)
 */

const { Patient, Admission, Relative, AdmissionVisitor, VisitorSlip, sequelize } = require('../models');
const { sendRegistrationLink } = require('./otpService');
const { Op } = require('sequelize');

const HIS_API_URL = process.env.HIS_API_URL;
const SYNC_INTERVAL = parseInt(process.env.HIS_SYNC_INTERVAL_MS) || 30000;

/**
 * Fetch current inpatients from the HIS API Bridge.
 * Expected response: Array of objects with at least:
 *   { UHID, PatientName, WardType, RoomNo, BedNo, RelativeName, MobileNumber }
 *
 * ⚠️  Adjust field names below to match your actual HIS schema.
 */
const fetchHISInpatients = async () => {
    // Use native fetch (Node 18+) or require('node-fetch') for older versions
    const response = await fetch(HIS_API_URL);
    if (!response.ok) {
        throw new Error(`HIS API returned ${response.status}: ${response.statusText}`);
    }
    return await response.json();
};

/**
 * Map a raw HIS record to our internal format.
 * ⚠️  UPDATE THESE FIELD NAMES to match your HIS API output.
 */
const mapHISRecord = (record) => ({
    uhid: record.UHID,
    full_name: record.PatientName,
    ward_type: record.WardType || 'GENERAL',
    ward_category: record.WardCategory || 'WARD',
    room_number: record.RoomNo || '—',
    bed_number: record.BedNo || '—',
    relative_name: record.RelativeName || 'Relative',
    mobile_number: record.MobileNumber,
});

/**
 * Auto-Admit a single patient into the VMS.
 * Mirrors the logic in adminController.admitPatient.
 */
const autoAdmitPatient = async (data) => {
    const result = await sequelize.transaction(async (t) => {
        // Find or Create Patient
        const [patient] = await Patient.findOrCreate({
            where: { uhid: data.uhid },
            defaults: { full_name: data.full_name, gender: 'Other' },
            transaction: t
        });

        // Create Admission
        const admission = await Admission.create({
            patient_id: patient.id,
            room_number: data.room_number,
            bed_number: data.bed_number,
            ward_type: data.ward_type,
            ward_category: data.ward_category || 'WARD',
            max_visitors: 1,
            visit_duration_hours: 1,
            status: 'ACTIVE',
            admitted_at: new Date()
        }, { transaction: t });

        // Create/Update Relative
        const [relative] = await Relative.findOrCreate({
            where: { patient_id: patient.id, is_primary: true },
            defaults: {
                name: data.relative_name,
                mobile_number: data.mobile_number,
                relationship: 'Primary'
            },
            transaction: t
        });

        relative.name = data.relative_name;
        relative.mobile_number = data.mobile_number;
        await relative.save({ transaction: t });

        // Create AdmissionVisitor authorization
        const cleanedMobile = data.mobile_number.replace(/\D/g, '');
        await AdmissionVisitor.create({
            admission_id: admission.id,
            mobile_number: cleanedMobile,
            relationship: 'Primary'
        }, { transaction: t });

        return { patient, admission, relative };
    });

    // Trigger WhatsApp (non-blocking)
    const cleanedMobile = data.mobile_number.replace(/\D/g, '');
    sendRegistrationLink(cleanedMobile, data.full_name, data.uhid, data.ward_type, data.bed_number, data.ward_category)
        .catch(err => console.error(`[HIS Sync] WhatsApp failed for ${data.uhid}:`, err.message));

    console.log(`[HIS Sync] ✅ Auto-Admitted: ${data.full_name} (${data.uhid})`);
    return result;
};

/**
 * Auto-Discharge patients who are no longer in the HIS list.
 * Revokes all ACTIVE/VISITING visitor slips for discharged patients.
 */
const autoDischargePatients = async (activeUHIDs) => {
    // Find all patients in our VMS with active admissions
    const activeAdmissions = await Admission.findAll({
        where: { status: 'ACTIVE' },
        include: [{ model: Patient, attributes: ['uhid', 'full_name'] }]
    });

    let dischargedCount = 0;

    for (const admission of activeAdmissions) {
        if (!activeUHIDs.has(admission.Patient.uhid)) {
            // Patient is no longer in HIS → Discharge them
            await sequelize.transaction(async (t) => {
                // Mark admission as discharged
                admission.status = 'DISCHARGED';
                await admission.save({ transaction: t });

                // Revoke all active visitor slips for this admission
                await VisitorSlip.update(
                    { status: 'EXPIRED', expiryReason: 'REVOKED' },
                    {
                        where: {
                            admission_id: admission.id,
                            status: { [Op.in]: ['ACTIVE', 'VISITING'] }
                        },
                        transaction: t
                    }
                );
            });

            console.log(`[HIS Sync] 🔴 Auto-Discharged: ${admission.Patient.full_name} (${admission.Patient.uhid})`);
            dischargedCount++;
        }
    }

    return dischargedCount;
};

/**
 * Main sync loop.
 */
const runSync = async () => {
    try {
        // 1. Fetch current inpatients from HIS
        const hisRecords = await fetchHISInpatients();
        const hisData = hisRecords.map(mapHISRecord);

        // Build a set of active UHIDs for fast lookup
        const activeUHIDs = new Set(hisData.map(d => d.uhid));

        // 2. Auto-Admit new patients
        let admittedCount = 0;
        for (const data of hisData) {
            if (!data.uhid || !data.mobile_number) continue;

            // Check if this UHID already has an active admission in our VMS
            const existingAdmission = await Admission.findOne({
                where: { status: 'ACTIVE' },
                include: [{
                    model: Patient,
                    where: { uhid: data.uhid }
                }]
            });

            if (!existingAdmission) {
                await autoAdmitPatient(data);
                admittedCount++;
            }
        }

        // 3. Auto-Discharge patients no longer in HIS
        const dischargedCount = await autoDischargePatients(activeUHIDs);

        if (admittedCount > 0 || dischargedCount > 0) {
            console.log(`[HIS Sync] Cycle complete — Admitted: ${admittedCount}, Discharged: ${dischargedCount}`);
        }
    } catch (error) {
        console.error(`[HIS Sync] ❌ Sync Error: ${error.message}`);
    }
};

/**
 * Start the HIS sync job.
 */
const startHISSyncJob = () => {
    if (!process.env.HIS_SYNC_ENABLED || process.env.HIS_SYNC_ENABLED !== 'true') {
        console.log('[HIS Sync] Disabled. Set HIS_SYNC_ENABLED=true and HIS_API_URL to activate.');
        return;
    }

    if (!HIS_API_URL) {
        console.error('[HIS Sync] ❌ HIS_API_URL is not set. Sync disabled.');
        return;
    }

    console.log(`[HIS Sync] ✅ Starting — Polling ${HIS_API_URL} every ${SYNC_INTERVAL / 1000}s`);

    // Run immediately on startup, then every interval
    runSync();
    setInterval(runSync, SYNC_INTERVAL);
};

module.exports = startHISSyncJob;
