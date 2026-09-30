// Controlador del modulo Postulaciones.
// Cubre HU-RF-007 (tablero de trazabilidad) y HU-RF-009 (postular).
//
// Nota de alcance: ninguna historia de usuario que nos pasaron describe
// QUIEN mueve una postulacion de una columna a otra (ej. de "postulado"
// a "entrevista"). En un sistema real eso lo haria un reclutador desde
// el ATS de Magneto. Para que el tablero de trazabilidad tenga algo que
// mostrar en la sustentacion, se agrega aqui un endpoint de
// administrador para avanzar el estado manualmente. Si el equipo recibe
// una historia de usuario formal para esto mas adelante, esta funcion
// ya queda lista para conectarse.

const { pool } = require('../config/db');

const ESTADOS_VALIDOS = ['postulado', 'en_revision', 'entrevista', 'aceptado', 'descartado'];

// --------------------------------------------------------------
// POST /api/postulaciones   (candidato) — HU-RF-009
// --------------------------------------------------------------
async function postular(req, res) {
  const conexion = await pool.getConnection();
  try {
    const usuarioId = req.usuario.id;
    const { vacante_id } = req.body;

    if (!vacante_id) {
      return res.status(400).json({ ok: false, mensaje: 'Falta indicar la vacante.' });
    }

    const [vacantes] = await conexion.query('SELECT id, estado FROM vacantes WHERE id = ?', [vacante_id]);
    if (vacantes.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'La vacante no existe.' });
    }
    if (vacantes[0].estado !== 'activa') {
      return res.status(400).json({ ok: false, mensaje: 'Esta vacante ya no está disponible.' });
    }

    await conexion.beginTransaction();

    try {
      const [resultado] = await conexion.query(
        'INSERT INTO postulaciones (usuario_id, vacante_id, estado) VALUES (?, ?, ?)',
        [usuarioId, vacante_id, 'postulado']
      );

      await conexion.query(
        'INSERT INTO postulacion_historial (postulacion_id, estado, motivo) VALUES (?, ?, ?)',
        [resultado.insertId, 'postulado', 'Postulación registrada por el candidato.']
      );

      await conexion.commit();
      return res.status(201).json({ ok: true, mensaje: 'Postulación registrada exitosamente' });

    } catch (errorInterno) {
      await conexion.rollback();
      // Codigo de error de mysql2 cuando se viola una restriccion UNIQUE
      if (errorInterno.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, mensaje: 'Ya has postulado a esta vacante' });
      }
      throw errorInterno;
    }

  } catch (error) {
    console.error('Error en postular():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo registrar tu postulación.' });
  } finally {
    conexion.release();
  }
}

// --------------------------------------------------------------
// GET /api/postulaciones   (candidato) — HU-RF-007, tablero
// --------------------------------------------------------------
async function listarPostulaciones(req, res) {
  try {
    const usuarioId = req.usuario.id;

    const [postulaciones] = await pool.query(
      `SELECT p.id, p.estado, p.creado_en, p.actualizado_en,
              v.id AS vacante_id, v.titulo, v.empresa, v.modalidad
       FROM postulaciones p
       INNER JOIN vacantes v ON v.id = p.vacante_id
       WHERE p.usuario_id = ?
       ORDER BY p.actualizado_en DESC`,
      [usuarioId]
    );

    return res.json({ ok: true, postulaciones });

  } catch (error) {
    console.error('Error en listarPostulaciones():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudieron cargar tus postulaciones.' });
  }
}

// --------------------------------------------------------------
// GET /api/postulaciones/:id   (candidato) — vista lateral de detalle
// --------------------------------------------------------------
async function detallePostulacion(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const { id } = req.params;

    const [postulaciones] = await pool.query(
      `SELECT p.id, p.estado, p.creado_en, v.titulo, v.empresa, v.modalidad, v.descripcion
       FROM postulaciones p
       INNER JOIN vacantes v ON v.id = p.vacante_id
       WHERE p.id = ? AND p.usuario_id = ?`,
      [id, usuarioId]
    );

    if (postulaciones.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Postulación no encontrada.' });
    }

    const [historial] = await pool.query(
      'SELECT estado, motivo, fecha FROM postulacion_historial WHERE postulacion_id = ? ORDER BY fecha ASC',
      [id]
    );

    return res.json({ ok: true, postulacion: postulaciones[0], historial });

  } catch (error) {
    console.error('Error en detallePostulacion():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo cargar el detalle de la postulación.' });
  }
}

// --------------------------------------------------------------
// PATCH /api/postulaciones/:id/estado   (admin) — mover en el tablero
// --------------------------------------------------------------
async function cambiarEstadoPostulacion(req, res) {
  try {
    const { id } = req.params;
    const { estado, motivo } = req.body;

    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ ok: false, mensaje: 'Estado inválido.' });
    }

    const [resultado] = await pool.query('UPDATE postulaciones SET estado = ? WHERE id = ?', [estado, id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Postulación no encontrada.' });
    }

    // Registro inmutable del cambio, con fecha/hora (HU-RNF-002)
    await pool.query(
      'INSERT INTO postulacion_historial (postulacion_id, estado, motivo) VALUES (?, ?, ?)',
      [id, estado, motivo || 'Actualizado por el equipo de selección.']
    );

    return res.json({ ok: true, mensaje: 'Estado de la postulación actualizado.' });

  } catch (error) {
    console.error('Error en cambiarEstadoPostulacion():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo actualizar el estado.' });
  }
}

module.exports = { postular, listarPostulaciones, detallePostulacion, cambiarEstadoPostulacion };
