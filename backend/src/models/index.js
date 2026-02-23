const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 1. User Model
const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('ADMIN', 'GUARD'),
        allowNull: false
    }
}, { tableName: 'users', timestamps: true, updatedAt: false });

// 2. Patient Model
const Patient = sequelize.define('Patient', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    full_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    uhid: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    gender: {
        type: DataTypes.STRING(10)
    }
}, { tableName: 'patients', timestamps: true, updatedAt: false });

// 3. Admission Model
const Admission = sequelize.define('Admission', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    ward_type: {
        type: DataTypes.ENUM('GENERAL', 'PRIVATE'),
        allowNull: false
    },
    room_number: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    bed_number: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('ACTIVE', 'DISCHARGED'),
        defaultValue: 'ACTIVE'
    },
    max_visitors: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false
    },
    visit_duration_hours: {
        type: DataTypes.FLOAT,
        defaultValue: 1,
        allowNull: false
    },
    admitted_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, { tableName: 'admissions', timestamps: false });

// 4. Relative Model
const Relative = sequelize.define('Relative', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    mobile_number: {
        type: DataTypes.STRING(15),
        allowNull: false
    },
    relationship: {
        type: DataTypes.STRING(50)
    },
    is_primary: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, { tableName: 'relatives', timestamps: true, updatedAt: false });

// 5. OTP Log Model
const OtpLog = sequelize.define('OtpLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    mobile_number: {
        type: DataTypes.STRING(15),
        allowNull: false
    },
    otp_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    is_used: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    attempt_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, { tableName: 'otp_logs', timestamps: true, updatedAt: false });

// 6. Visitor Slip Model
const VisitorSlip = sequelize.define('VisitorSlip', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    slip_token: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    ward_type: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    valid_from: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    valid_until: {
        type: DataTypes.DATE,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('ACTIVE', 'VISITING', 'EXPIRED', 'USED', 'REVOKED'),
        defaultValue: 'ACTIVE'
    },
    qr_code_data: {
        type: DataTypes.TEXT
    },
    expiryReason: {
        type: DataTypes.ENUM('CHECKOUT', 'AUTO_TIMEOUT', 'REVOKED'),
        allowNull: true
    },
    mobile_number: {
        type: DataTypes.STRING(15),
        allowNull: true
    },
    visitor_count: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false
    },
    visitor_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    visitor_age: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    visitor_gender: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    id_type: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    id_number: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    scanned_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    }
}, { tableName: 'visitor_slips', timestamps: true, updatedAt: false });


// 7. Slip Verification Model
const SlipVerification = sequelize.define('SlipVerification', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    status: {
        type: DataTypes.ENUM('GRANTED', 'DENIED'),
        allowNull: false
    },
    rejection_reason: {
        type: DataTypes.STRING(255)
    },
    verified_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, { tableName: 'slip_verifications', timestamps: false });

// 8. Kiosk Session (Temporary state for security)
const KioskSession = sequelize.define('KioskSession', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('PENDING', 'VERIFIED', 'COMPLETED'),
        defaultValue: 'PENDING'
    }
}, { tableName: 'kiosk_sessions', timestamps: true });

// 8.1 Admission Visitor Model (Granular Authorization)
const AdmissionVisitor = sequelize.define('AdmissionVisitor', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    mobile_number: {
        type: DataTypes.STRING(15),
        allowNull: false
    },
    relationship: {
        type: DataTypes.STRING(50)
    }
}, { tableName: 'admission_visitors', timestamps: true, updatedAt: false });


// 9. Staff Session (For secure Admin/Guard login)
const StaffSession = sequelize.define('StaffSession', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    last_active: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, { tableName: 'staff_sessions', timestamps: true });

// 10. Guard Session Model (For QR Station Binding)
const GuardSession = sequelize.define('GuardSession', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    guard_station_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        unique: true,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('ACTIVE', 'ENDED'),
        defaultValue: 'ACTIVE'
    },
    started_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    ended_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, { tableName: 'guard_sessions', timestamps: true, updatedAt: false });

// 11. Audit Log Model (For Security Audit)
const AuditLog = sequelize.define('AuditLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    action: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    details: {
        type: DataTypes.TEXT
    },
    ip_address: {
        type: DataTypes.STRING(45)
    }
}, { tableName: 'audit_logs', timestamps: true, updatedAt: false });

// 11. System Setting Model (For Node Settings & Emergency Protocol)
const SystemSetting = sequelize.define('SystemSetting', {
    key: {
        type: DataTypes.STRING(50),
        primaryKey: true
    },
    value: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    description: {
        type: DataTypes.STRING(255)
    }
}, { tableName: 'system_settings', timestamps: true });

// --- Associations ---

// Patient <-> Admission
Patient.hasMany(Admission, { foreignKey: 'patient_id' });
Admission.belongsTo(Patient, { foreignKey: 'patient_id' });

// Admission <-> AdmissionVisitor
Admission.hasMany(AdmissionVisitor, { foreignKey: 'admission_id' });
AdmissionVisitor.belongsTo(Admission, { foreignKey: 'admission_id' });

// Admission <-> VisitorSlip
Admission.hasMany(VisitorSlip, { foreignKey: 'admission_id' });
VisitorSlip.belongsTo(Admission, { foreignKey: 'admission_id' });


// Patient <-> Relative
Patient.hasMany(Relative, { foreignKey: 'patient_id' });
Relative.belongsTo(Patient, { foreignKey: 'patient_id' });

// Patient <-> VisitorSlip
Patient.hasMany(VisitorSlip, { foreignKey: 'patient_id' });
VisitorSlip.belongsTo(Patient, { foreignKey: 'patient_id' });

// Relative <-> VisitorSlip
Relative.hasMany(VisitorSlip, { foreignKey: 'relative_id' });
VisitorSlip.belongsTo(Relative, { foreignKey: 'relative_id' });

// VisitorSlip <-> SlipVerification
VisitorSlip.hasMany(SlipVerification, { foreignKey: 'slip_id' });
SlipVerification.belongsTo(VisitorSlip, { foreignKey: 'slip_id' });

// User (Guard) <-> SlipVerification
User.hasMany(SlipVerification, { foreignKey: 'verified_by_user_id' });
SlipVerification.belongsTo(User, { foreignKey: 'verified_by_user_id' });

// KioskSession <-> Patient
Patient.hasMany(KioskSession, { foreignKey: 'patient_id' });
KioskSession.belongsTo(Patient, { foreignKey: 'patient_id' });

// KioskSession <-> Relative
Relative.hasMany(KioskSession, { foreignKey: 'relative_id' });
KioskSession.belongsTo(Relative, { foreignKey: 'relative_id' });

// StaffSession <-> User
User.hasMany(StaffSession, { foreignKey: 'user_id' });
StaffSession.belongsTo(User, { foreignKey: 'user_id' });

// AuditLog <-> User
User.hasMany(AuditLog, { foreignKey: 'user_id' });
AuditLog.belongsTo(User, { foreignKey: 'user_id' });

// GuardSession <-> User
User.hasMany(GuardSession, { foreignKey: 'user_id' });
GuardSession.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
    sequelize,
    User,
    Patient,
    Admission,
    AdmissionVisitor,
    Relative,
    OtpLog,
    VisitorSlip,
    SlipVerification,
    KioskSession,
    StaffSession,
    GuardSession,
    AuditLog,
    SystemSetting
};
