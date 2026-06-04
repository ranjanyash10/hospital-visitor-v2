const express = require('express');
const router = express.Router();
const controller = require('../controllers/visitorController');
const { validate, schemas } = require('../middleware/validationMiddleware');

// No auth required – these are public visitor endpoints
router.post('/validate-qr', controller.validateQR);
router.get('/lookup/:mobile', validate(schemas.searchByMobile, 'params'), controller.lookupPatients);
router.post('/send-otp', controller.sendOtp);        // LEGACY — kept for backward compatibility
router.post('/verify-otp', controller.verifyAndGenerate); // LEGACY — kept for backward compatibility
router.post('/generate-direct', controller.generateDirect); // Primary flow — no OTP

// V2: Pre-registration flow
router.get('/form-info/:uhid', controller.getFormInfo);
router.post('/pre-register', controller.preRegister);

module.exports = router;
