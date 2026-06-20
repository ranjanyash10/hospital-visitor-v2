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
 * Expected response: Array of objects or object containing an array.
 *
 * Supports auth token and query parameters configured via environment variables.
 */
const fetchHISInpatients = async () => {
    if (!HIS_API_URL) {
        throw new Error('HIS_API_URL environment variable is not set');
    }

    let requestUrl = HIS_API_URL;
    
    // Automatically append default query parameters if none are present in the URL
    if (!requestUrl.includes('?')) {
        const hospitalLocationId = process.env.HIS_HOSPITAL_LOCATION_ID || '1';
        const facilityId = process.env.HIS_FACILITY_ID || '2';
        requestUrl = `${requestUrl}?HospitalLocationId=${hospitalLocationId}&FacilityId=${facilityId}&UHID=0&MobileNo=`;
    }

    const headers = {
        'Content-Type': 'application/json'
    };

    // Attach Authorization Key if configured
    if (process.env.HIS_AUTH_KEY) {
        const authHeaderName = process.env.HIS_AUTH_HEADER || 'Authorization';
        const authPrefix = process.env.HIS_AUTH_PREFIX !== undefined ? process.env.HIS_AUTH_PREFIX : 'Bearer ';
        headers[authHeaderName] = `${authPrefix}${process.env.HIS_AUTH_KEY}`;
    }

    console.log(`[HIS Sync] Fetching inpatients from: ${requestUrl}`);

    const response = await fetch(requestUrl, {
        method: 'GET',
        headers
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`HIS API returned ${response.status}: ${response.statusText} | Response: ${errText}`);
    }

    const rawResponse = await response.json();

    // Dynamically extract the array of patient records
    if (Array.isArray(rawResponse)) {
        return rawResponse;
    } else if (rawResponse && Array.isArray(rawResponse.response)) {
        return rawResponse.response;
    } else if (rawResponse && Array.isArray(rawResponse.data)) {
        return rawResponse.data;
    } else if (rawResponse && Array.isArray(rawResponse.patients)) {
        return rawResponse.patients;
    } else if (rawResponse && typeof rawResponse === 'object') {
        const arrayKey = Object.keys(rawResponse).find(k => Array.isArray(rawResponse[k]));
        if (arrayKey) {
            return rawResponse[arrayKey];
        }
    }

    throw new Error('Invalid HIS API response format: expected an array or an object containing an array.');
};

/**
 * Parse gender description from HIS (e.g. "77 Y/F" or "83 Y/M") into standard VMS formats ("MALE", "FEMALE", "Other")
 */
const parseGender = (genderStr) => {
    if (!genderStr) return 'Other';
    const clean = genderStr.toUpperCase();
    if (clean.includes('/F') || clean.endsWith('F') || clean.includes('FEMALE')) {
        return 'FEMALE';
    }
    if (clean.includes('/M') || clean.endsWith('M') || clean.includes('MALE')) {
        return 'MALE';
    }
    return 'Other';
};

/**
 * Helper to determine official ward category from HIS ward name, bed number, and billing category.
 */
const determineWardCategory = (wardStr, bedStr, billingStr) => {
    const ward = (wardStr || '').toUpperCase();
    const bed = (bedStr || '').toUpperCase();
    const billing = (billingStr || '').toUpperCase();

    if (ward.includes('NEURO-ICU') || ward.includes('NEURO ICU')) {
        return 'NEURO_ICU';
    }
    if (ward.includes('SICU') || ward.includes('SURGICAL ICU')) {
        return 'SURGICAL_ICU';
    }
    if (ward.includes('NEPHRO ICU') || ward.includes('NEPHRO-ICU')) {
        return 'NEPHRO_ICU';
    }
    if (ward.includes('NICU') || ward.includes('NURSERY')) {
        return 'NICU';
    }
    if (ward.includes('PICU') || ward.includes('PEAD ICU')) {
        return 'NICU'; // Map PICU/PEAD to NICU timings for child care units
    }
    if (ward.includes('MICU') || ward.includes('MEDICAL ICU')) {
        const match = bed.match(/\d+/);
        if (match) {
            const bedNum = parseInt(match[0], 10);
            if (bedNum >= 12 && bedNum <= 23) {
                return 'MEDICAL_ICU_12_23';
            }
        }
        return 'MEDICAL_ICU_1_11';
    }
    if (ward.includes('HC') || ward.includes('CATH R/R') || ward.includes('CATH RR') || ward.includes('CCU')) {
        return 'HEART_COMMAND';
    }
    if (ward.includes('ICU-II') || ward.includes('ICU-2') || ward.includes('ICU II')) {
        return 'ICU_2';
    }
    if (ward.includes('ICU-III') || ward.includes('ICU-3') || ward.includes('ICU III') || ward.includes('SW-ICU')) {
        return 'ICU_3';
    }

    // Check if Private Suite based on bed prefix or billing category
    if (
        bed.startsWith('PVT') || 
        bed.startsWith('DLX') || 
        bed.startsWith('DLS') || 
        billing.includes('PRIVATE') || 
        billing.includes('DELUXE') || 
        billing.includes('SUITE')
    ) {
        return 'PRIVATE';
    }

    return 'GENERAL';
};

/**
 * Map a raw HIS record to our internal format.
 * Supports various naming casings (snake_case, camelCase, PascalCase) and Sri Balaji HIS specific fields.
 */
const mapHISRecord = (record) => {
    const gender = parseGender(record.PatientGender || record.gender || record.Gender);
    return {
        uhid: String(record.RegistrationNo || record.UHID || record.uhid || record.patientId || record.PatientId || ''),
        full_name: (record.PatientName || record.patientName || record.fullName || record.FullName || record.name || record.Name || '').trim(),
        gender,
        ward_type: record.Ward || record.WardType || record.wardType || record.ward_type || 'GENERAL',
        ward_category: determineWardCategory(record.Ward, record.BedNo, record.BillingCategory),
        room_number: record.RoomNo || record.roomNo || record.roomNumber || record.RoomNumber || '—',
        bed_number: record.BedNo || record.bedNo || record.bedNumber || record.BedNumber || '—',
        relative_name: record.GuardianName || record.RelativeName || record.relativeName || record.relative_name || 'Relative',
        mobile_number: record.MobileNo || record.MobileNumber || record.mobileNumber || record.mobile_number || record.mobileNo || '',
    };
};

/**
 * Auto-Admit a single patient into the VMS.
 * Mirrors the logic in adminController.admitPatient.
 */
const autoAdmitPatient = async (data) => {
    const result = await sequelize.transaction(async (t) => {
        // Find or Create Patient
        const [patient] = await Patient.findOrCreate({
            where: { uhid: data.uhid },
            defaults: { full_name: data.full_name, gender: data.gender || 'Other' },
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

    // Trigger WhatsApp (non-blocking) - skip if disabled by env to protect quota
    if (process.env.DISABLE_SYNC_WHATSAPP === 'true') {
        console.log(`[HIS Sync] WhatsApp notification skipped for ${data.uhid} (DISABLE_SYNC_WHATSAPP is true)`);
    } else {
        const cleanedMobile = data.mobile_number.replace(/\D/g, '');
        sendRegistrationLink(cleanedMobile, data.full_name, data.uhid, data.ward_type, data.bed_number, data.ward_category)
            .catch(err => console.error(`[HIS Sync] WhatsApp failed for ${data.uhid}:`, err.message));
    }

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
