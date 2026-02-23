const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface) => {
        const tableExists = async (name) => {
            const tables = await queryInterface.showAllTables();
            return tables.includes(name);
        };

        // 1. Users
        if (!(await tableExists('users'))) {
            await queryInterface.createTable('users', {
                id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
                username: { type: DataTypes.STRING(50), unique: true, allowNull: false },
                password_hash: { type: DataTypes.STRING(255), allowNull: false },
                role: { type: DataTypes.ENUM('ADMIN', 'GUARD'), allowNull: false },
                createdAt: { type: DataTypes.DATE, allowNull: false }
            });
        }

        // 2. Patients
        if (!(await tableExists('patients'))) {
            await queryInterface.createTable('patients', {
                id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
                full_name: { type: DataTypes.STRING(100), allowNull: false },
                uhid: { type: DataTypes.STRING(50), unique: true, allowNull: false },
                gender: { type: DataTypes.STRING(10) },
                createdAt: { type: DataTypes.DATE, allowNull: false }
            });
        }

        // 3. Admissions
        if (!(await tableExists('admissions'))) {
            await queryInterface.createTable('admissions', {
                id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
                ward_type: { type: DataTypes.ENUM('GENERAL', 'PRIVATE'), allowNull: false },
                room_number: { type: DataTypes.STRING(20), allowNull: false },
                bed_number: { type: DataTypes.STRING(20), allowNull: false },
                status: { type: DataTypes.ENUM('ACTIVE', 'DISCHARGED'), defaultValue: 'ACTIVE' },
                admitted_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
                patient_id: {
                    type: DataTypes.UUID,
                    references: { model: 'patients', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                }
            });
        }

        // 4. Relatives
        if (!(await tableExists('relatives'))) {
            await queryInterface.createTable('relatives', {
                id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
                name: { type: DataTypes.STRING(100), allowNull: false },
                mobile_number: { type: DataTypes.STRING(15), allowNull: false },
                relationship: { type: DataTypes.STRING(50) },
                is_primary: { type: DataTypes.BOOLEAN, defaultValue: false },
                patient_id: {
                    type: DataTypes.UUID,
                    references: { model: 'patients', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                createdAt: { type: DataTypes.DATE, allowNull: false }
            });
        }

        // 5. OTP Logs
        if (!(await tableExists('otp_logs'))) {
            await queryInterface.createTable('otp_logs', {
                id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
                mobile_number: { type: DataTypes.STRING(15), allowNull: false },
                otp_hash: { type: DataTypes.STRING(255), allowNull: false },
                expires_at: { type: DataTypes.DATE, allowNull: false },
                is_used: { type: DataTypes.BOOLEAN, defaultValue: false },
                attempt_count: { type: DataTypes.INTEGER, defaultValue: 0 },
                createdAt: { type: DataTypes.DATE, allowNull: false }
            });
        }

        // 6. Visitor Slips
        if (!(await tableExists('visitor_slips'))) {
            await queryInterface.createTable('visitor_slips', {
                id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
                slip_token: { type: DataTypes.STRING(50), unique: true, allowNull: false },
                ward_type: { type: DataTypes.STRING(20), allowNull: false },
                valid_from: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
                valid_until: { type: DataTypes.DATE, allowNull: false },
                status: { type: DataTypes.ENUM('ACTIVE', 'VISITING', 'EXPIRED', 'USED', 'REVOKED'), defaultValue: 'ACTIVE' },
                qr_code_data: { type: DataTypes.TEXT },
                expiryReason: { type: DataTypes.ENUM('CHECKOUT', 'AUTO_TIMEOUT', 'REVOKED'), allowNull: true },
                patient_id: {
                    type: DataTypes.UUID,
                    references: { model: 'patients', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                relative_id: {
                    type: DataTypes.UUID,
                    references: { model: 'relatives', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                createdAt: { type: DataTypes.DATE, allowNull: false }
            });
        }

        // 7. Slip Verifications
        if (!(await tableExists('slip_verifications'))) {
            await queryInterface.createTable('slip_verifications', {
                id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
                status: { type: DataTypes.ENUM('GRANTED', 'DENIED'), allowNull: false },
                rejection_reason: { type: DataTypes.STRING(255) },
                verified_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
                slip_id: {
                    type: DataTypes.UUID,
                    references: { model: 'visitor_slips', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                verified_by_user_id: {
                    type: DataTypes.UUID,
                    references: { model: 'users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                }
            });
        }

        // 8. Kiosk Sessions
        if (!(await tableExists('kiosk_sessions'))) {
            await queryInterface.createTable('kiosk_sessions', {
                id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
                expires_at: { type: DataTypes.DATE, allowNull: false },
                status: { type: DataTypes.ENUM('PENDING', 'VERIFIED', 'COMPLETED'), defaultValue: 'PENDING' },
                patient_id: {
                    type: DataTypes.UUID,
                    references: { model: 'patients', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                relative_id: {
                    type: DataTypes.UUID,
                    references: { model: 'relatives', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                createdAt: { type: DataTypes.DATE, allowNull: false },
                updatedAt: { type: DataTypes.DATE, allowNull: false }
            });
        }

        // 9. Staff Sessions
        if (!(await tableExists('staff_sessions'))) {
            await queryInterface.createTable('staff_sessions', {
                id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
                expires_at: { type: DataTypes.DATE, allowNull: false },
                last_active: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
                user_id: {
                    type: DataTypes.UUID,
                    references: { model: 'users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                createdAt: { type: DataTypes.DATE, allowNull: false },
                updatedAt: { type: DataTypes.DATE, allowNull: false }
            });
        }

        // 10. Audit Logs
        if (!(await tableExists('audit_logs'))) {
            await queryInterface.createTable('audit_logs', {
                id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
                action: { type: DataTypes.STRING(100), allowNull: false },
                details: { type: DataTypes.TEXT },
                ip_address: { type: DataTypes.STRING(45) },
                user_id: {
                    type: DataTypes.UUID,
                    references: { model: 'users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                createdAt: { type: DataTypes.DATE, allowNull: false }
            });
        }

        // 11. System Settings
        if (!(await tableExists('system_settings'))) {
            await queryInterface.createTable('system_settings', {
                key: { type: DataTypes.STRING(50), primaryKey: true },
                value: { type: DataTypes.STRING(255), allowNull: false },
                description: { type: DataTypes.STRING(255) },
                createdAt: { type: DataTypes.DATE, allowNull: false },
                updatedAt: { type: DataTypes.DATE, allowNull: false }
            });
        }
    },

    down: async (queryInterface) => {
        // Drop in reverse order
        await queryInterface.dropTable('system_settings');
        await queryInterface.dropTable('audit_logs');
        await queryInterface.dropTable('staff_sessions');
        await queryInterface.dropTable('kiosk_sessions');
        await queryInterface.dropTable('slip_verifications');
        await queryInterface.dropTable('visitor_slips');
        await queryInterface.dropTable('otp_logs');
        await queryInterface.dropTable('relatives');
        await queryInterface.dropTable('admissions');
        await queryInterface.dropTable('patients');
        await queryInterface.dropTable('users');
    }
};
