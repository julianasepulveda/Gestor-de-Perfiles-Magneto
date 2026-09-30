// Punto de entrada de la aplicacion.
// Levanta el servidor Express, sirve el frontend (carpeta /public)
// y expone la API de autenticacion en /api/auth.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { verificarConexion } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const perfilRoutes = require('./routes/perfil.routes');
const vacantesRoutes = require('./routes/vacantes.routes');
const postulacionesRoutes = require('./routes/postulaciones.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json()); // permite leer JSON en req.body

// --- Frontend estatico (HTML/CSS/JS de la carpeta public) ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API ---
app.use('/api/auth', authRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/vacantes', vacantesRoutes);
app.use('/api/postulaciones', postulacionesRoutes);

// Ruta de salud, util para confirmar que el backend esta vivo
app.get('/api/health', (req, res) => {
  res.json({ ok: true, mensaje: 'Perfil 360 API funcionando correctamente' });
});

app.listen(PORT, async () => {
  console.log(`🚀 Servidor Perfil 360 corriendo en http://localhost:${PORT}`);
  await verificarConexion();
});
