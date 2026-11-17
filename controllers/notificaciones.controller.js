// Controlador del Centro de Notificaciones Inteligentes.
// Las notificaciones se CREAN vía el Patrón Observer (ver
// services/notificaciones.observer.js, AlertaCandidatoObserver). Aquí solo
// se LEEN y se marcan como leídas para el candidato autenticado.

const { pool } = require('../config/db');

/**
 * Lista las notificaciones del candidato autenticado (máximo 30, más recientes
 * primero) junto al conteo de no leídas para el badge de la campana.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function listarNotificaciones(req, res) {
  try {
    const usuarioId = req.usuario.id;

    const [notificaciones] = await pool.query(
      `SELECT id, titulo, mensaje, enlace, leida, fecha_creacion
       FROM notificaciones
       WHERE usuario_id = ?
       ORDER BY fecha_creacion DESC
       LIMIT 30`,
      [usuarioId]
    );

    const [conteo] = await pool.query(
      'SELECT COUNT(*) AS no_leidas FROM notificaciones WHERE usuario_id = ? AND leida = 0',
      [usuarioId]
    );

    return res.json({
      ok: true,
      notificaciones: notificaciones.map(n => ({ ...n, leida: !!n.leida })),
      no_leidas: conteo[0].no_leidas
    });

  } catch (error) {
    console.error('Error en listarNotificaciones():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudieron cargar las notificaciones.' });
  }
}

/**
 * Marca como leídas todas las notificaciones no leídas del candidato autenticado.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function marcarTodasLeidas(req, res) {
  try {
    const usuarioId = req.usuario.id;

    const [resultado] = await pool.query(
      'UPDATE notificaciones SET leida = 1 WHERE usuario_id = ? AND leida = 0',
      [usuarioId]
    );

    return res.json({ ok: true, mensaje: 'Notificaciones marcadas como leídas.', marcadas: resultado.affectedRows });

  } catch (error) {
    console.error('Error en marcarTodasLeidas():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudieron actualizar las notificaciones.' });
  }
}

module.exports = { listarNotificaciones, marcarTodasLeidas };
