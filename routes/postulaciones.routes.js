const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const {
  postular,
  listarPostulaciones,
  detallePostulacion,
  cambiarEstadoPostulacion,
  avanzarARevision,
  simularEntrevista,
  completarSimulacion,
  obtenerMentoria,
  cancelarPostulacion
} = require('../controllers/postulaciones.controller');

router.post('/', verificarToken, postular);
router.get('/', verificarToken, listarPostulaciones);
router.get('/:id', verificarToken, detallePostulacion);
router.patch('/:id/estado', verificarToken, verificarRol('admin'), cambiarEstadoPostulacion);

// Mock de avance automático: la empresa mueve 'postulado' -> 'en_revision' (candidato)
router.patch('/:id/avanzar-revision', verificarToken, avanzarARevision);
// Simulador de Entrevista IA inmersivo (candidato)
router.post('/:id/simular', verificarToken, simularEntrevista);
// Filtro de preparación: cierra la mentoría y avanza a 'entrevista' (candidato)
router.patch('/:id/completar-simulacion', verificarToken, completarSimulacion);
// Historial consultable de la mentoría IA en modo lectura (candidato)
router.get('/:id/mentoria', verificarToken, obtenerMentoria);
// Retirar postulación: estado -> 'cancelada' + historial (candidato)
router.patch('/:id/cancelar', verificarToken, cancelarPostulacion);

module.exports = router;
