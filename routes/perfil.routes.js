const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { obtenerPerfil, guardarPerfil } = require('../controllers/perfil.controller');

// Todas las rutas de perfil requieren estar autenticado (HU-RNF-002)
router.get('/', verificarToken, obtenerPerfil);
router.put('/', verificarToken, guardarPerfil);

module.exports = router;
