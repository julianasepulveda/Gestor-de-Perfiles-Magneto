// Controlador del modulo Perfil.
// Cubre HU-RF-002 (gestionar perfil) y HU-RF-003 (completitud + retroalimentacion).

const { pool } = require('../config/db');
const { notificaciones } = require('../services/notificaciones.observer');

// Completitud del perfil repartida en 4 secciones iguales (25% c/u).
const PESO_SECCION = 25;
const MINIMO_HABILIDADES = 3;

// Obtiene el id de una habilidad por nombre y la crea si no existe.
// ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id) devuelve el id tanto si
// se inserta como si ya existía. Debe recibir la conexión de la transacción:
// LAST_INSERT_ID() es por-conexión, así que usar otra del pool devolvería un
// id ajeno y corrompería la relación.
async function obtenerOCrearHabilidad(conexion, nombre) {
  const nombreLimpio = nombre.trim();
  const [resultado] = await conexion.query(
    'INSERT INTO habilidades (nombre) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
    [nombreLimpio]
  );
  return resultado.insertId;
}

/**
 * Calcula el porcentaje de completitud del perfil y la lista de campos faltantes.
 * @param {{perfil: object|null, experiencias: Array, educaciones: Array, habilidades: Array}} datos
 * @returns {{porcentaje: number, faltantes: string[]}}
 */
function calcularCompletitud({ perfil, experiencias, educaciones, habilidades }) {
  let porcentaje = 0;
  const faltantes = [];

  const datosBasicosCompletos = perfil && perfil.nivel_educativo && perfil.modalidad_preferida && perfil.resumen;
  if (datosBasicosCompletos) {
    porcentaje += PESO_SECCION;
  } else {
    faltantes.push('Completa tus datos básicos (nivel educativo, modalidad preferida y un resumen breve).');
  }

  if (educaciones && educaciones.length > 0) {
    porcentaje += PESO_SECCION;
  } else {
    faltantes.push('Agrega al menos un registro de formación académica.');
  }

  if (experiencias && experiencias.length > 0) {
    porcentaje += PESO_SECCION;
  } else {
    faltantes.push('Agrega al menos una experiencia laboral (o indica que no tienes, si aplica).');
  }

  if (habilidades && habilidades.length >= MINIMO_HABILIDADES) {
    porcentaje += PESO_SECCION;
  } else {
    faltantes.push(`Agrega al menos ${MINIMO_HABILIDADES} habilidades para mejorar tus recomendaciones.`);
  }

  return { porcentaje, faltantes };
}

// Completitud calculada sobre lo ya persistido en BD. Sirve como "antes"
// para detectar el cruce del 80% (Observer). Devuelve 0 si no hay perfil.
async function obtenerCompletitudPersistida(usuarioId) {
  try {
    const [perfiles] = await pool.query('SELECT * FROM perfiles WHERE usuario_id = ?', [usuarioId]);
    const perfil = perfiles[0] || null;
    if (!perfil) return 0;

    const [experiencias] = await pool.query('SELECT id FROM experiencias WHERE perfil_id = ?', [perfil.id]);
    const [educaciones] = await pool.query('SELECT id FROM educaciones WHERE perfil_id = ?', [perfil.id]);
    const [habilidades] = await pool.query('SELECT habilidad_id FROM perfil_habilidades WHERE perfil_id = ?', [perfil.id]);

    return calcularCompletitud({ perfil, experiencias, educaciones, habilidades }).porcentaje;
  } catch (error) {
    console.error('Error en obtenerCompletitudPersistida():', error.message);
    return 0;
  }
}

