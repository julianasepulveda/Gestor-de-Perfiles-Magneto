// Configuracion de la conexion a MySQL.
// Se usa un "pool" de conexiones: en vez de abrir y cerrar una conexion
// por cada consulta, Node mantiene varias conexiones listas y las reutiliza.

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'perfil360',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000 // 10 segundos maximo para establecer conexion,
  // en vez de quedarse esperando indefinidamente si MySQL tarda en responder
  // (por ejemplo, la primera consulta despues de que el computador estuvo en reposo).
});

// Pequeña funcion para verificar la conexion apenas arranca el servidor.
// Si algo esta mal configurado en el .env, lo vamos a ver inmediatamente
// en la consola en vez de descubrirlo cuando un usuario intente registrarse.
async function verificarConexion() {
  try {
    const conexion = await pool.getConnection();
    console.log('✅ Conexion a MySQL exitosa (base de datos: %s)', process.env.DB_NAME || 'perfil360');
    conexion.release();
  } catch (error) {
    console.error('❌ No se pudo conectar a MySQL. Revisa tu archivo .env');
    console.error('   Detalle del error:', error.message);
  }
}

module.exports = { pool, verificarConexion };
