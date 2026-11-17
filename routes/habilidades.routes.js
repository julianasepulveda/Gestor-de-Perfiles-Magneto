const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { listarHabilidades } = require('../controllers/habilidades.controller');

// El catalogo de habilidades solo se expone a usuarios autenticados (HU-RNF-002)
router.get('/', verificarToken, listarHabilidades);

module.exports = router;
