/**
 * Visiting Time Schedule Configuration
 * ------------------------------------
 * Based on the hospital's official "VISITING TIMINGS (ICU & OTHER AREA)" chart.
 * Each category has Morning and Evening visiting windows.
 *
 * Times are in 24-hour format: { from: 'HH:MM', to: 'HH:MM' }
 */

const VISITING_SCHEDULE = {
    MEDICAL_ICU_1_11: {
        label: 'Medical ICU Bed No 1 to 11',
        morning: { from: '11:00', to: '11:15' },
        evening: { from: '17:00', to: '17:15' }
    },
    MEDICAL_ICU_12_23: {
        label: 'Medical ICU Bed No 12 to 23',
        morning: { from: '11:15', to: '11:30' },
        evening: { from: '17:15', to: '17:30' }
    },
    NEURO_ICU: {
        label: 'Neuro ICU',
        morning: { from: '10:00', to: '10:30' },
        evening: { from: '16:30', to: '17:00' }
    },
    SURGICAL_ICU: {
        label: 'Surgical ICU',
        morning: { from: '10:00', to: '10:30' },
        evening: { from: '16:30', to: '17:00' }
    },
    ICU_2: {
        label: 'ICU-2',
        morning: { from: '10:30', to: '11:00' },
        evening: { from: '17:00', to: '17:30' }
    },
    HEART_COMMAND: {
        label: 'Heart Command',
        morning: { from: '10:00', to: '10:30' },
        evening: { from: '16:30', to: '16:30' }
    },
    ICU_3: {
        label: 'ICU-3',
        morning: { from: '10:00', to: '10:30' },
        evening: { from: '16:30', to: '17:00' }
    },
    NEPHRO_ICU: {
        label: 'Nephro ICU',
        morning: { from: '10:30', to: '11:00' },
        evening: { from: '16:30', to: '17:00' }
    },
    NICU: {
        label: 'NICU',
        morning: { from: '12:00', to: '13:00' },
        evening: { from: '17:00', to: '19:00' }
    },
    WARD: {
        label: 'Ward / Other Area',
        morning: { from: '11:00', to: '13:00' },
        evening: { from: '17:00', to: '19:00' }
    },
    GENERAL: {
        label: 'General Ward',
        morning: { from: '11:00', to: '13:00' },
        evening: { from: '17:00', to: '19:00' }
    },
    PRIVATE: {
        label: 'Private Suite',
        morning: { from: '09:00', to: '13:00' },
        evening: { from: '16:00', to: '20:00' }
    }
};

/**
 * Category list for dropdowns (ordered for UI display)
 */
const WARD_CATEGORIES = [
    { key: 'MEDICAL_ICU_1_11', label: 'Medical ICU Bed 1–11' },
    { key: 'MEDICAL_ICU_12_23', label: 'Medical ICU Bed 12–23' },
    { key: 'NEURO_ICU', label: 'Neuro ICU' },
    { key: 'SURGICAL_ICU', label: 'Surgical ICU' },
    { key: 'ICU_2', label: 'ICU-2' },
    { key: 'HEART_COMMAND', label: 'Heart Command' },
    { key: 'ICU_3', label: 'ICU-3' },
    { key: 'NEPHRO_ICU', label: 'Nephro ICU' },
    { key: 'NICU', label: 'NICU' },
    { key: 'WARD', label: 'Ward / Other Area' },
    { key: 'GENERAL', label: 'General Ward' },
    { key: 'PRIVATE', label: 'Private Suite' }
];

/**
 * Parse a "HH:MM" string into a Date object for today.
 */
const parseTime = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
};

/**
 * Format time for display: "10:00 AM"
 */
const formatTimeDisplay = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

/**
 * Check if visiting is currently allowed for a given ward category.
 *
 * @param {string} category - The ward category key (e.g. 'NEURO_ICU')
 * @returns {{ allowed: boolean, session: string|null, from: string|null, to: string|null, nextWindow: object|null, categoryLabel: string }}
 */
const getActiveVisitingWindow = (category) => {
    const schedule = VISITING_SCHEDULE[category] || VISITING_SCHEDULE['WARD'];
    const now = new Date();

    // Developer bypass for testing at any time
    if (process.env.BYPASS_VISITING_HOURS === 'true') {
        return {
            allowed: true,
            session: 'Developer Bypass (24/7)',
            from: '12:00 AM',
            to: '11:59 PM',
            nextWindow: null,
            categoryLabel: schedule.label
        };
    }

    const morningFrom = parseTime(schedule.morning.from);
    const morningTo = parseTime(schedule.morning.to);
    const eveningFrom = parseTime(schedule.evening.from);
    const eveningTo = parseTime(schedule.evening.to);

    // Check morning window
    if (now >= morningFrom && now <= morningTo) {
        return {
            allowed: true,
            session: 'Morning',
            from: formatTimeDisplay(schedule.morning.from),
            to: formatTimeDisplay(schedule.morning.to),
            nextWindow: null,
            categoryLabel: schedule.label
        };
    }

    // Check evening window
    if (now >= eveningFrom && now <= eveningTo) {
        return {
            allowed: true,
            session: 'Evening',
            from: formatTimeDisplay(schedule.evening.from),
            to: formatTimeDisplay(schedule.evening.to),
            nextWindow: null,
            categoryLabel: schedule.label
        };
    }

    // Not in any window — calculate next window
    let nextWindow;
    if (now < morningFrom) {
        nextWindow = {
            session: 'Morning',
            from: formatTimeDisplay(schedule.morning.from),
            to: formatTimeDisplay(schedule.morning.to)
        };
    } else if (now < eveningFrom) {
        nextWindow = {
            session: 'Evening',
            from: formatTimeDisplay(schedule.evening.from),
            to: formatTimeDisplay(schedule.evening.to)
        };
    } else {
        // Past evening, next window is tomorrow morning
        nextWindow = {
            session: 'Morning (Tomorrow)',
            from: formatTimeDisplay(schedule.morning.from),
            to: formatTimeDisplay(schedule.morning.to)
        };
    }

    return {
        allowed: false,
        session: null,
        from: null,
        to: null,
        nextWindow,
        categoryLabel: schedule.label
    };
};

module.exports = {
    VISITING_SCHEDULE,
    WARD_CATEGORIES,
    getActiveVisitingWindow,
    formatTimeDisplay,
    parseTime
};
