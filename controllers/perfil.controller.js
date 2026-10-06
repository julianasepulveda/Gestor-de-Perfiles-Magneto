// Controlador del modulo Perfil.
// Cubre HU-RF-002 (gestionar perfil) y HU-RF-003 (completitud + retroalimentacion).

const { pool } = require('../config/db');

// Pesos de cada seccion para calcular el % de completitud del perfil.
// Se reparten en 4 bloques iguales (25% cada uno) porque son las 4
// secciones del formulario guiado del frontend.
const PESO_SECCION = 25;
const MINIMO_HABILIDADES = 3;

// --------------------------------------------------------------
// Helper: obtiene el id de una habilidad por nombre, y la crea en el
// catalogo si todavia no existe. El truco "ON DUPLICATE KEY UPDATE
// id = LAST_INSERT_ID(id)" hace que mysql nos devuelva el id correcto
// tanto si la insertamos de nuevo como si ya existia.
//
// IMPORTANTE: recibe la MISMA conexion de la transaccion. LAST_INSERT_ID()
// es un valor por-conexion en MySQL; si usaramos "pool.query" aqui la
// consulta correria en OTRA conexion del pool y LAST_INSERT_ID() podria
// devolver el id de una operacion ajena, corrompiendo habilidadId e
// insertando una relacion con FK invalida -> la transaccion hace rollback
// y el guardado "falla siempre / entra en bucle". Por eso se usa la
// conexion de la transaccion.
// --------------------------------------------------------------
async function obtenerOCrearHabilidad(conexion, nombre) {
  const nombreLimpio = nombre.trim();
  const [resultado] = await conexion.query(
    'INSERT INTO habilidades (nombre) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
    [nombreLimpio]
  );
  return resultado.insertId;
}

// --------------------------------------------------------------
// Calcula el porcentaje de completitud de un perfil y la lista de
// campos que faltan. Se exporta porque tambien la usa el modulo de
// Vacantes (para no recomendar vacantes a perfiles muy incompletos,
// y para mostrar advertencias).
// --------------------------------------------------------------
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

// --------------------------------------------------------------
// GET /api/perfil
// Devuelve el perfil completo del usuario autenticado, junto con su
// porcentaje de completitud (HU-RF-003).
// --------------------------------------------------------------
async function obtenerPerfil(req, res) {
  try {
    const usuarioId = req.usuario.id;

    const [perfiles] = await pool.query('SELECT * FROM perfiles WHERE usuario_id = ?', [usuarioId]);
    const perfil = perfiles[0] || null;

    // Si el usuario nunca ha guardado nada, devolvemos un perfil vacio
    // en vez de un error, para que el frontend simplemente muestre el
    // formulario en blanco con 0% de completitud.
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

// --------------------------------------------------------------
// PUT /api/perfil
// Guarda (crea o actualiza) el perfil completo del usuario autenticado.
// Se reemplazan experiencias/educaciones/habilidades completas en cada
// guardado: es la forma mas simple y confiable de reflejar ediciones y
// eliminaciones (HU-RF-002, tercer criterio de aceptacion) sin tener
// que sincronizar diffs registro por registro.
// --------------------------------------------------------------
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

  // Validacion minima en el backend (la validacion detallada campo a
  // campo ya la hizo el frontend antes de dejar avanzar al usuario,
  // pero el backend nunca debe confiar solo en eso).
  //
  // Se valida ANTES de pedir una conexion al pool: asi una peticion
  // invalida no consume ni retiene conexiones del pool.
  if (!nivel_educativo || !modalidad_preferida || !resumen) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Por favor completa los campos obligatorios para continuar'
    });
  }

  console.log('[guardarPerfil] Inicio. usuarioId=%s, experiencias=%d, educaciones=%d, habilidades=%d',
    usuarioId, experiencias.length, educaciones.length, habilidades.length);

  const conexion = await pool.getConnection();
  let transaccionAbierta = false;
  try {
    await conexion.beginTransaction();
    transaccionAbierta = true;

    // 1) Upsert de los datos basicos del perfil
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

    // Nota sobre "reevaluar automaticamente los criterios de match"
    // (3er criterio de HU-RF-002): en este proyecto el match NO se
    // guarda precalculado en la base de datos, sino que se calcula al
    // vuelo cada vez que el candidato pide sus recomendaciones (ver
    // controllers/vacantes.controller.js -> listarRecomendadas). Por
    // eso, apenas el perfil cambia, la siguiente consulta de
    // recomendaciones automaticamente refleja los datos nuevos, sin
    // que tengamos que "recalcular y guardar" nada aparte.

    // Respuesta de exito explicita (HTTP 200 por defecto en res.json).
    return res.status(200).json({ ok: true, mensaje: 'Perfil actualizado correctamente' });

  } catch (error) {
    // Solo hacemos ROLLBACK si realmente hay una transaccion abierta.
    // Hacer rollback sin transaccion activa lanza un segundo error que
    // enmascara el original. Ademas envolvemos el rollback en su propio
    // try/catch para que un fallo al revertir nunca tumbe la respuesta.
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
    // La conexion SIEMPRE se devuelve al pool, haya o no error. Sin esto,
    // cada guardado fallido "fugaria" una conexion y tras 10 intentos el
    // pool se agota y toda la app se cuelga esperando conexion (otra causa
    // del "bucle" / bloqueo percibido por el usuario).
    conexion.release();
  }
}

module.exports = { obtenerPerfil, guardarPerfil, calcularCompletitud };
