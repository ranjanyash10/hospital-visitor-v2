const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('ADMIN'));

router.get('/dashboard', controller.getDashboardStats);
router.get('/slips', controller.getSlips);
router.post('/revoke', controller.revokeSlip);

// Human Assets
router.get('/guards', controller.getGuards);
router.post('/guards', controller.createGuard);

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
router.patch('/admissions/:id/max-visitors', controller.updateMaxVisitors);

module.exports = router;
