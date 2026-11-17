// Controlador del modulo Vacantes.
// Cubre HU-RF-004 (sincronizar), HU-RF-005 (administrar), HU-RF-006
// (recomendar con explicacion del match) y HU-RF-008 (filtros).

const { pool } = require('../config/db');

// Catálogo de vacantes de ejemplo que simula la fuente externa de Magneto.
// La sincronización inserta estas vacantes (con sus habilidades) si no existen.
const VACANTES_DE_EJEMPLO = [
  {
    titulo: 'Desarrollador(a) Backend Node.js',
    modalidad: 'remoto',
    salario_min: 3500000,
    salario_max: 5500000,
    nivel_educativo_requerido: 'pregrado',
    descripcion: 'Construir y mantener APIs REST con Node.js y bases de datos relacionales.',
    habilidades: ['Node.js', 'Express', 'MySQL', 'Git', 'JavaScript']
  },
  {
    titulo: 'Desarrollador(a) Frontend React',
    modalidad: 'hibrido',
    salario_min: 3000000,
    salario_max: 5000000,
    nivel_educativo_requerido: 'tecnologo',
    descripcion: 'Construir interfaces de usuario modernas y accesibles con React.',
    habilidades: ['React', 'JavaScript', 'CSS', 'HTML', 'Git']
  },
  {
    titulo: 'Analista de Datos Jr.',
    modalidad: 'presencial',
    salario_min: 2800000,
    salario_max: 4200000,
    nivel_educativo_requerido: 'pregrado',
    descripcion: 'Analizar datos de negocio y construir reportes para la toma de decisiones.',
    habilidades: ['SQL', 'Excel', 'Power BI', 'Python']
  },
  {
    titulo: 'Ingeniero(a) QA / Testing',
    modalidad: 'remoto',
    salario_min: 3200000,
    salario_max: 4800000,
    nivel_educativo_requerido: 'tecnologo',
    descripcion: 'Diseñar y ejecutar pruebas manuales y automatizadas de software.',
    habilidades: ['Testing', 'Selenium', 'SQL', 'Git']
  },
  {
    titulo: 'Product Manager Jr.',
    modalidad: 'hibrido',
    salario_min: 4000000,
    salario_max: 6500000,
    nivel_educativo_requerido: 'pregrado',
    descripcion: 'Coordinar el desarrollo de producto entre negocio, diseño y tecnología.',
    habilidades: ['Scrum', 'Comunicación', 'Excel', 'Jira']
  },
  {
    titulo: 'Diseñador(a) UX/UI',
    modalidad: 'remoto',
    salario_min: 2900000,
    salario_max: 4500000,
    nivel_educativo_requerido: 'tecnologo',
    descripcion: 'Diseñar experiencias de usuario centradas en investigación y prototipado.',
    habilidades: ['Figma', 'UX Research', 'Prototipado', 'HTML', 'CSS']
  },
  {
    titulo: 'Soporte Técnico Nivel 1',
    modalidad: 'presencial',
    salario_min: 1900000,
    salario_max: 2600000,
    nivel_educativo_requerido: 'tecnico',
    descripcion: 'Brindar soporte técnico a usuarios internos y externos.',
    habilidades: ['Windows', 'Redes', 'Atención al cliente']
  },
  {
    titulo: 'Desarrollador(a) Full Stack Semi Senior',
    modalidad: 'remoto',
    salario_min: 5500000,
    salario_max: 8500000,
    nivel_educativo_requerido: 'pregrado',
    descripcion: 'Construir funcionalidades end-to-end en un producto SaaS en crecimiento.',
    habilidades: ['Node.js', 'React', 'MySQL', 'Docker', 'Git', 'JavaScript']
  },
  {
    titulo: 'Ingeniero(a) DevOps',
    modalidad: 'remoto',
    salario_min: 6000000,
    salario_max: 9500000,
    nivel_educativo_requerido: 'pregrado',
    descripcion: 'Automatizar despliegues, administrar infraestructura en la nube y pipelines CI/CD.',
    habilidades: ['Docker', 'Kubernetes', 'AWS', 'Linux', 'Git', 'CI/CD']
  },
  {
    titulo: 'Científico(a) de Datos',
    modalidad: 'hibrido',
    salario_min: 5000000,
    salario_max: 8000000,
    nivel_educativo_requerido: 'posgrado',
    descripcion: 'Diseñar modelos de machine learning y análisis predictivo para el negocio.',
    habilidades: ['Python', 'Machine Learning', 'SQL', 'Pandas', 'Estadística']
  }
];

