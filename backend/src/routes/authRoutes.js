// authRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/authController');

const { validate, schemas } = require('../middleware/validationMiddleware');

router.post('/login', validate(schemas.login), controller.login);

module.exports = router;
