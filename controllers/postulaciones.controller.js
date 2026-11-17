// Controlador del modulo Postulaciones.
// Cubre HU-RF-007 (tablero de trazabilidad) y HU-RF-009 (postular).

const { pool } = require('../config/db');
const { notificaciones } = require('../services/notificaciones.observer');

const ESTADOS_VALIDOS = ['postulado', 'en_revision', 'entrevista', 'aceptado', 'descartado', 'cancelada'];

// Construye el evento de notificación según el estado al que avanza la
// postulación. Solo los estados positivos generan alerta al candidato; el
// Patrón Observer (services/notificaciones.observer.js) la persiste y audita.
function construirEventoEstado(estado, usuarioId, tituloVacante) {
  const vac = tituloVacante ? ` para "${tituloVacante}"` : '';
  switch (estado) {
    case 'en_revision':
      return {
        tipo: 'postulacion_estado', usuarioId,
        titulo: '¡Avanzaste a En revisión!',
        mensaje: `Tu postulación${vac} está en revisión. Completa tu Mentoría IA para asegurar tu entrevista.`,
        enlace: 'postulaciones.html'
      };
    case 'entrevista':
      return {
        tipo: 'postulacion_estado', usuarioId,
        titulo: '¡Pasaste a Entrevista!',
        mensaje: `Completaste la preparación${vac}. Revisa tu tablero y prepárate para brillar.`,
        enlace: 'postulaciones.html'
      };
    case 'aceptado':
      return {
        tipo: 'postulacion_estado', usuarioId,
        titulo: '¡Felicitaciones, fuiste aceptado!',
        mensaje: `Tu proceso${vac} llegó a Aceptado. ¡Un gran logro!`,
        enlace: 'postulaciones.html'
      };
    default:
      return null; // otros estados no generan notificación al candidato
  }
}

// Estados desde los que el candidato puede retirar (cancelar) su postulacion.
const ESTADOS_CANCELABLES = ['postulado', 'en_revision'];

