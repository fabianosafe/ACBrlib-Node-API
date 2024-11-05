// src/routes/cep.js
const express = require('express');
const router = express.Router();
const { searchCEP } = require('../controllers/cepController');

router.post('/cep', searchCEP);

module.exports = router;