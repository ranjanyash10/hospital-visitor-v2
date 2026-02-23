const { sequelize, User, Patient, Admission, Relative, AdmissionVisitor } = require('./models');
const bcrypt = require('bcrypt');

const seed = async () => {
    try {
        await sequelize.sync({ force: true }); // Recreate tables
        console.log('Database Synced. Seeding data...');

        // 1. Users
        const adminHash = await bcrypt.hash('admin123', 10);
        const guardHash = await bcrypt.hash('guard123', 10);

        await User.bulkCreate([
            { username: 'admin', password_hash: adminHash, role: 'ADMIN' },
            { username: 'guard', password_hash: guardHash, role: 'GUARD' },
        ]);

        // 2. Patients
        const patients = await Patient.bulkCreate([
            { full_name: 'Rahul Sharma', uhid: 'UHID-1001', gender: 'MALE' },
            { full_name: 'Priya Verma', uhid: 'UHID-1002', gender: 'FEMALE' },
            { full_name: 'Amit Singh', uhid: 'UHID-1003', gender: 'MALE' }
        ]);

        // 3. Admissions
        const admissions = await Admission.bulkCreate([
            {
                patient_id: patients[0].id, // Rahul
                ward_type: 'GENERAL',
                room_number: '101',
                bed_number: '1',
                status: 'ACTIVE'
            },
            {
                patient_id: patients[1].id, // Priya
                ward_type: 'PRIVATE',
                room_number: '202',
                bed_number: 'A',
                status: 'ACTIVE'
            }
        ]);

        // 4. Admission Visitors (For Kiosk Refactor)
        await AdmissionVisitor.bulkCreate([
            // Mobile linked to 1 patient
            {
                admission_id: admissions[0].id,
                mobile_number: '9876543210',
                relationship: 'Wife'
            },
            // Mobile linked to 2 patients
            {
                admission_id: admissions[0].id,
                mobile_number: '9999999999',
                relationship: 'Caregiver'
            },
            {
                admission_id: admissions[1].id,
                mobile_number: '9999999999',
                relationship: 'Relative'
            }
        ]);

        // 5. Relatives (Legacy)
        await Relative.bulkCreate([
            {
                patient_id: patients[0].id,
                name: 'Sita Sharma',
                mobile_number: '9876543210',
                relationship: 'Wife',
                is_primary: true
            },
            {
                patient_id: patients[1].id,
                name: 'Vikram Verma',
                mobile_number: '9988776655',
                relationship: 'Brother',
                is_primary: true
            }
        ]);

        console.log('Seeding Complete! Pres Ctrl+C to exit if it hangs.');
        process.exit(0);

    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seed();
