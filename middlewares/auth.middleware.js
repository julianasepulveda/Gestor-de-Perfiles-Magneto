// Middleware de autenticacion y autorizacion basado en JWT.
// Bloquea los accesos no autorizados a rutas protegidas (HU-RNF-002).

const jwt = require('jsonwebtoken');

/**
 * Verifica el token JWT del header Authorization (Bearer). Si es válido,
 * expone el payload en req.usuario y continúa; si no, responde 401.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization; // formato esperado: "Bearer <token>"

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado. Inicia sesión nuevamente.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secreto_temporal');
    req.usuario = payload;
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, mensaje: 'Sesión inválida o expirada. Inicia sesión nuevamente.' });
  }
}

/**
 * Restringe el acceso a los roles indicados; responde 403 si el usuario
 * autenticado no tiene uno de ellos.
 * @param {...string} rolesPermitidos
 * @returns {import('express').RequestHandler}
 */
function verificarRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ ok: false, mensaje: 'No tienes permisos para realizar esta acción.' });
    }
    next();
  };
}

module.exports = { verificarToken, verificarRol };
