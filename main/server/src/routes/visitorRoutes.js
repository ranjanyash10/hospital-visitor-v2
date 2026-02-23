const express = require('express');
const router = express.Router();
const controller = require('../controllers/visitorController');
const { validate, schemas } = require('../middleware/validationMiddleware');

// No auth required – these are public visitor endpoints
router.post('/validate-qr', controller.validateQR);
router.get('/lookup/:mobile', validate(schemas.searchByMobile, 'params'), controller.lookupPatients);
router.post('/send-otp', controller.sendOtp);
router.post('/verify-otp', controller.verifyAndGenerate);

module.exports = router;
