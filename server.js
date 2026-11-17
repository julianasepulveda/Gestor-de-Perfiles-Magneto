// Punto de entrada de la aplicacion: configura Express, sirve el frontend
// estatico de /public y monta las rutas de la API REST.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { verificarConexion } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const perfilRoutes = require('./routes/perfil.routes');
const habilidadesRoutes = require('./routes/habilidades.routes');
const vacantesRoutes = require('./routes/vacantes.routes');
const postulacionesRoutes = require('./routes/postulaciones.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Frontend estatico (HTML/CSS/JS de la carpeta public)
app.use(express.static(path.join(__dirname, 'public')));

// API REST
app.use('/api/auth', authRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/habilidades', habilidadesRoutes);
app.use('/api/vacantes', vacantesRoutes);
app.use('/api/postulaciones', postulacionesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);

// Endpoint de salud para verificar que el backend responde
app.get('/api/health', (req, res) => {
  res.json({ ok: true, mensaje: 'Perfil 360 API funcionando correctamente' });
});

app.listen(PORT, async () => {
  console.log(`Servidor Perfil 360 corriendo en http://localhost:${PORT}`);
  await verificarConexion();
});
