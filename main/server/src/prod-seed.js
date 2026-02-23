const sequelize = require('./config/database');
const { User, Patient, Admission } = require('./models');
const bcrypt = require('bcrypt');

const seedProduction = async () => {
    try {
        console.log('Starting Production Seed...');

        // 1. Check if admin exists
        const adminExists = await User.findOne({ where: { username: 'admin' } });
        if (!adminExists) {
            console.log('Creating default admin...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                username: 'admin',
                password_hash: hashedPassword,
                role: 'ADMIN'
            });
        } else {
            console.log('Admin already exists, skipping user seed.');
        }

        // 2. Check if we have any patients
        const patientCount = await Patient.count();
        if (patientCount === 0) {
            console.log('No patients found, adding initial data...');

            const p1 = await Patient.create({
                full_name: 'Test Patient',
                uhid: 'UHID-9999',
                gender: 'Male'
            });

            await Admission.create({
                patient_id: p1.id,
                room_number: '101',
                bed_number: 'A',
                ward_type: 'PRIVATE',
                max_visitors: 1,
                visit_duration_hours: 1,
                admitted_at: new Date()
            });
            console.log('Initial patient and admission created.');
        } else {
            console.log(`Found ${patientCount} patients, skipping patient seed.`);
        }

        console.log('Production Seed Complete!');
        process.exit(0);
    } catch (error) {
        console.error('Seed Failed:', error);
        process.exit(1);
    }
};

seedProduction();
