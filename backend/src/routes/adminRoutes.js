const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('ADMIN'));

router.get('/dashboard', controller.getDashboardStats);
router.get('/analytics', controller.getAnalytics);
router.get('/slips', controller.getSlips);
router.post('/revoke', controller.revokeSlip);

// Human Assets
router.get('/guards', controller.getGuards);
router.post('/guards', controller.createGuard);
router.patch('/guards/:id', controller.updateGuard);
router.post('/guards/:id/reset-password', controller.resetGuardPassword);

// Account Management (Self)
router.post('/update-password', controller.updateMyPassword);

// Facility Topology
router.get('/topology', controller.getTopology);

// Security Audit
router.get('/audits', controller.getAudits);

// Node Settings
router.get('/settings', controller.getSettings);
router.post('/settings', controller.updateSetting);

// Emergency Protocol
router.post('/emergency/lockdown', controller.toggleLockdown);

// Patient Visitor Management
router.get('/patients', controller.getPatients);
router.post('/patients/admit', controller.admitPatient);
router.post('/patients/resend-all-whatsapp', controller.resendAllWhatsApp);
router.patch('/admissions/:id/max-visitors', controller.updateMaxVisitors);
router.patch('/admissions/:id/contact', controller.updatePatientContact);

module.exports = router;