/**
 * Registra la postulación del candidato autenticado a una vacante activa
 * dentro de una transacción (postulación + historial inicial). Devuelve 409
 * si ya existe una postulación a esa vacante (HU-RF-009).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function postular(req, res) {
  const conexion = await pool.getConnection();
  try {
    const usuarioId = req.usuario.id;
    const { vacante_id } = req.body;

    if (!vacante_id) {
      return res.status(400).json({ ok: false, mensaje: 'Falta indicar la vacante.' });
    }

    const [vacantes] = await conexion.query('SELECT id, estado FROM vacantes WHERE id = ?', [vacante_id]);
    if (vacantes.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'La vacante no existe.' });
    }
    if (vacantes[0].estado !== 'activa') {
      return res.status(400).json({ ok: false, mensaje: 'Esta vacante ya no está disponible.' });
    }

    await conexion.beginTransaction();

    try {
      const [resultado] = await conexion.query(
        'INSERT INTO postulaciones (usuario_id, vacante_id, estado) VALUES (?, ?, ?)',
        [usuarioId, vacante_id, 'postulado']
      );

      await conexion.query(
        'INSERT INTO postulacion_historial (postulacion_id, estado, motivo) VALUES (?, ?, ?)',
        [resultado.insertId, 'postulado', 'Postulación registrada por el candidato.']
      );

      await conexion.commit();
      return res.status(201).json({ ok: true, mensaje: 'Postulación registrada exitosamente' });

    } catch (errorInterno) {
      await conexion.rollback();
      // Codigo de error de mysql2 cuando se viola una restriccion UNIQUE
      if (errorInterno.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ ok: false, mensaje: 'Ya has postulado a esta vacante' });
      }
      throw errorInterno;
    }

  } catch (error) {
    console.error('Error en postular():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo registrar tu postulación.' });
  } finally {
    conexion.release();
  }
}

/**
 * Lista las postulaciones del candidato autenticado para el tablero de
 * trazabilidad, con un flag de si cada una tiene mentoría IA (HU-RF-007).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function listarPostulaciones(req, res) {
  try {
    const usuarioId = req.usuario.id;

    const [filas] = await pool.query(
      `SELECT p.id, p.estado, p.creado_en, p.actualizado_en,
              (p.mentoria_ia IS NOT NULL) AS tiene_mentoria,
              v.id AS vacante_id, v.titulo, v.empresa, v.modalidad
       FROM postulaciones p
       INNER JOIN vacantes v ON v.id = p.vacante_id
       WHERE p.usuario_id = ?
       ORDER BY p.actualizado_en DESC`,
      [usuarioId]
    );

    // Normalizamos el flag a booleano real (MySQL devuelve 1/0).
    const postulaciones = filas.map(p => ({ ...p, tiene_mentoria: !!p.tiene_mentoria }));

    return res.json({ ok: true, postulaciones });

  } catch (error) {
    console.error('Error en listarPostulaciones():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudieron cargar tus postulaciones.' });
  }
}

/**
 * Devuelve el detalle de una postulación del candidato (datos de la vacante,
 * historial de estados y si tiene mentoría guardada) para el panel lateral.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function detallePostulacion(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const { id } = req.params;

    const [postulaciones] = await pool.query(
      `SELECT p.id, p.estado, p.creado_en, p.mentoria_ia, v.titulo, v.empresa, v.modalidad, v.descripcion
       FROM postulaciones p
       INNER JOIN vacantes v ON v.id = p.vacante_id
       WHERE p.id = ? AND p.usuario_id = ?`,
      [id, usuarioId]
    );

    if (postulaciones.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Postulación no encontrada.' });
    }

    const [historial] = await pool.query(
      'SELECT estado, motivo, fecha FROM postulacion_historial WHERE postulacion_id = ? ORDER BY fecha ASC',
      [id]
    );

    // Exponemos solo un booleano de si tiene mentoría guardada (el contenido
    // se consulta aparte en GET /:id/mentoria para no inflar este payload).
    const postulacion = postulaciones[0];
    const tiene_mentoria = !!postulacion.mentoria_ia;
    delete postulacion.mentoria_ia;

    return res.json({ ok: true, postulacion: { ...postulacion, tiene_mentoria }, historial });

  } catch (error) {
    console.error('Error en detallePostulacion():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo cargar el detalle de la postulación.' });
  }
}

/**
 * Cambia el estado de una postulación (admin), registra el cambio en el
 * historial inmutable y, vía Observer, notifica al candidato si el nuevo
 * estado le interesa (HU-RNF-002).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function cambiarEstadoPostulacion(req, res) {
  try {
    const { id } = req.params;
    const { estado, motivo } = req.body;

    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ ok: false, mensaje: 'Estado inválido.' });
    }

    const [resultado] = await pool.query('UPDATE postulaciones SET estado = ? WHERE id = ?', [estado, id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Postulación no encontrada.' });
    }

    // Registro inmutable del cambio, con fecha/hora (HU-RNF-002)
    await pool.query(
      'INSERT INTO postulacion_historial (postulacion_id, estado, motivo) VALUES (?, ?, ?)',
      [id, estado, motivo || 'Actualizado por el equipo de selección.']
    );

    // Observer: si el nuevo estado le interesa al candidato (en_revision,
    // entrevista, aceptado), le avisamos. Como este endpoint es de admin,
    // buscamos a quién pertenece la postulación y el título de la vacante.
    const [info] = await pool.query(
      `SELECT p.usuario_id, v.titulo FROM postulaciones p
       INNER JOIN vacantes v ON v.id = p.vacante_id WHERE p.id = ?`, [id]
    );
    if (info[0]) {
      const evento = construirEventoEstado(estado, info[0].usuario_id, info[0].titulo);
      if (evento) notificaciones.notificar(evento);
    }

    return res.json({ ok: true, mensaje: 'Estado de la postulación actualizado.' });

  } catch (error) {
    console.error('Error en cambiarEstadoPostulacion():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo actualizar el estado.' });
  }
}

/**
 * Avanza la postulación del candidato de 'postulado' a 'en_revision' dentro de
 * una transacción (estado + historial) y lo notifica vía Observer. Idempotente:
 * solo actúa si sigue en 'postulado'.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function avanzarARevision(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const { id } = req.params;

    const [postulaciones] = await pool.query(
      'SELECT id, estado FROM postulaciones WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    if (postulaciones.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Postulación no encontrada.' });
    }
    if (postulaciones[0].estado !== 'postulado') {
      // Ya fue avanzada (o movida manualmente): no hacemos nada.
      return res.json({ ok: true, mensaje: 'La postulación ya no está en estado postulado.', avanzada: false });
    }

    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      await conexion.query('UPDATE postulaciones SET estado = ? WHERE id = ?', ['en_revision', id]);
      await conexion.query(
        'INSERT INTO postulacion_historial (postulacion_id, estado, motivo) VALUES (?, ?, ?)',
        [id, 'en_revision', 'La empresa inició la revisión de tu postulación.']
      );
      await conexion.commit();
    } catch (errorInterno) {
      await conexion.rollback();
      throw errorInterno;
    } finally {
      conexion.release();
    }

    // Observer: avisar al candidato que avanzó a "En revisión".
    const [infoVac] = await pool.query(
      `SELECT v.titulo FROM postulaciones p INNER JOIN vacantes v ON v.id = p.vacante_id WHERE p.id = ?`, [id]
    );
    const evento = construirEventoEstado('en_revision', usuarioId, infoVac[0] && infoVac[0].titulo);
    if (evento) notificaciones.notificar(evento);

    return res.json({ ok: true, mensaje: 'Postulación movida a En revisión.', avanzada: true });

  } catch (error) {
    console.error('Error en avanzarARevision():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo avanzar la postulación.' });
  }
}

// Reúne el contexto de una postulación para la mentoría IA: perfil del
// candidato, datos de la vacante y las habilidades faltantes (lo que la
// vacante exige y el candidato aún no tiene).
async function reunirContextoSimulacion(postulacionId, usuarioId) {
  const [postulaciones] = await pool.query(
    `SELECT p.id, p.estado, p.usuario_id, p.vacante_id,
            v.titulo, v.empresa, v.modalidad, v.descripcion, v.nivel_educativo_requerido
     FROM postulaciones p
     INNER JOIN vacantes v ON v.id = p.vacante_id
     WHERE p.id = ? AND p.usuario_id = ?`,
    [postulacionId, usuarioId]
  );

  if (postulaciones.length === 0) return null;
  const postulacion = postulaciones[0];

  // Perfil del candidato (puede no existir si no lo ha llenado)
  const [perfiles] = await pool.query(
    'SELECT id, nivel_educativo, resumen FROM perfiles WHERE usuario_id = ?',
    [usuarioId]
  );
  const perfil = perfiles[0] || null;

  // Habilidades del candidato
  const [habilidadesPerfil] = perfil
    ? await pool.query(
      `SELECT h.nombre FROM habilidades h
       INNER JOIN perfil_habilidades ph ON ph.habilidad_id = h.id
       WHERE ph.perfil_id = ?`, [perfil.id])
    : [[]];
  const habilidadesCandidato = habilidadesPerfil.map(h => h.nombre);

  // Habilidades requeridas por la vacante
  const [habilidadesVacante] = await pool.query(
    `SELECT h.nombre FROM habilidades h
     INNER JOIN vacante_habilidades vh ON vh.habilidad_id = h.id
     WHERE vh.vacante_id = ?`, [postulacion.vacante_id]
  );
  const habilidadesRequeridas = habilidadesVacante.map(h => h.nombre);

  // "Chips rojos": lo que exige la vacante y el candidato NO tiene.
  const setCandidato = new Set(habilidadesCandidato.map(h => h.toLowerCase().trim()));
  const habilidadesFaltantes = habilidadesRequeridas.filter(h => !setCandidato.has(h.toLowerCase().trim()));

  return { postulacion, perfil, habilidadesCandidato, habilidadesRequeridas, habilidadesFaltantes };
}

// Llama a Groq actuando como mentor técnico y devuelve 2 preguntas técnicas
// enfocadas en las habilidades faltantes, 1 escenario conductual y consejos.
// Usa timeout con AbortController y response_format JSON, como calcularMatchIA().
async function generarSimulacionIA({ titulo, empresa, modalidad, descripcion, nivelEducativoRequerido }, perfil, habilidadesCandidato, habilidadesFaltantes) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('Falta configurar GROQ_API_KEY en el archivo .env para usar el simulador de IA.');
  }

  const instruccionSistema = `Eres un mentor técnico senior que prepara a un candidato para una entrevista de trabajo real.
Tu objetivo es entrenar al candidato enfocándote en SUS DEBILIDADES (las habilidades que la vacante exige y que el candidato todavía NO domina).
Responde SOLO con un objeto JSON válido, en español, sin texto adicional, con esta forma exacta:
{
  "introduccion": "<1 o 2 frases motivadoras que sitúen al candidato en la entrevista, tono cercano y profesional>",
  "preguntas_tecnicas": [
    { "pregunta": "<pregunta técnica 1 enfocada en una habilidad faltante>", "habilidad": "<habilidad faltante a la que apunta>", "pista": "<pista breve de cómo abordarla>" },
    { "pregunta": "<pregunta técnica 2 enfocada en otra debilidad>", "habilidad": "<habilidad faltante a la que apunta>", "pista": "<pista breve de cómo abordarla>" }
  ],
  "escenario_conductual": { "situacion": "<escenario conductual realista relacionado con el cargo>", "que_evalua": "<qué competencia blanda evalúa este escenario>" },
  "consejos_preparacion": [ "<consejo accionable 1>", "<consejo accionable 2>", "<consejo accionable 3>" ]
}
Reglas: exactamente 2 preguntas técnicas y 1 escenario conductual. Si no hay habilidades faltantes, genera preguntas técnicas de nivel intermedio sobre las habilidades clave del cargo.`;

  const datosParaElModelo = {
    vacante: { titulo, empresa, modalidad, descripcion, nivel_educativo_requerido: nivelEducativoRequerido },
    candidato: {
      nivel_educativo: perfil ? perfil.nivel_educativo : null,
      resumen: perfil ? perfil.resumen : null,
      habilidades_actuales: habilidadesCandidato
    },
    habilidades_faltantes_a_reforzar: habilidadesFaltantes
  };

  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort(), 12000); // 12s máximo

  try {
    const respuesta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0.6, // algo de variedad: es un mentor, no un clasificador
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: instruccionSistema },
          { role: 'user', content: JSON.stringify(datosParaElModelo) }
        ]
      }),
      signal: controlador.signal
    });

    if (!respuesta.ok) {
      throw new Error(`La API de IA respondió con estado ${respuesta.status}`);
    }

    const datos = await respuesta.json();
    const contenidoTexto = datos.choices?.[0]?.message?.content;
    if (!contenidoTexto) throw new Error('La API de IA no devolvió contenido.');

    const resultado = JSON.parse(contenidoTexto);

    // Normalizamos para blindar el frontend contra respuestas incompletas.
    return {
      introduccion: resultado.introduccion || 'Prepárate: esta es tu oportunidad para demostrar lo que vales.',
      preguntas_tecnicas: Array.isArray(resultado.preguntas_tecnicas) ? resultado.preguntas_tecnicas.slice(0, 2) : [],
      escenario_conductual: resultado.escenario_conductual || { situacion: '', que_evalua: '' },
      consejos_preparacion: Array.isArray(resultado.consejos_preparacion) ? resultado.consejos_preparacion : []
    };

  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Genera la mentoría IA de una postulación: reúne el contexto y pide a Groq
 * preguntas técnicas sobre las habilidades faltantes, un escenario conductual
 * y consejos de preparación.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function simularEntrevista(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const { id } = req.params;

    const contexto = await reunirContextoSimulacion(id, usuarioId);
    if (!contexto) {
      return res.status(404).json({ ok: false, mensaje: 'Postulación no encontrada.' });
    }

    const { postulacion, perfil, habilidadesCandidato, habilidadesRequeridas, habilidadesFaltantes } = contexto;

    const simulacion = await generarSimulacionIA(
      {
        titulo: postulacion.titulo,
        empresa: postulacion.empresa,
        modalidad: postulacion.modalidad,
        descripcion: postulacion.descripcion,
        nivelEducativoRequerido: postulacion.nivel_educativo_requerido
      },
      perfil,
      habilidadesCandidato,
      habilidadesFaltantes
    );

    return res.json({
      ok: true,
      vacante: { titulo: postulacion.titulo, empresa: postulacion.empresa, modalidad: postulacion.modalidad },
      habilidades_faltantes: habilidadesFaltantes,
      habilidades_requeridas: habilidadesRequeridas,
      simulacion
    });

  } catch (error) {
    console.error('Error en simularEntrevista():', error);
    return res.status(502).json({
      ok: false,
      mensaje: 'No se pudo generar la mentoría IA en este momento. Intenta de nuevo en unos segundos.'
    });
  }
}

/**
 * Completa la mentoría IA: persiste el JSON generado, avanza la postulación a
 * 'entrevista' dentro de una transacción (estado + historial) y notifica al
 * candidato vía Observer.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function completarSimulacion(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const { id } = req.params;
    // El JSON de la mentoría es opcional; se guarda para consulta posterior.
    const { mentoria } = req.body || {};

    const [postulaciones] = await pool.query(
      'SELECT id, estado FROM postulaciones WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    if (postulaciones.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Postulación no encontrada.' });
    }

    // mysql2 serializa objetos a JSON para columnas tipo JSON; guardamos el
    // string explícitamente para controlar el formato y evitar sorpresas.
    const mentoriaJson = mentoria ? JSON.stringify(mentoria) : null;

    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();

      await conexion.query(
        'UPDATE postulaciones SET estado = ?, mentoria_ia = ? WHERE id = ?',
        ['entrevista', mentoriaJson, id]
      );

      await conexion.query(
        'INSERT INTO postulacion_historial (postulacion_id, estado, motivo) VALUES (?, ?, ?)',
        [id, 'entrevista', 'El candidato completó la mentoría técnica IA']
      );

      await conexion.commit();
    } catch (errorInterno) {
      await conexion.rollback();
      throw errorInterno;
    } finally {
      conexion.release();
    }

    // Observer: avisar al candidato que avanzó a "Entrevista".
    const [infoVac] = await pool.query(
      `SELECT v.titulo FROM postulaciones p INNER JOIN vacantes v ON v.id = p.vacante_id WHERE p.id = ?`, [id]
    );
    const evento = construirEventoEstado('entrevista', usuarioId, infoVac[0] && infoVac[0].titulo);
    if (evento) notificaciones.notificar(evento);

    return res.json({ ok: true, mensaje: 'Mentoría completada. ¡Avanzaste a la etapa de Entrevista!' });

  } catch (error) {
    console.error('Error en completarSimulacion():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo registrar la preparación.' });
  }
}

/**
 * Devuelve el JSON de la mentoría IA guardado para una postulación, para
 * consultarlo en modo lectura.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function obtenerMentoria(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const { id } = req.params;

    const [filas] = await pool.query(
      `SELECT p.mentoria_ia, v.titulo, v.empresa, v.modalidad
       FROM postulaciones p
       INNER JOIN vacantes v ON v.id = p.vacante_id
       WHERE p.id = ? AND p.usuario_id = ?`,
      [id, usuarioId]
    );

    if (filas.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Postulación no encontrada.' });
    }

    const fila = filas[0];
    if (!fila.mentoria_ia) {
      return res.status(404).json({ ok: false, mensaje: 'Esta postulación no tiene una mentoría guardada.' });
    }

    // mysql2 puede devolver la columna JSON ya parseada (objeto) o como
    // string, según versión/configuración. Normalizamos ambos casos.
    let mentoria = fila.mentoria_ia;
    if (typeof mentoria === 'string') {
      try { mentoria = JSON.parse(mentoria); } catch (e) { mentoria = null; }
    }

    return res.json({
      ok: true,
      vacante: { titulo: fila.titulo, empresa: fila.empresa, modalidad: fila.modalidad },
      mentoria
    });

  } catch (error) {
    console.error('Error en obtenerMentoria():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo cargar la mentoría guardada.' });
  }
}

/**
 * Retira una postulación del candidato: no la borra, cambia su estado a
 * 'cancelada' y registra el motivo en el historial inmutable para conservar
 * la trazabilidad (HU-RNF-002). Solo desde estados cancelables.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function cancelarPostulacion(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const { id } = req.params;

    const [postulaciones] = await pool.query(
      'SELECT id, estado FROM postulaciones WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    if (postulaciones.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Postulación no encontrada.' });
    }

    const estadoActual = postulaciones[0].estado;
    if (estadoActual === 'cancelada') {
      return res.json({ ok: true, mensaje: 'Esta postulación ya estaba retirada.', cancelada: false });
    }
    if (!ESTADOS_CANCELABLES.includes(estadoActual)) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Solo puedes retirar postulaciones que estén en Postulado o En revisión.'
      });
    }

    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      await conexion.query('UPDATE postulaciones SET estado = ? WHERE id = ?', ['cancelada', id]);
      await conexion.query(
        'INSERT INTO postulacion_historial (postulacion_id, estado, motivo) VALUES (?, ?, ?)',
        [id, 'cancelada', 'El candidato retiró su postulación']
      );
      await conexion.commit();
    } catch (errorInterno) {
      await conexion.rollback();
      throw errorInterno;
    } finally {
      conexion.release();
    }

    return res.json({ ok: true, mensaje: 'Postulación retirada correctamente.', cancelada: true });

  } catch (error) {
    console.error('Error en cancelarPostulacion():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo retirar la postulación.' });
  }
}

module.exports = {
  postular,
  listarPostulaciones,
  detallePostulacion,
  cambiarEstadoPostulacion,
  avanzarARevision,
  simularEntrevista,
  completarSimulacion,
  obtenerMentoria,
  cancelarPostulacion
};