/**
 * Devuelve el perfil completo del usuario autenticado (datos básicos,
 * experiencias, educaciones y habilidades) con su porcentaje de completitud
 * y los campos faltantes (HU-RF-003).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function obtenerPerfil(req, res) {
  try {
    const usuarioId = req.usuario.id;

    const [perfiles] = await pool.query('SELECT * FROM perfiles WHERE usuario_id = ?', [usuarioId]);
    const perfil = perfiles[0] || null;

    // Sin perfil guardado se devuelve un perfil vacío (no un error) para que
    // el frontend muestre el formulario en blanco con 0% de completitud.
    if (!perfil) {
      const vacio = calcularCompletitud({ perfil: null, experiencias: [], educaciones: [], habilidades: [] });
      return res.json({
        ok: true,
        perfil: null,
        experiencias: [],
        educaciones: [],
        habilidades: [],
        completitud: vacio.porcentaje,
        faltantes: vacio.faltantes
      });
    }

    const [experiencias] = await pool.query(
      'SELECT id, cargo, empresa, fecha_inicio, fecha_fin, descripcion FROM experiencias WHERE perfil_id = ? ORDER BY fecha_inicio DESC',
      [perfil.id]
    );

    const [educaciones] = await pool.query(
      'SELECT id, nivel, institucion, titulo_obtenido, fecha_graduacion FROM educaciones WHERE perfil_id = ? ORDER BY fecha_graduacion DESC',
      [perfil.id]
    );

    const [habilidades] = await pool.query(
      `SELECT h.id, h.nombre FROM habilidades h
       INNER JOIN perfil_habilidades ph ON ph.habilidad_id = h.id
       WHERE ph.perfil_id = ?`,
      [perfil.id]
    );

    const { porcentaje, faltantes } = calcularCompletitud({ perfil, experiencias, educaciones, habilidades });

    return res.json({
      ok: true,
      perfil,
      experiencias,
      educaciones,
      habilidades,
      completitud: porcentaje,
      faltantes
    });

  } catch (error) {
    console.error('Error en obtenerPerfil():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo cargar tu perfil.' });
  }
}

/**
 * Crea o actualiza el perfil completo del usuario autenticado dentro de una
 * transacción SQL. Valida datos obligatorios, rango salarial y fechas (no
 * futuras) en el backend, reemplaza experiencias/educaciones/habilidades y,
 * vía Observer, notifica al cruzar el 80% de completitud por primera vez
 * (HU-RF-002).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function guardarPerfil(req, res) {
  const usuarioId = req.usuario.id;
  const {
    nivel_educativo,
    resumen,
    modalidad_preferida,
    salario_esperado_min,
    salario_esperado_max,
    experiencias = [],
    educaciones = [],
    habilidades = []
  } = req.body;

  // El backend nunca confía solo en la validación del frontend. Se valida
  // antes de pedir conexión al pool para no retenerla ante datos inválidos.
  if (!nivel_educativo || !modalidad_preferida || !resumen) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Por favor completa los campos obligatorios para continuar'
    });
  }

  // Rango salarial: si ambos vienen y el mínimo supera al máximo, se rechaza.
  const salMin = salario_esperado_min === '' || salario_esperado_min == null ? null : Number(salario_esperado_min);
  const salMax = salario_esperado_max === '' || salario_esperado_max == null ? null : Number(salario_esperado_max);
  if (salMin != null && (!Number.isFinite(salMin) || salMin < 0)) {
    return res.status(400).json({ ok: false, mensaje: 'El salario mínimo no es válido.' });
  }
  if (salMax != null && (!Number.isFinite(salMax) || salMax < 0)) {
    return res.status(400).json({ ok: false, mensaje: 'El salario máximo no es válido.' });
  }
  if (salMin != null && salMax != null && salMin > salMax) {
    return res.status(400).json({
      ok: false,
      mensaje: 'El salario mínimo no puede ser mayor que el máximo.'
    });
  }

  // Fechas: ninguna puede ser futura y, en experiencia, el fin no puede ser
  // anterior al inicio.
  const hoyStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const esFutura = (f) => f && String(f).slice(0, 10) > hoyStr;

  for (const exp of (experiencias || [])) {
    if (esFutura(exp.fecha_inicio) || esFutura(exp.fecha_fin)) {
      return res.status(400).json({ ok: false, mensaje: 'Las fechas de experiencia no pueden ser futuras.' });
    }
    if (exp.fecha_inicio && exp.fecha_fin && String(exp.fecha_fin).slice(0, 10) < String(exp.fecha_inicio).slice(0, 10)) {
      return res.status(400).json({ ok: false, mensaje: 'La fecha de fin no puede ser anterior a la de inicio.' });
    }
  }
  for (const edu of (educaciones || [])) {
    if (esFutura(edu.fecha_graduacion)) {
      return res.status(400).json({ ok: false, mensaje: 'La fecha de graduación no puede ser futura.' });
    }
  }

  console.log('[guardarPerfil] Inicio. usuarioId=%s, experiencias=%d, educaciones=%d, habilidades=%d',
    usuarioId, experiencias.length, educaciones.length, habilidades.length);

  // Completitud antes de guardar, para detectar el cruce del 80%.
  const completitudAntes = await obtenerCompletitudPersistida(usuarioId);

  const conexion = await pool.getConnection();
  let transaccionAbierta = false;
  try {
    await conexion.beginTransaction();
    transaccionAbierta = true;

    // 1) Upsert de los datos básicos del perfil
    const [existentes] = await conexion.query('SELECT id FROM perfiles WHERE usuario_id = ?', [usuarioId]);
    let perfilId;

    if (existentes.length > 0) {
      perfilId = existentes[0].id;
      await conexion.query(
        `UPDATE perfiles SET nivel_educativo = ?, resumen = ?, modalidad_preferida = ?,
         salario_esperado_min = ?, salario_esperado_max = ? WHERE id = ?`,
        [nivel_educativo, resumen, modalidad_preferida, salario_esperado_min || null, salario_esperado_max || null, perfilId]
      );
    } else {
      const [resultado] = await conexion.query(
        `INSERT INTO perfiles (usuario_id, nivel_educativo, resumen, modalidad_preferida, salario_esperado_min, salario_esperado_max)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [usuarioId, nivel_educativo, resumen, modalidad_preferida, salario_esperado_min || null, salario_esperado_max || null]
      );
      perfilId = resultado.insertId;
    }

    // 2) Reemplazar experiencias
    await conexion.query('DELETE FROM experiencias WHERE perfil_id = ?', [perfilId]);
    for (const exp of experiencias) {
      if (!exp.cargo || !exp.empresa || !exp.fecha_inicio) continue; // fila incompleta, se ignora
      await conexion.query(
        'INSERT INTO experiencias (perfil_id, cargo, empresa, fecha_inicio, fecha_fin, descripcion) VALUES (?, ?, ?, ?, ?, ?)',
        [perfilId, exp.cargo, exp.empresa, exp.fecha_inicio, exp.fecha_fin || null, exp.descripcion || null]
      );
    }

    // 3) Reemplazar educaciones
    await conexion.query('DELETE FROM educaciones WHERE perfil_id = ?', [perfilId]);
    for (const edu of educaciones) {
      if (!edu.nivel || !edu.institucion || !edu.titulo_obtenido) continue;
      await conexion.query(
        'INSERT INTO educaciones (perfil_id, nivel, institucion, titulo_obtenido, fecha_graduacion) VALUES (?, ?, ?, ?, ?)',
        [perfilId, edu.nivel, edu.institucion, edu.titulo_obtenido, edu.fecha_graduacion || null]
      );
    }

    // 4) Reemplazar habilidades
    await conexion.query('DELETE FROM perfil_habilidades WHERE perfil_id = ?', [perfilId]);
    for (const nombreHabilidad of habilidades) {
      if (!nombreHabilidad || !nombreHabilidad.trim()) continue;
      const habilidadId = await obtenerOCrearHabilidad(conexion, nombreHabilidad);
      await conexion.query(
        'INSERT IGNORE INTO perfil_habilidades (perfil_id, habilidad_id) VALUES (?, ?)',
        [perfilId, habilidadId]
      );
    }

    await conexion.commit();
    transaccionAbierta = false;
    console.log('[guardarPerfil] COMMIT exitoso. perfilId=%s, usuarioId=%s', perfilId, usuarioId);

    // Observer: solo se notifica en el cruce (<80 -> >=80), no si ya estaba
    // por encima, para no repetir la felicitación en cada guardado.
    const completitudDespues = calcularCompletitud({
      perfil: { nivel_educativo, modalidad_preferida, resumen },
      experiencias: (experiencias || []).filter(e => e && e.cargo && e.empresa && e.fecha_inicio),
      educaciones: (educaciones || []).filter(e => e && e.nivel && e.institucion && e.titulo_obtenido),
      habilidades: (habilidades || []).filter(h => h && String(h).trim())
    }).porcentaje;

    if (completitudAntes < 80 && completitudDespues >= 80) {
      notificaciones.notificar({
        tipo: 'perfil_completitud',
        usuarioId,
        titulo: '¡Tu perfil ya supera el 80%!',
        mensaje: 'Excelente avance. Revisa tus vacantes recomendadas: ahora el match es mucho más preciso.',
        enlace: 'vacantes.html'
      });
    }

    return res.status(200).json({ ok: true, mensaje: 'Perfil actualizado correctamente' });

  } catch (error) {
    // Rollback solo si hay transacción abierta, y protegido con su propio
    // try/catch para que un fallo al revertir no enmascare el error original.
    if (transaccionAbierta) {
      try {
        await conexion.rollback();
      } catch (errorRollback) {
        console.error('Error haciendo ROLLBACK en guardarPerfil():', errorRollback);
      }
    }
    console.error('Error en guardarPerfil():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo guardar tu perfil. Intenta de nuevo.' });
  } finally {
    // La conexión siempre se devuelve al pool para evitar fugas que lo agoten.
    conexion.release();
  }
}

module.exports = { obtenerPerfil, guardarPerfil, calcularCompletitud };
