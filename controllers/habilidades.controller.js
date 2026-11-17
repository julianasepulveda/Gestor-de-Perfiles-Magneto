// Controlador del catalogo de habilidades.
// Expone la lista maestra para alimentar el datalist del formulario de perfil.

const { pool } = require('../config/db');

/**
 * Devuelve el catálogo completo de habilidades ordenado alfabéticamente.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function listarHabilidades(req, res) {
  try {
    const [habilidades] = await pool.query('SELECT id, nombre FROM habilidades ORDER BY nombre ASC');
    return res.json({ ok: true, habilidades });
  } catch (error) {
    console.error('Error en listarHabilidades():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo cargar el catálogo de habilidades.' });
  }
}

module.exports = { listarHabilidades };
