-- ============================================================
-- Migracion: soporte para "Retirar postulacion" + historial de
-- mentoria IA persistente.
--
-- Ejecutar UNA sola vez sobre una base de datos ya creada (si recreas
-- la base desde schema.sql, NO necesitas esta migracion: schema.sql ya
-- incluye estos cambios).
--
-- Uso:  mysql -u root -p perfil360 < db/migracion-cancelada-y-mentoria.sql
-- ============================================================

USE perfil360;

-- 1) Agregar el estado 'cancelada' al ENUM de postulaciones.
ALTER TABLE postulaciones
  MODIFY COLUMN estado
  ENUM('postulado','en_revision','entrevista','aceptado','descartado','cancelada')
  NOT NULL DEFAULT 'postulado';

-- 2) Agregar 'cancelada' tambien al historial (trazabilidad inmutable).
ALTER TABLE postulacion_historial
  MODIFY COLUMN estado
  ENUM('postulado','en_revision','entrevista','aceptado','descartado','cancelada')
  NOT NULL;

-- 3) Columna JSON para guardar el resultado completo de la mentoria IA
--    (preguntas tecnicas, escenario conductual y consejos) y poder
--    consultarlo despues en modo lectura.
--    Nota: si tu version de MySQL no soporta "ADD COLUMN IF NOT EXISTS",
--    y la columna ya existe, ignora el error de columna duplicada.
ALTER TABLE postulaciones
  ADD COLUMN mentoria_ia JSON NULL AFTER estado;
