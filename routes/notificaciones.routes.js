const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { listarNotificaciones, marcarTodasLeidas } = require('../controllers/notificaciones.controller');

// Todas requieren sesión (HU-RNF-002).
router.get('/', verificarToken, listarNotificaciones);
router.patch('/leer-todas', verificarToken, marcarTodasLeidas);

module.exports = router;
