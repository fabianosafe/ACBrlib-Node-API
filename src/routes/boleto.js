// src/routes/boleto.js
const express = require('express');
const router = express.Router();
const { generateBoleto } = require('../controllers/boletoController');

router.post('/boleto', generateBoleto);

module.exports = router;