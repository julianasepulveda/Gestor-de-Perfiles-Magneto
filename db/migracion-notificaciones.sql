-- ============================================================
-- Migracion: Centro de Notificaciones Inteligentes (Patron Observer)
-- Crea la tabla ligera 'notificaciones'. Idempotente gracias a
-- CREATE TABLE IF NOT EXISTS. Si recreas la base desde schema.sql, NO
-- necesitas esta migracion (schema.sql ya la incluye).
--
-- Uso:  mysql -u root -p perfil360 < db/migracion-notificaciones.sql
-- ============================================================
USE perfil360;

CREATE TABLE IF NOT EXISTS notificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  mensaje VARCHAR(400) NOT NULL,
  enlace VARCHAR(120) NULL,
  leida TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notificaciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
