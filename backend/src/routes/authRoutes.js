// authRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/authController');

const { validate, schemas } = require('../middleware/validationMiddleware');

router.post('/login', validate(schemas.login), controller.login);
router.get('/whatsapp-qr', controller.getWhatsAppQr);
router.post('/whatsapp-logout', controller.logoutWhatsApp);

module.exports = router;
