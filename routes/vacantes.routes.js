const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const {
  sincronizarVacantes,
  crearVacante,
  listarVacantesAdmin,
  cambiarEstadoVacante,
  listarRecomendadas,
  obtenerDetalleMatch
} = require('../controllers/vacantes.controller');

// --- Rutas de administrador (HU-RF-004, HU-RF-005, modulo seccion 6) ---
router.post('/sincronizar', verificarToken, verificarRol('admin'), sincronizarVacantes);
router.post('/', verificarToken, verificarRol('admin'), crearVacante);
router.get('/admin', verificarToken, verificarRol('admin'), listarVacantesAdmin);
router.patch('/:id/estado', verificarToken, verificarRol('admin'), cambiarEstadoVacante);

// --- Rutas de candidato (HU-RF-006, HU-RF-008) ---
router.get('/recomendadas', verificarToken, listarRecomendadas);
router.get('/:id/match', verificarToken, obtenerDetalleMatch);

module.exports = router;
