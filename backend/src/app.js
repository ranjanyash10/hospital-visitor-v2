const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Validate Environment Variables
const requiredEnv = ['JWT_SECRET'];
requiredEnv.forEach(env => {
    if (!process.env[env]) {
        console.error(`CRITICAL ERROR: Missing environment variable ${env}`);
        process.exit(1);
    }
});

const { sequelize } = require('./models');

// Import Routes
const kioskRoutes = require('./routes/kioskRoutes');
const guardRoutes = require('./routes/guardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const visitorRoutes = require('./routes/visitorRoutes');
const walkinRoutes = require('./routes/walkinRoutes');

const app = express();

const normalizeUrl = (url) => url ? url.replace(/\/$/, '') : null;

const allowedOrigins = [
    normalizeUrl(process.env.CORS_ORIGIN),
    'https://lobster-app-enwcv.ondigitalocean.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
].filter(Boolean);

console.log('[CORS] Allowed Origins:', allowedOrigins);

// Create HTTP server and attach Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    path: '/api/socket.io',
    cors: {
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            const normalizedOrigin = normalizeUrl(origin);
            if (allowedOrigins.includes(normalizedOrigin)) {
                callback(null, true);
            } else {
                console.warn(`[CORS] Blocked socket request from origin: ${origin}`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST', 'PATCH'],
        credentials: true
    }
});

// Make io accessible to controllers via req.app.get('io')
app.set('io', io);

// Trust proxy for DigitalOcean load balancer / rate limiting
app.set('trust proxy', 1);

// Security Middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts, please try again after an hour',
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
// app.use(helmet());
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
}));
// app.use(limiter);
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.get('/debug', (req, res) => res.json({ msg: 'debug' }));
app.use('/api/auth', authRoutes);
app.use('/api/kiosk', kioskRoutes);
app.use('/api/guard', guardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/visitor', visitorRoutes);
app.use('/api/walkin', walkinRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Guard joins their station room
    socket.on('join_guard_station', (guard_station_id) => {
        socket.join(`guard:${guard_station_id}`);
        console.log(`[Socket.io] Guard joined room: guard:${guard_station_id}`);
    });

    socket.on('disconnect', () => {
        console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

// Database Sync and Server Start
const PORT = process.env.PORT || 5000;

const startExpiryJob = require('./jobs/expiryJob');
const startHISSyncJob = require('./services/hisSyncService');

// Helper to seed database safely on startup if empty
const autoSeedIfEmpty = async () => {
    try {
        const { User, Patient, Admission, Relative, AdmissionVisitor } = require('./models');
        const count = await User.count();
        if (count === 0) {
            console.log('[Auto-Seed] No users found in database. Initializing default data...');
            const bcrypt = require('bcrypt');
            const adminHash = await bcrypt.hash('admin123', 10);
            const guardHash = await bcrypt.hash('guard123', 10);

            // 1. Create default users
            const users = await User.bulkCreate([
                { username: 'admin', password_hash: adminHash, role: 'ADMIN' },
                { username: 'guard', password_hash: guardHash, role: 'GUARD' },
            ]);

            // 2. Create default patients
            const patients = await Patient.bulkCreate([
                { full_name: 'Rahul Sharma', uhid: 'UHID-1001', gender: 'MALE' },
                { full_name: 'Priya Verma', uhid: 'UHID-1002', gender: 'FEMALE' },
                { full_name: 'Amit Singh', uhid: 'UHID-1003', gender: 'MALE' }
            ]);

            // 3. Create admissions
            const admissions = await Admission.bulkCreate([
                {
                    patient_id: patients[0].id,
                    ward_type: 'GENERAL',
                    room_number: '101',
                    bed_number: '1',
                    status: 'ACTIVE',
                    max_visitors: 2
                },
                {
                    patient_id: patients[1].id,
                    ward_type: 'PRIVATE',
                    room_number: '202',
                    bed_number: 'A',
                    status: 'ACTIVE',
                    max_visitors: 2
                }
            ]);

            // 4. Admission Visitors (For Kiosk Refactor)
            await AdmissionVisitor.bulkCreate([
                {
                    admission_id: admissions[0].id,
                    mobile_number: '9876543210',
                    relationship: 'Wife'
                },
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

            console.log('[Auto-Seed] Database successfully seeded with default credentials.');
        } else {
            console.log('[Auto-Seed] Database already has data. Skipping seed.');
        }
    } catch (err) {
        console.error('[Auto-Seed] Failed to seed database:', err);
    }
};

// Only start server if this file is run directly (not required as module)
if (require.main === module) {
    sequelize.authenticate()
        .then(async () => {
            console.log('Database connected.');
            
            // Check and auto-seed if database is empty
            await autoSeedIfEmpty();
            
            startExpiryJob();
            startHISSyncJob();
            server.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
                console.log(`Socket.io ready on port ${PORT}`);
            });
        })
        .catch(err => {
            console.error('Unable to connect to the database:', err);
        });
}

module.exports = app;

