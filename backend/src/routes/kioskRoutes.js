const express = require('express');
const router = express.Router();
const controller = require('../controllers/kioskController');

const { validate, schemas } = require('../middleware/validationMiddleware');

router.post('/validate-patient', validate(schemas.patientValidation), controller.validatePatient);
router.get('/visitor/:mobile', validate(schemas.searchByMobile, 'params'), controller.getVisitorPatients);
router.post('/send-otp', validate(schemas.sendOtp), controller.sendOtp);
router.post('/verify-otp', validate(schemas.verifyOtp), controller.verifyAndGenerate);

module.exports = router;