const ORDEN_NIVEL_EDUCATIVO = {
  bachiller: 1, tecnico: 2, tecnologo: 3, pregrado: 4, posgrado: 5, maestria: 6, doctorado: 7
};

async function obtenerOCrearHabilidad(conexion, nombre) {
  const [resultado] = await conexion.query(
    'INSERT INTO habilidades (nombre) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
    [nombre.trim()]
  );
  return resultado.insertId;
}

/**
 * Sincroniza el catálogo de vacantes de ejemplo desde la fuente Magneto dentro
 * de una transacción, evitando duplicados por título y empresa (HU-RF-004).
 * Solo admin.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function sincronizarVacantes(req, res) {
  // simular_error=true fuerza la respuesta de error para la sustentación.
  if (req.query.simular_error === 'true') {
    return res.status(502).json({
      ok: false,
      mensaje: 'Error al sincronizar vacantes. Verifique la conexión con la fuente de datos'
    });
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    let creadas = 0;
    for (const v of VACANTES_DE_EJEMPLO) {
      const [existentes] = await conexion.query(
        'SELECT id FROM vacantes WHERE titulo = ? AND empresa = ?',
        [v.titulo, 'Magneto']
      );
      if (existentes.length > 0) continue; // ya existe, no la duplicamos

      const [resultado] = await conexion.query(
        `INSERT INTO vacantes (titulo, empresa, modalidad, salario_min, salario_max, nivel_educativo_requerido, descripcion, estado, publicada_por, fuente)
         VALUES (?, 'Magneto', ?, ?, ?, ?, ?, 'activa', ?, 'Magneto')`,
        [v.titulo, v.modalidad, v.salario_min, v.salario_max, v.nivel_educativo_requerido, v.descripcion, req.usuario.id]
      );
      const vacanteId = resultado.insertId;

      for (const nombreHabilidad of v.habilidades) {
        const habilidadId = await obtenerOCrearHabilidad(conexion, nombreHabilidad);
        await conexion.query(
          'INSERT IGNORE INTO vacante_habilidades (vacante_id, habilidad_id) VALUES (?, ?)',
          [vacanteId, habilidadId]
        );
      }
      creadas++;
    }

    await conexion.commit();
    return res.json({
      ok: true,
      mensaje: `Sincronización completada: ${creadas} vacante(s) nueva(s) registrada(s).`,
      creadas
    });

  } catch (error) {
    await conexion.rollback();
    console.error('Error en sincronizarVacantes():', error);
    return res.status(502).json({
      ok: false,
      mensaje: 'Error al sincronizar vacantes. Verifique la conexión con la fuente de datos'
    });
  } finally {
    conexion.release();
  }
}

const MODALIDADES_VALIDAS = ['remoto', 'presencial', 'hibrido'];
const NIVELES_VALIDOS = ['bachiller', 'tecnico', 'tecnologo', 'pregrado', 'posgrado', 'maestria', 'doctorado'];

/**
 * Crea una vacante manualmente desde el panel admin con estado 'activa' y
 * conecta sus habilidades clave, dentro de una transacción SQL. Solo admin.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function crearVacante(req, res) {
  const {
    titulo,
    empresa,
    modalidad,
    salario_min,
    salario_max,
    nivel_educativo_requerido,
    descripcion,
    habilidades // string separado por comas, o arreglo de strings
  } = req.body;

  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ ok: false, mensaje: 'El título de la vacante es obligatorio.' });
  }
  if (!MODALIDADES_VALIDAS.includes(modalidad)) {
    return res.status(400).json({ ok: false, mensaje: 'Selecciona una modalidad válida.' });
  }
  if (!NIVELES_VALIDOS.includes(nivel_educativo_requerido)) {
    return res.status(400).json({ ok: false, mensaje: 'Selecciona un nivel educativo válido.' });
  }

  const salMin = Number(salario_min);
  const salMax = Number(salario_max);
  if (!Number.isFinite(salMin) || !Number.isFinite(salMax) || salMin < 0 || salMax < 0) {
    return res.status(400).json({ ok: false, mensaje: 'Ingresa un rango salarial válido.' });
  }
  if (salMin > salMax) {
    return res.status(400).json({ ok: false, mensaje: 'El salario mínimo no puede ser mayor que el máximo.' });
  }

  // Las habilidades llegan como texto "A, B, C" o como arreglo.
  const listaHabilidades = (Array.isArray(habilidades)
    ? habilidades
    : String(habilidades || '').split(','))
    .map(h => h.trim())
    .filter(h => h.length > 0);

  const conexion = await pool.getConnection();
  let transaccionAbierta = false;
  try {
    await conexion.beginTransaction();
    transaccionAbierta = true;

    const [resultado] = await conexion.query(
      `INSERT INTO vacantes (titulo, empresa, modalidad, salario_min, salario_max, nivel_educativo_requerido, descripcion, estado, publicada_por, fuente)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'activa', ?, 'manual')`,
      [
        titulo.trim(),
        (empresa && empresa.trim()) || 'Magneto',
        modalidad,
        salMin,
        salMax,
        nivel_educativo_requerido,
        (descripcion && descripcion.trim()) || 'Vacante publicada manualmente desde el panel de administración.',
        req.usuario.id
      ]
    );
    const vacanteId = resultado.insertId;

    for (const nombreHabilidad of listaHabilidades) {
      const habilidadId = await obtenerOCrearHabilidad(conexion, nombreHabilidad);
      await conexion.query(
        'INSERT IGNORE INTO vacante_habilidades (vacante_id, habilidad_id) VALUES (?, ?)',
        [vacanteId, habilidadId]
      );
    }

    await conexion.commit();
    transaccionAbierta = false;
    console.log('[crearVacante] Vacante creada id=%s por admin=%s', vacanteId, req.usuario.id);

    return res.status(201).json({ ok: true, mensaje: 'Vacante publicada correctamente.', id: vacanteId });

  } catch (error) {
    if (transaccionAbierta) {
      try { await conexion.rollback(); } catch (e) { console.error('Error en ROLLBACK crearVacante():', e); }
    }
    console.error('Error en crearVacante():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo publicar la vacante. Intenta de nuevo.' });
  } finally {
    conexion.release();
  }
}

/**
 * Lista todas las vacantes para el panel admin, ordenadas por fecha de
 * creación descendente (HU-RF-005). Solo admin.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function listarVacantesAdmin(req, res) {
  try {
    const [vacantes] = await pool.query(
      `SELECT id, titulo, modalidad, estado, creado_en
       FROM vacantes ORDER BY creado_en DESC`
    );
    return res.json({ ok: true, vacantes });
  } catch (error) {
    console.error('Error en listarVacantesAdmin():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudieron cargar las vacantes.' });
  }
}

/**
 * Activa o pausa una vacante por id (HU-RF-005). Solo admin.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function cambiarEstadoVacante(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body; // 'activa' | 'inactiva'

    if (!['activa', 'inactiva'].includes(estado)) {
      return res.status(400).json({ ok: false, mensaje: 'Estado inválido.' });
    }

    const [resultado] = await pool.query('UPDATE vacantes SET estado = ? WHERE id = ?', [estado, id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Vacante no encontrada.' });
    }

    const mensaje = estado === 'inactiva'
      ? 'Vacante pausada exitosamente'
      : 'Vacante activada exitosamente';

    return res.json({ ok: true, mensaje });

  } catch (error) {
    console.error('Error en cambiarEstadoVacante():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo actualizar el estado de la vacante.' });
  }
}

// Estrategia de match determinística y explicable:
//   80% = proporción de habilidades requeridas que el candidato tiene
//   20% = si su nivel educativo cumple o supera el requerido
function calcularMatch(habilidadesCandidato, nivelEducativoCandidato, habilidadesVacante, nivelEducativoRequerido) {
  const setCandidato = new Set(habilidadesCandidato.map(h => h.toLowerCase().trim()));

  const coincidentes = habilidadesVacante.filter(h => setCandidato.has(h.toLowerCase().trim()));
  const faltantes = habilidadesVacante.filter(h => !setCandidato.has(h.toLowerCase().trim()));

  const puntajeHabilidades = habilidadesVacante.length > 0
    ? coincidentes.length / habilidadesVacante.length
    : 1;

  const nivelCandidato = ORDEN_NIVEL_EDUCATIVO[nivelEducativoCandidato] || 0;
  const nivelRequerido = ORDEN_NIVEL_EDUCATIVO[nivelEducativoRequerido] || 0;
  const cumpleEducacion = nivelCandidato >= nivelRequerido;

  const porcentaje = Math.round((puntajeHabilidades * 0.8 + (cumpleEducacion ? 1 : 0) * 0.2) * 100);

  const explicacion = habilidadesVacante.length > 0
    ? `Cumples ${coincidentes.length} de ${habilidadesVacante.length} habilidades requeridas` +
    `${cumpleEducacion ? ', y tu nivel educativo cumple lo que pide la vacante.' : ', aunque tu nivel educativo no alcanza el requerido.'}`
    : 'Esta vacante no especifica habilidades puntuales, así que el match se basa solo en tu nivel educativo.';

  return { porcentaje, coincidentes, faltantes, cumpleEducacion, explicacion, motor: 'algoritmo' };
}

// Estrategia de match alternativa basada en IA (Groq, compatible con el
// formato de API de OpenAI). Requiere GROQ_API_KEY en .env. Depende de un
// servicio externo; ante cualquier fallo, obtenerMatch() recurre al algoritmo.
async function calcularMatchIA(habilidadesCandidato, nivelEducativoCandidato, habilidadesVacante, nivelEducativoRequerido, tituloVacante) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('Falta configurar GROQ_API_KEY en el archivo .env para usar el motor de IA.');
  }

  const instruccionSistema = `Eres un motor de coincidencia (matching) para un portal de empleo.
Comparas el perfil de un candidato contra los requisitos de una vacante.

CÓMO CALCULAR EL PORCENTAJE (obligatorio, es PROPORCIONAL, nunca "todo o nada"):
- 80% del puntaje viene de las habilidades: proporción de habilidades requeridas que el candidato SÍ tiene.
  Fórmula: (habilidades_coincidentes / total_habilidades_requeridas) * 80.
  Ejemplo: si la vacante pide 5 habilidades y el candidato tiene 4, eso son (4/5)*80 = 64 puntos; que falte 1 NO significa 0%.
- 20% del puntaje viene del nivel educativo: 20 si el nivel del candidato cumple o supera el requerido, 0 si no.
- El porcentaje final es la suma de ambas partes, redondeada a entero (rango 0 a 100).
- Compara habilidades sin distinguir mayúsculas/minúsculas ni espacios sobrantes. Considera equivalentes variantes obvias (ej: "JS" y "JavaScript", "Node" y "Node.js").
- Si la vacante no pide ninguna habilidad, la parte de habilidades vale el 80% completo.
NO seas extremista: un candidato al que solo le falta 1 de varias habilidades debe quedar con un porcentaje ALTO, no bajo.

Devuelve SOLO un objeto JSON valido, sin texto adicional, con esta forma exacta:
{
  "porcentaje": <numero entero de 0 a 100, calculado con la fórmula de arriba>,
  "coincidentes": [<habilidades de la vacante que el candidato SI tiene, como strings>],
  "faltantes": [<habilidades de la vacante que el candidato NO tiene, como strings>],
  "cumple_nivel_educativo": <true o false>,
  "explicacion": "<1 o 2 frases explicando el porcentaje, en español, tono profesional>"
}`;

  const datosParaElModelo = {
    vacante: { titulo: tituloVacante, nivel_educativo_requerido: nivelEducativoRequerido, habilidades_requeridas: habilidadesVacante },
    candidato: { nivel_educativo: nivelEducativoCandidato, habilidades: habilidadesCandidato }
  };

  // AbortController corta la petición si la API tarda demasiado (HU-RNF-001).
  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort(), 8000); // 8 segundos máximo

  try {
    const respuesta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0, // respuestas lo más deterministas posible
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

    return {
      porcentaje: Math.max(0, Math.min(100, Math.round(resultado.porcentaje))),
      coincidentes: resultado.coincidentes || [],
      faltantes: resultado.faltantes || [],
      cumpleEducacion: !!resultado.cumple_nivel_educativo,
      explicacion: resultado.explicacion || '',
      motor: 'ia'
    };

  } finally {
    clearTimeout(timeoutId);
  }
}

// Patrón Strategy: punto único que decide el motor de match. El resto del
// controller llama siempre aquí, así cambiar de motor es solo una variable
// de entorno (MOTOR_MATCH). Con 'ia' (por defecto) intenta Groq y cae al
// algoritmo si falla; 'algoritmo' lo usa siempre. forzarAlgoritmo=true salta
// la IA en el listado de recomendadas para no exceder la cuota de Groq (429).
async function obtenerMatch(habilidadesCandidato, nivelEducativoCandidato, habilidadesVacante, nivelEducativoRequerido, tituloVacante, forzarAlgoritmo = false) {
  const motor = (process.env.MOTOR_MATCH || 'ia').toLowerCase().trim();

  if (motor === 'ia' && !forzarAlgoritmo) {
    try {
      return await calcularMatchIA(habilidadesCandidato, nivelEducativoCandidato, habilidadesVacante, nivelEducativoRequerido, tituloVacante);
    } catch (error) {
      console.error('Fallo el motor de IA, usando el algoritmo 80/20 como respaldo:', error.message);
      return calcularMatch(habilidadesCandidato, nivelEducativoCandidato, habilidadesVacante, nivelEducativoRequerido);
    }
  }
  return calcularMatch(habilidadesCandidato, nivelEducativoCandidato, habilidadesVacante, nivelEducativoRequerido);
}

/**
 * Lista las vacantes activas recomendadas para el candidato, calculando el
 * porcentaje de match de cada una y ordenando de mayor a menor coincidencia.
 * Acepta filtros opcionales: modalidad, salario_min, salario_max,
 * nivel_educativo y buscar (HU-RF-006, HU-RF-008).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function listarRecomendadas(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const { modalidad, salario_min, salario_max, nivel_educativo, buscar } = req.query;

    // 1) Traer el perfil y habilidades del candidato
    const [perfiles] = await pool.query('SELECT * FROM perfiles WHERE usuario_id = ?', [usuarioId]);
    const perfil = perfiles[0] || null;

    const [habilidadesPerfil] = perfil
      ? await pool.query(
        `SELECT h.nombre FROM habilidades h
           INNER JOIN perfil_habilidades ph ON ph.habilidad_id = h.id
           WHERE ph.perfil_id = ?`, [perfil.id]
      )
      : [[]];

    const nombresHabilidadesCandidato = habilidadesPerfil.map(h => h.nombre);

    // 2) Traer vacantes activas aplicando los filtros que hayan llegado
    let sql = `SELECT id, titulo, empresa, modalidad, salario_min, salario_max, nivel_educativo_requerido, descripcion, creado_en
               FROM vacantes WHERE estado = 'activa'`;
    const params = [];

    if (modalidad) {
      sql += ' AND modalidad = ?';
      params.push(modalidad);
    }
    if (salario_min) {
      sql += ' AND salario_max >= ?'; // la vacante debe pagar al menos lo minimo que pide el filtro
      params.push(Number(salario_min));
    }
    if (salario_max) {
      sql += ' AND salario_min <= ?'; // la vacante no debe pedir mas de lo que el filtro tope
      params.push(Number(salario_max));
    }
    if (nivel_educativo) {
      sql += ' AND nivel_educativo_requerido = ?';
      params.push(nivel_educativo);
    }
    // Busqueda por palabra clave en titulo o descripcion. Se usa LIKE con
    // parametros ligados (?) para evitar inyeccion SQL.
    if (buscar && buscar.trim()) {
      sql += ' AND (titulo LIKE ? OR descripcion LIKE ?)';
      const comodin = `%${buscar.trim()}%`;
      params.push(comodin, comodin);
    }

    const [vacantes] = await pool.query(sql, params);

    // 3) Para cada vacante, traer sus habilidades requeridas y calcular el match
    const resultado = [];
    for (const vacante of vacantes) {
      const [habilidadesVacante] = await pool.query(
        `SELECT h.nombre FROM habilidades h
         INNER JOIN vacante_habilidades vh ON vh.habilidad_id = h.id
         WHERE vh.vacante_id = ?`,
        [vacante.id]
      );
      const nombresHabilidadesVacante = habilidadesVacante.map(h => h.nombre);

      // En el LISTADO usamos el algoritmo (forzarAlgoritmo=true): son muchas
      // vacantes y llamar a la IA por cada una excedería la cuota de Groq.
      const { porcentaje } = await obtenerMatch(
        nombresHabilidadesCandidato,
        perfil ? perfil.nivel_educativo : null,
        nombresHabilidadesVacante,
        vacante.nivel_educativo_requerido,
        vacante.titulo,
        true
      );

      resultado.push({ ...vacante, match_porcentaje: porcentaje });
    }

    // 4) Ordenar de mayor a menor coincidencia (HU-RF-006, 1er criterio)
    resultado.sort((a, b) => b.match_porcentaje - a.match_porcentaje);

    return res.json({ ok: true, vacantes: resultado, perfil_incompleto: !perfil });

  } catch (error) {
    console.error('Error en listarRecomendadas():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudieron cargar las recomendaciones.' });
  }
}

/**
 * Devuelve el desglose detallado del match entre el candidato y una vacante
 * (habilidades coincidentes/faltantes, nivel educativo y explicación) para el
 * modal de detalle (HU-RF-006).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function obtenerDetalleMatch(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const { id } = req.params;

    const [vacantes] = await pool.query('SELECT * FROM vacantes WHERE id = ?', [id]);
    if (vacantes.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Vacante no encontrada.' });
    }
    const vacante = vacantes[0];

    const [perfiles] = await pool.query('SELECT * FROM perfiles WHERE usuario_id = ?', [usuarioId]);
    const perfil = perfiles[0] || null;

    const [habilidadesPerfil] = perfil
      ? await pool.query(
        `SELECT h.nombre FROM habilidades h
           INNER JOIN perfil_habilidades ph ON ph.habilidad_id = h.id
           WHERE ph.perfil_id = ?`, [perfil.id]
      )
      : [[]];

    const [habilidadesVacante] = await pool.query(
      `SELECT h.nombre FROM habilidades h
       INNER JOIN vacante_habilidades vh ON vh.habilidad_id = h.id
       WHERE vh.vacante_id = ?`,
      [vacante.id]
    );

    // Se fuerza el algoritmo matematico (forzarAlgoritmo=true) para no
    // consumir cuota de la IA en cada apertura del detalle; el motor de IA
    // (Groq) se reserva para la mentoria de entrevista. El resultado del
    // match es equivalente al de la IA.
    const detalle = await obtenerMatch(
      habilidadesPerfil.map(h => h.nombre),
      perfil ? perfil.nivel_educativo : null,
      habilidadesVacante.map(h => h.nombre),
      vacante.nivel_educativo_requerido,
      vacante.titulo,
      true
    );

    return res.json({
      ok: true,
      vacante: { id: vacante.id, titulo: vacante.titulo, empresa: vacante.empresa },
      match_porcentaje: detalle.porcentaje,
      habilidades_coincidentes: detalle.coincidentes,
      habilidades_faltantes: detalle.faltantes,
      cumple_nivel_educativo: detalle.cumpleEducacion,
      nivel_educativo_requerido: vacante.nivel_educativo_requerido,
      explicacion: detalle.explicacion,
      motor_usado: detalle.motor
    });

  } catch (error) {
    console.error('Error en obtenerDetalleMatch():', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo calcular el detalle del match.' });
  }
}

module.exports = {
  sincronizarVacantes,
  crearVacante,
  listarVacantesAdmin,
  cambiarEstadoVacante,
  listarRecomendadas,
  obtenerDetalleMatch,
  calcularMatch,   // algoritmo determinístico
  calcularMatchIA, // version con IA (Groq)
  obtenerMatch     // punto unico de decision entre los dos motores
};
