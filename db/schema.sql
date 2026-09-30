-- ============================================================
-- Perfil 360 - Magneto
-- Script de creacion de base de datos
-- Ejecutar este archivo una sola vez en MySQL (Workbench, DBeaver
-- o consola) antes de correr el servidor de Node.
-- ============================================================

CREATE DATABASE IF NOT EXISTS perfil360
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE perfil360;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  correo VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('candidato', 'admin') NOT NULL DEFAULT 'candidato',
  perfil_completado TINYINT(1) NOT NULL DEFAULT 0,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indice adicional por correo para acelerar la validacion de duplicados
-- (ya viene implicito por el UNIQUE, se deja explicito por claridad academica)
CREATE INDEX idx_usuarios_correo ON usuarios (correo);


-- ============================================================
-- MODULO PERFIL (HU-RF-002, HU-RF-003)
-- ============================================================

-- Datos generales del perfil profesional (1 a 1 con usuarios)
CREATE TABLE IF NOT EXISTS perfiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL UNIQUE,
  nivel_educativo ENUM('bachiller','tecnico','tecnologo','pregrado','posgrado','maestria','doctorado') NULL,
  resumen VARCHAR(500) NULL,
  modalidad_preferida ENUM('remoto','presencial','hibrido') NULL,
  salario_esperado_min INT NULL,
  salario_esperado_max INT NULL,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_perfiles_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Experiencia laboral (1 a muchos: un perfil puede tener varias experiencias)
CREATE TABLE IF NOT EXISTS experiencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  perfil_id INT NOT NULL,
  cargo VARCHAR(120) NOT NULL,
  empresa VARCHAR(120) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NULL, -- NULL = trabajo actual
  descripcion VARCHAR(500) NULL,
  CONSTRAINT fk_experiencias_perfil FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE
);

-- Formacion academica (1 a muchos)
CREATE TABLE IF NOT EXISTS educaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  perfil_id INT NOT NULL,
  nivel ENUM('bachiller','tecnico','tecnologo','pregrado','posgrado','maestria','doctorado') NOT NULL,
  institucion VARCHAR(150) NOT NULL,
  titulo_obtenido VARCHAR(150) NOT NULL,
  fecha_graduacion DATE NULL, -- NULL = en curso
  CONSTRAINT fk_educaciones_perfil FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE
);

-- Catalogo maestro de habilidades (se comparte entre candidatos y vacantes)
CREATE TABLE IF NOT EXISTS habilidades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE
);

-- Relacion muchos-a-muchos: que habilidades tiene cada perfil
CREATE TABLE IF NOT EXISTS perfil_habilidades (
  perfil_id INT NOT NULL,
  habilidad_id INT NOT NULL,
  PRIMARY KEY (perfil_id, habilidad_id),
  CONSTRAINT fk_ph_perfil FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ph_habilidad FOREIGN KEY (habilidad_id) REFERENCES habilidades(id) ON DELETE CASCADE
);


-- ============================================================
-- MODULO VACANTES (HU-RF-004, HU-RF-005, HU-RF-006, HU-RF-008)
-- ============================================================

CREATE TABLE IF NOT EXISTS vacantes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(150) NOT NULL,
  empresa VARCHAR(120) NOT NULL DEFAULT 'Magneto',
  modalidad ENUM('remoto','presencial','hibrido') NOT NULL,
  salario_min INT NOT NULL,
  salario_max INT NOT NULL,
  nivel_educativo_requerido ENUM('bachiller','tecnico','tecnologo','pregrado','posgrado','maestria','doctorado') NOT NULL,
  descripcion VARCHAR(600) NOT NULL,
  estado ENUM('activa','inactiva') NOT NULL DEFAULT 'activa',
  publicada_por INT NULL, -- id del administrador que la registro
  fuente VARCHAR(50) NOT NULL DEFAULT 'Magneto',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vacantes_admin FOREIGN KEY (publicada_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Habilidades que exige cada vacante (muchos a muchos)
CREATE TABLE IF NOT EXISTS vacante_habilidades (
  vacante_id INT NOT NULL,
  habilidad_id INT NOT NULL,
  PRIMARY KEY (vacante_id, habilidad_id),
  CONSTRAINT fk_vh_vacante FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE CASCADE,
  CONSTRAINT fk_vh_habilidad FOREIGN KEY (habilidad_id) REFERENCES habilidades(id) ON DELETE CASCADE
);


-- ============================================================
-- MODULO POSTULACIONES (HU-RF-007, HU-RF-009, HU-RNF-002)
-- ============================================================

CREATE TABLE IF NOT EXISTS postulaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  vacante_id INT NOT NULL,
  estado ENUM('postulado','en_revision','entrevista','aceptado','descartado') NOT NULL DEFAULT 'postulado',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuario_vacante (usuario_id, vacante_id), -- evita postular 2 veces a la misma vacante
  CONSTRAINT fk_postulaciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_postulaciones_vacante FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE CASCADE
);

-- Historial inmutable de cada cambio de estado (trazabilidad + HU-RNF-002)
CREATE TABLE IF NOT EXISTS postulacion_historial (
  id INT AUTO_INCREMENT PRIMARY KEY,
  postulacion_id INT NOT NULL,
  estado ENUM('postulado','en_revision','entrevista','aceptado','descartado') NOT NULL,
  motivo VARCHAR(300) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ph_postulacion FOREIGN KEY (postulacion_id) REFERENCES postulaciones(id) ON DELETE CASCADE
);
