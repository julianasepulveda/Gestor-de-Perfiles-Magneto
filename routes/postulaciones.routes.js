const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const {
  postular,
  listarPostulaciones,
  detallePostulacion,
  cambiarEstadoPostulacion
} = require('../controllers/postulaciones.controller');

router.post('/', verificarToken, postular);
router.get('/', verificarToken, listarPostulaciones);
router.get('/:id', verificarToken, detallePostulacion);
router.patch('/:id/estado', verificarToken, verificarRol('admin'), cambiarEstadoPostulacion);

module.exports = router;
