const express = require('express');
const router = express.Router();
const controller = require('../controllers/guardController');
const sessionController = require('../controllers/guardSessionController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/verify-slip', protect, authorize('GUARD', 'ADMIN'), controller.verifySlip);
router.get('/dashboard', protect, authorize('GUARD', 'ADMIN'), controller.getDashboardStats);
router.get('/slips', protect, authorize('GUARD', 'ADMIN'), controller.getSlips);
router.post('/revoke-slip', protect, authorize('GUARD', 'ADMIN'), controller.revokeSlip);
router.post('/accept-slip', protect, authorize('GUARD', 'ADMIN'), controller.acceptSlip);

// Guard Station QR Session
router.post('/start-session', protect, authorize('GUARD', 'ADMIN'), sessionController.startSession);
router.get('/qr-token', protect, authorize('GUARD', 'ADMIN'), sessionController.getQrToken);
router.post('/end-session', protect, authorize('GUARD', 'ADMIN'), sessionController.endSession);

module.exports = router;
