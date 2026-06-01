const express = require('express');
const router = express.Router();
const controller = require('../controllers/walkinController');

router.post('/lookup', controller.lookupPatient);
router.post('/register', controller.registerWalkIn);

module.exports = router;
