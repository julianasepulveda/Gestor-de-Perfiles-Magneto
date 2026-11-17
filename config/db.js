// Configuracion de la conexion a MySQL mediante un pool reutilizable.
// El pool se instancia una sola vez y se comparte en toda la aplicacion
// (patron Singleton: los modulos de Node se cachean, por lo que todos los
// 'require' de este archivo reciben la misma instancia).

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
  connectTimeout: 10000
});

/**
 * Verifica la conectividad con MySQL al arrancar el servidor.
 * Obtiene y libera una conexion del pool; registra el resultado en consola.
 * @returns {Promise<void>}
 */
async function verificarConexion() {
  try {
    const conexion = await pool.getConnection();
    console.log('Conexion a MySQL exitosa (base de datos: %s)', process.env.DB_NAME || 'perfil360');
    conexion.release();
  } catch (error) {
    console.error('No se pudo conectar a MySQL. Revisa el archivo .env');
    console.error('Detalle del error:', error.message);
  }
}

module.exports = { pool, verificarConexion };
