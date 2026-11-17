// Controlador de autenticacion: registro e inicio de sesion.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Registra un nuevo candidato: valida correo y contraseña, verifica que el
 * correo no exista y persiste el usuario con la contraseña cifrada (bcrypt).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function registrar(req, res) {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({ ok: false, mensaje: 'Correo y contraseña son obligatorios.' });
    }

    if (!REGEX_CORREO.test(correo)) {
      return res.status(400).json({ ok: false, mensaje: 'Ingresa un correo electrónico válido.' });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        ok: false,
        mensaje: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      });
    }

    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE correo = ?', [correo]);

    if (existentes.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'El correo ya se encuentra registrado' });
    }

    // La contraseña nunca se guarda en texto plano: se cifra con bcrypt.
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO usuarios (correo, password_hash, rol) VALUES (?, ?, ?)',
      [correo, passwordHash, 'candidato']
    );

    return res.status(201).json({
      ok: true,
      mensaje: 'Registro exitoso. Ya puedes iniciar sesión.'
    });

  } catch (error) {
    console.error('Error en registrar():', error);
    return res.status(500).json({ ok: false, mensaje: 'Ocurrió un error en el servidor. Intenta más tarde.' });
  }
}

/**
 * Autentica a un usuario: compara la contraseña contra el hash almacenado y,
 * si es válida, emite un token JWT con id, correo y rol para las peticiones
 * posteriores.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function iniciarSesion(req, res) {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({ ok: false, mensaje: 'Correo y contraseña son obligatorios.' });
    }

    const [filas] = await pool.query(
      'SELECT id, correo, password_hash, rol FROM usuarios WHERE correo = ?',
      [correo]
    );

    const MENSAJE_CREDENCIALES_INVALIDAS = 'Credenciales inválidas. Verifica tu correo y contraseña';

    if (filas.length === 0) {
      return res.status(401).json({ ok: false, mensaje: MENSAJE_CREDENCIALES_INVALIDAS });
    }

    const usuario = filas[0];
    const passwordCorrecta = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordCorrecta) {
      return res.status(401).json({ ok: false, mensaje: MENSAJE_CREDENCIALES_INVALIDAS });
    }

    // Token JWT que el frontend guarda y envía en las peticiones protegidas.
    const token = jwt.sign(
      { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
      process.env.JWT_SECRET || 'secreto_temporal',
      { expiresIn: '2h' }
    );

    return res.status(200).json({
      ok: true,
      mensaje: 'Inicio de sesión exitoso.',
      token,
      usuario: { id: usuario.id, correo: usuario.correo, rol: usuario.rol }
    });

  } catch (error) {
    console.error('Error en iniciarSesion():', error);
    return res.status(500).json({ ok: false, mensaje: 'Ocurrió un error en el servidor. Intenta más tarde.' });
  }
}

module.exports = { registrar, iniciarSesion };
