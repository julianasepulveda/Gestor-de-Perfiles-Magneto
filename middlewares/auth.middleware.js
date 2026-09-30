// Middleware de autenticacion.
// Un "middleware" es una funcion que se ejecuta ANTES de que la peticion
// llegue al controller. Aqui verificamos que el usuario venga con un
// token JWT valido antes de dejarlo pasar a rutas protegidas.
//
// Esto resuelve el criterio de HU-RNF-002: "Los intentos de acceso no
// autorizados deben ser bloqueados y redirigidos al inicio de sesion".

const jwt = require('jsonwebtoken');

// Uso: router.get('/ruta-protegida', verificarToken, miControlador)
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization; // formato esperado: "Bearer eyJhbGciOi..."

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado. Inicia sesión nuevamente.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secreto_temporal');
    req.usuario = payload; // queda disponible en el controller como req.usuario.id, .rol, etc.
    next(); // deja pasar la peticion al siguiente paso (el controller)
  } catch (error) {
    // jwt.verify lanza error si el token es invalido, fue alterado, o ya expiro
    return res.status(401).json({ ok: false, mensaje: 'Sesión inválida o expirada. Inicia sesión nuevamente.' });
  }
}

// Uso: router.post('/solo-admin', verificarToken, verificarRol('admin'), miControlador)
function verificarRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ ok: false, mensaje: 'No tienes permisos para realizar esta acción.' });
    }
    next();
  };
}

module.exports = { verificarToken, verificarRol };
