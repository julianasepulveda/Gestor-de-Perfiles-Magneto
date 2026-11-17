// Logica del tablero de trazabilidad de postulaciones (HU-RF-007).

const usuario = protegerPagina();
if (usuario) {
  construirNavbarCandidato('postulaciones.html');
  activarBotonSalir();
  renderizarWidgetCompletitud();
  document.getElementById('btn-cerrar-detalle').addEventListener('click', cerrarDetalle);
  document.getElementById('overlay-detalle').addEventListener('click', (e) => {
    if (e.target.id === 'overlay-detalle') cerrarDetalle();
  });
  document.getElementById('btn-vista-tablero').addEventListener('click', () => cambiarVista('tablero'));
  document.getElementById('btn-vista-tabla').addEventListener('click', () => cambiarVista('tabla'));
  cargarTablero();
}

let postulacionesCargadas = [];
let vistaActual = 'tablero';

function cambiarVista(vista) {
  vistaActual = vista;
  document.getElementById('btn-vista-tablero').classList.toggle('activo', vista === 'tablero');
  document.getElementById('btn-vista-tabla').classList.toggle('activo', vista === 'tabla');
  renderizarVistaActual();
}

const COLUMNAS = [
  { estado: 'postulado', titulo: 'Postulado' },
  { estado: 'en_revision', titulo: 'En revisión' },
  { estado: 'entrevista', titulo: 'Entrevista' },
  { estado: 'aceptado', titulo: 'Aceptado' },
  { estado: 'descartado', titulo: 'Descartado' },
  { estado: 'cancelada', titulo: 'Retiradas' }
];

const ETIQUETAS_ESTADO = {
  postulado: 'Postulado', en_revision: 'En revisión', entrevista: 'Entrevista',
  aceptado: 'Aceptado', descartado: 'Descartado', cancelada: 'Retirada'
};

// Estados "inactivos" (gris) en los badges.
const ESTADOS_INACTIVOS = ['descartado', 'cancelada'];
// Estados desde los que el candidato puede retirar su postulación.
const ESTADOS_CANCELABLES = ['postulado', 'en_revision'];
// Estados en los que la mentoría IA ya se realizó (puede consultarse).
const ESTADOS_CON_MENTORIA = ['entrevista', 'aceptado'];

// SVG inline reutilizables (iconos minimalistas, heredan currentColor).
const SVG_RETIRAR = '<svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';
const SVG_VER_MENTORIA = '<svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

async function cargarTablero() {
  const contenedor = document.getElementById('contenedor-tablero');
  const respuesta = await apiFetch('/api/postulaciones');

  if (!respuesta || !respuesta.ok) {
    contenedor.innerHTML = '<div class="spinner-carga">No se pudieron cargar tus postulaciones.</div>';
    return;
  }

  postulacionesCargadas = respuesta.datos.postulaciones;
  renderizarVistaActual();
}

function renderizarVistaActual() {
  if (postulacionesCargadas.length === 0) {
    document.getElementById('contenedor-tablero').innerHTML = `
      <div class="estado-vacio">
        <img src="img/logo-perfil3601.png" alt="" class="mascota-flotante" style="width:70px; margin-bottom:14px;" />
        <p>No tienes postulaciones activas. Explora las vacantes para postularte</p>
        <a href="vacantes.html" class="btn-primario" style="display:inline-flex; width:auto; margin-top:10px; text-decoration:none;">Ver vacantes recomendadas</a>
      </div>`;
    return;
  }

  if (vistaActual === 'tabla') {
    renderizarTabla(postulacionesCargadas);
  } else {
    renderizarTableroKanban(postulacionesCargadas);
  }
}

function renderizarTabla(postulaciones) {
  const contenedor = document.getElementById('contenedor-tablero');

  const filas = postulaciones.map(p => `
    <tr style="cursor:pointer;" data-id="${p.id}">
      <td>
        <div class="tabla-postulaciones-fila-vacante">
          <img src="img/logo-perfil3601.png" alt="" />
          <span>${p.titulo}</span>
        </div>
      </td>
      <td>${p.empresa}</td>
      <td style="text-transform:capitalize;">${p.modalidad}</td>
      <td><span class="badge-estado ${ESTADOS_INACTIVOS.includes(p.estado) ? 'badge-estado--inactiva' : 'badge-estado--activa'}">${ETIQUETAS_ESTADO[p.estado]}</span></td>
      <td>${new Date(p.actualizado_en).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
    </tr>
  `).join('');

  contenedor.innerHTML = `
    <div class="tarjeta" style="padding:0; overflow-x:auto;">
      <table class="tabla-simple">
        <thead>
          <tr><th>Vacante</th><th>Empresa</th><th>Modalidad</th><th>Estado</th><th>Última actualización</th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;

  contenedor.querySelectorAll('tr[data-id]').forEach(fila => {
    fila.addEventListener('click', () => abrirDetalle(fila.dataset.id));
  });
}

function renderizarTableroKanban(postulaciones) {
  const contenedor = document.getElementById('contenedor-tablero');

  const tablero = document.createElement('div');
  tablero.className = 'kanban';

  COLUMNAS.forEach(columna => {
    const items = postulaciones.filter(p => p.estado === columna.estado);

    const columnaDiv = document.createElement('div');
    columnaDiv.className = `kanban-columna kanban-columna--${columna.estado}`;
    columnaDiv.innerHTML = `
      <div class="kanban-columna__titulo">
        <span>${columna.titulo}</span>
        <span class="kanban-columna__contador">${items.length}</span>
      </div>
    `;

    if (items.length === 0) {
      const vacio = document.createElement('div');
      vacio.className = 'kanban-columna__vacio';
      vacio.textContent = 'Sin postulaciones';
      columnaDiv.appendChild(vacio);
    }

    items.forEach(item => {
      const tarjeta = document.createElement('div');
      tarjeta.className = `kanban-tarjeta kanban-tarjeta--${item.estado}`;

      // En 'entrevista' mostramos el "Check de Preparación": la tarjeta ya
      // pasó por la mentoría técnica IA.
      const checkPreparacion = item.estado === 'entrevista'
        ? `<span class="kanban-tarjeta__check" title="Mentoría técnica IA completada"><svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Preparación completada</span>`
        : '';

      tarjeta.innerHTML = `
        <h5>${item.titulo}</h5>
        <p>${item.empresa} · <span style="text-transform:capitalize;">${item.modalidad}</span></p>
        ${checkPreparacion}
        <span class="kanban-tarjeta__fecha">${new Date(item.actualizado_en).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
      `;

      // Contenedor de acciones de la tarjeta (botones apilados).
      const acciones = document.createElement('div');
      acciones.className = 'kanban-tarjeta__acciones';

      // En 'en_revision' la mentoría IA es obligatoria para avanzar: se
      // muestra un botón que abre el simulador inmersivo.
      if (item.estado === 'en_revision') {
        const botonMentoria = document.createElement('button');
        botonMentoria.className = 'btn-mentoria-ia';
        botonMentoria.innerHTML = '<span class="btn-mentoria-ia__icono" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><path d="M9 13h.01M15 13h.01"/><path d="M4 14H2M22 14h-2"/></svg></span> Mentoría IA Obligatoria';
        botonMentoria.addEventListener('click', (e) => {
          e.stopPropagation(); // no abrir el panel de detalle al pulsar el botón
          abrirSimuladorIA(item.id, item.titulo, item.empresa);
        });
        acciones.appendChild(botonMentoria);
      }

      // Si la postulación ya pasó por la mentoría, botón para consultarla.
      if (item.tiene_mentoria || ESTADOS_CON_MENTORIA.includes(item.estado)) {
        const botonVer = document.createElement('button');
        botonVer.className = 'btn-ver-mentoria';
        botonVer.innerHTML = `<span class="btn-ver-mentoria__icono" aria-hidden="true">${SVG_VER_MENTORIA}</span> Ver Mentoría IA Realizada`;
        botonVer.addEventListener('click', (e) => {
          e.stopPropagation();
          verMentoriaRealizada(item.id, item.titulo, item.empresa);
        });
        acciones.appendChild(botonVer);
      }

      // Retirar postulación: solo en estados cancelables.
      if (ESTADOS_CANCELABLES.includes(item.estado)) {
        const botonRetirar = document.createElement('button');
        botonRetirar.className = 'btn-retirar';
        botonRetirar.innerHTML = `${SVG_RETIRAR} Retirar Postulación`;
        botonRetirar.addEventListener('click', (e) => {
          e.stopPropagation();
          retirarPostulacion(item.id, item.titulo);
        });
        acciones.appendChild(botonRetirar);
      }

      if (acciones.children.length > 0) tarjeta.appendChild(acciones);

      tarjeta.addEventListener('click', () => abrirDetalle(item.id));
      columnaDiv.appendChild(tarjeta);
    });

    tablero.appendChild(columnaDiv);
  });

  contenedor.innerHTML = '';
  contenedor.appendChild(tablero);

  // Tras pintar el tablero, arrancamos el mock de avance automático para
  // las tarjetas que sigan en 'postulado'.
  programarAvanceAutomatico();
}

// --------------------------------------------------------------
// Mock de Avance Automático (frontend). Identifica las tarjetas en
// estado 'postulado' y, tras un retardo (RETARDO_AVANCE_MS), dispara el
// PATCH que simula la acción de la empresa (mover a 'en_revision') y
// recarga el tablero.
//
// Se controla con un Set para no disparar dos veces la misma tarjeta si
// el tablero se vuelve a renderizar antes de que el temporizador corra.
// --------------------------------------------------------------
const avanceProgramado = new Set();

// Retardo (ms) antes de que el mock avance una postulación de 'postulado'
// a 'en_revision'. Se dejó en 7s para que el candidato alcance a ver y usar
// el botón "Retirar Postulación" antes de que avance sola. Ajusta aquí.
const RETARDO_AVANCE_MS = 7000;

function programarAvanceAutomatico() {
  const pendientes = postulacionesCargadas.filter(p => p.estado === 'postulado');
  if (pendientes.length === 0) return;

  pendientes.forEach(p => {
    if (avanceProgramado.has(p.id)) return; // ya tiene un temporizador en curso
    avanceProgramado.add(p.id);

    setTimeout(async () => {
      const respuesta = await apiFetch(`/api/postulaciones/${p.id}/avanzar-revision`, { method: 'PATCH' });
      avanceProgramado.delete(p.id);

      if (respuesta && respuesta.ok && respuesta.datos.avanzada) {
        mostrarToast(`"${p.titulo}" pasó a En revisión.`, 'exito');
        await cargarTablero(); // recarga para reflejar el nuevo estado
      }
    }, RETARDO_AVANCE_MS);
  });
}

async function abrirDetalle(postulacionId) {
  const overlay = document.getElementById('overlay-detalle');
  overlay.classList.add('visible');

  document.getElementById('detalle-titulo-vacante').textContent = 'Cargando...';
  document.getElementById('detalle-empresa-modalidad').textContent = '';
  document.getElementById('detalle-badge-estado').textContent = '';
  document.getElementById('detalle-historial').innerHTML = '';

  const respuesta = await apiFetch(`/api/postulaciones/${postulacionId}`);
  if (!respuesta || !respuesta.ok) {
    mostrarToast('No se pudo cargar el detalle de la postulación.', 'error');
    cerrarDetalle();
    return;
  }

  const { postulacion, historial } = respuesta.datos;

  document.getElementById('detalle-titulo-vacante').textContent = postulacion.titulo;
  document.getElementById('detalle-empresa-modalidad').textContent = `${postulacion.empresa} · ${postulacion.modalidad}`;

  const badge = document.getElementById('detalle-badge-estado');
  badge.textContent = ETIQUETAS_ESTADO[postulacion.estado];
  badge.className = `badge-estado ${ESTADOS_INACTIVOS.includes(postulacion.estado) ? 'badge-estado--inactiva' : 'badge-estado--activa'}`;

  const contenedorHistorial = document.getElementById('detalle-historial');
  contenedorHistorial.innerHTML = historial.map(h => `
    <div class="timeline-item">
      <div class="timeline-item__fecha">${new Date(h.fecha).toLocaleString('es-CO')}</div>
      <div class="timeline-item__estado">${ETIQUETAS_ESTADO[h.estado]}</div>
      <div class="timeline-item__motivo">${h.motivo}</div>
    </div>
  `).join('');

  // Acciones dentro del panel de detalle, según el estado de la postulación.
  const acciones = document.getElementById('detalle-acciones');
  acciones.innerHTML = '';

  if (postulacion.tiene_mentoria || ESTADOS_CON_MENTORIA.includes(postulacion.estado)) {
    const btnVer = document.createElement('button');
    btnVer.className = 'btn-ver-mentoria';
    btnVer.innerHTML = `<span class="btn-ver-mentoria__icono" aria-hidden="true">${SVG_VER_MENTORIA}</span> Ver Mentoría IA Realizada`;
    btnVer.addEventListener('click', () => verMentoriaRealizada(postulacion.id, postulacion.titulo, postulacion.empresa));
    acciones.appendChild(btnVer);
  }

  if (ESTADOS_CANCELABLES.includes(postulacion.estado)) {
    const btnRetirar = document.createElement('button');
    btnRetirar.className = 'btn-retirar btn-retirar--bloque';
    btnRetirar.innerHTML = `${SVG_RETIRAR} Retirar Postulación`;
    btnRetirar.addEventListener('click', () => retirarPostulacion(postulacion.id, postulacion.titulo, true));
    acciones.appendChild(btnRetirar);
  }
}

// --------------------------------------------------------------
// RETIRAR POSTULACIÓN (cancelar con confirmación)
// Pide confirmación, dispara PATCH /:id/cancelar y refresca el tablero.
// `cerrarPanel` indica si hay que cerrar el panel de detalle al terminar.
// --------------------------------------------------------------
async function retirarPostulacion(postulacionId, titulo, cerrarPanel = false) {
  const confirmado = await confirmarAccion({
    titulo: 'Retirar postulación',
    mensaje: `¿Seguro que quieres retirar tu postulación a "${titulo}"? Esta acción no la elimina, pero la marcará como retirada.`,
    textoConfirmar: 'Sí, retirar',
    textoCancelar: 'Cancelar'
  });
  if (!confirmado) return;

  const respuesta = await apiFetch(`/api/postulaciones/${postulacionId}/cancelar`, { method: 'PATCH' });

  if (respuesta && respuesta.ok) {
    mostrarToast('Postulación retirada.', 'exito');
    if (cerrarPanel) cerrarDetalle();
    await cargarTablero();
  } else {
    mostrarToast((respuesta && respuesta.datos && respuesta.datos.mensaje) || 'No se pudo retirar la postulación.', 'error');
  }
}

function cerrarDetalle() {
  document.getElementById('overlay-detalle').classList.remove('visible');
}

// ==============================================================
// SIMULADOR DE ENTREVISTA IA INMERSIVO (mentoría obligatoria)
// --------------------------------------------------------------
// Flujo:
//   1. abrirSimuladorIA(): abre un modal con spinner y llama a
//      POST /api/postulaciones/:id/simular.
//   2. renderizarSimulacion(): pinta el JSON (introducción, 2 preguntas
//      técnicas sobre debilidades, escenario conductual, consejos).
//   3. Al cerrar el modal: PATCH /completar-simulacion -> la tarjeta
//      avanza a 'Entrevista' con su "Check de Preparación".
// ==============================================================

let simulacionActivaId = null;      // postulación cuya mentoría está abierta
let simulacionCompletable = false;  // true solo si la IA respondió correctamente
let simulacionDatos = null;         // JSON de la mentoría generada (para persistir)
let simulacionSoloLectura = false;  // true cuando se abre en modo "Ver mentoría"

function obtenerOverlaySimulador() {
  let overlay = document.getElementById('overlay-simulador');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'overlay-simulador';
  overlay.className = 'modal-overlay simulador-overlay';
  overlay.innerHTML = `
    <div class="modal-card simulador-card" role="dialog" aria-modal="true" aria-labelledby="simulador-titulo">
      <button class="panel-lateral__cerrar simulador-cerrar" id="btn-cerrar-simulador" aria-label="Cerrar mentoría"><svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      <div class="simulador-encabezado">
        <span class="simulador-badge"><svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><path d="M9 13h.01M15 13h.01"/><path d="M4 14H2M22 14h-2"/></svg> Mentoría técnica IA</span>
        <h3 id="simulador-titulo">Preparando tu entrevista...</h3>
        <p id="simulador-subtitulo" class="simulador-subtitulo"></p>
      </div>
      <div id="simulador-cuerpo" class="simulador-cuerpo"></div>
      <div class="simulador-pie">
        <button class="btn-primario" id="btn-finalizar-simulador" disabled>
          <span class="spinner" id="spinner-finalizar"></span>
          <span id="texto-finalizar">Generando mentoría...</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Cerrar desde la X o el botón "Finalizar y avanzar".
  overlay.querySelector('#btn-cerrar-simulador').addEventListener('click', cerrarSimuladorIA);
  overlay.querySelector('#btn-finalizar-simulador').addEventListener('click', cerrarSimuladorIA);
  // Clic fuera de la tarjeta también cierra (y dispara el avance).
  overlay.addEventListener('click', (e) => {
    if (e.target.id === 'overlay-simulador') cerrarSimuladorIA();
  });

  return overlay;
}

async function abrirSimuladorIA(postulacionId, titulo, empresa) {
  simulacionActivaId = postulacionId;
  simulacionCompletable = false;
  simulacionDatos = null;
  simulacionSoloLectura = false;

  const overlay = obtenerOverlaySimulador();
  overlay.classList.add('visible');
  // El pie (botón "Finalizar y avanzar") solo aplica en modo mentoría activa.
  const pie = overlay.querySelector('.simulador-pie');
  if (pie) pie.style.display = '';

  document.getElementById('simulador-titulo').textContent = 'Preparando tu entrevista...';
  document.getElementById('simulador-subtitulo').textContent = `${titulo} · ${empresa}`;

  // Estado de carga: spinner inmersivo mientras la IA responde.
  document.getElementById('simulador-cuerpo').innerHTML = `
    <div class="simulador-cargando">
      <span class="spinner spinner--grande visible"></span>
      <p>Tu mentor técnico IA está analizando tu perfil y las habilidades que debes reforzar...</p>
    </div>
  `;

  const boton = document.getElementById('btn-finalizar-simulador');
  boton.disabled = true;
  document.getElementById('spinner-finalizar').classList.add('visible');
  document.getElementById('texto-finalizar').textContent = 'Generando mentoría...';

  const respuesta = await apiFetch(`/api/postulaciones/${postulacionId}/simular`, { method: 'POST' });

  // El modal pudo cerrarse mientras llegaba la respuesta.
  if (simulacionActivaId !== postulacionId) return;

  if (!respuesta || !respuesta.ok) {
    document.getElementById('simulador-cuerpo').innerHTML = `
      <div class="simulador-error">
        <p>No pudimos generar tu mentoría en este momento.</p>
        <p class="simulador-error__detalle">${(respuesta && respuesta.datos && respuesta.datos.mensaje) || 'Intenta de nuevo en unos segundos.'}</p>
        <button class="btn-secundario" id="btn-reintentar-simulador">Reintentar</button>
      </div>
    `;
    document.getElementById('btn-reintentar-simulador')
      .addEventListener('click', () => abrirSimuladorIA(postulacionId, titulo, empresa));

    // Sin simulación válida no forzamos el avance al cerrar.
    simulacionCompletable = false;
    document.getElementById('spinner-finalizar').classList.remove('visible');
    document.getElementById('texto-finalizar').textContent = 'Cerrar';
    document.getElementById('btn-finalizar-simulador').disabled = false;
    return;
  }

  renderizarSimulacion(respuesta.datos);

  // Guardamos el JSON generado para poder persistirlo al finalizar.
  simulacionDatos = respuesta.datos;
  simulacionCompletable = true;
  document.getElementById('spinner-finalizar').classList.remove('visible');
  document.getElementById('texto-finalizar').textContent = 'Finalizar y avanzar a Entrevista';
  document.getElementById('btn-finalizar-simulador').disabled = false;
}

// --------------------------------------------------------------
// VER MENTORÍA IA REALIZADA (modo lectura)
// Abre el mismo modal del simulador pero cargando la mentoría ya guardada
// en la BD (GET /:id/mentoria) y SIN el botón de "Finalizar y avanzar".
// --------------------------------------------------------------
async function verMentoriaRealizada(postulacionId, titulo, empresa) {
  simulacionActivaId = null;        // modo lectura: no dispara avances
  simulacionCompletable = false;
  simulacionSoloLectura = true;

  const overlay = obtenerOverlaySimulador();
  overlay.classList.add('visible');

  // En modo lectura ocultamos el pie (no hay nada que "finalizar").
  const pie = overlay.querySelector('.simulador-pie');
  if (pie) pie.style.display = 'none';

  document.getElementById('simulador-titulo').textContent = 'Mentoría IA realizada';
  document.getElementById('simulador-subtitulo').textContent = `${titulo} · ${empresa}`;
  document.getElementById('simulador-cuerpo').innerHTML = `
    <div class="simulador-cargando">
      <span class="spinner spinner--grande visible"></span>
      <p>Cargando tu mentoría guardada...</p>
    </div>
  `;

  const respuesta = await apiFetch(`/api/postulaciones/${postulacionId}/mentoria`);

  if (!respuesta || !respuesta.ok || !respuesta.datos || !respuesta.datos.mentoria) {
    document.getElementById('simulador-cuerpo').innerHTML = `
      <div class="simulador-error">
        <p>No encontramos una mentoría guardada para esta postulación.</p>
        <p class="simulador-error__detalle">${(respuesta && respuesta.datos && respuesta.datos.mensaje) || ''}</p>
      </div>
    `;
    return;
  }

  // El contenido guardado tiene la misma forma que la respuesta de /simular.
  renderizarSimulacion(respuesta.datos.mentoria);
  document.getElementById('simulador-titulo').textContent = 'Mentoría IA realizada';
}

function renderizarSimulacion(datos) {
  const { vacante, habilidades_faltantes, simulacion } = datos;

  document.getElementById('simulador-titulo').textContent = 'Tu mentoría técnica está lista';
  if (vacante) {
    document.getElementById('simulador-subtitulo').textContent = `${vacante.titulo} · ${vacante.empresa}`;
  }

  const chipsFaltantes = (habilidades_faltantes && habilidades_faltantes.length > 0)
    ? `<div class="simulador-seccion">
         <h4>Debilidades a reforzar</h4>
         <div class="chips-contenedor">
           ${habilidades_faltantes.map(h => `<span class="skill-chip skill-chip--falta">${h}</span>`).join('')}
         </div>
       </div>`
    : `<div class="simulador-seccion">
         <p class="simulador-nota">Dominas las habilidades clave de la vacante. La mentoría se enfoca en afianzar tu nivel.</p>
       </div>`;

  const preguntas = (simulacion.preguntas_tecnicas || []).map((p, i) => `
    <div class="simulador-pregunta">
      <div class="simulador-pregunta__num">P${i + 1}</div>
      <div class="simulador-pregunta__cuerpo">
        <p class="simulador-pregunta__texto">${p.pregunta || ''}</p>
        ${p.habilidad ? `<span class="skill-chip skill-chip--falta simulador-pregunta__skill">${p.habilidad}</span>` : ''}
        ${p.pista ? `<p class="simulador-pregunta__pista"><strong>Pista:</strong> ${p.pista}</p>` : ''}
      </div>
    </div>
  `).join('');

  const escenario = simulacion.escenario_conductual || {};
  const consejos = (simulacion.consejos_preparacion || []).map(c => `<li>${c}</li>`).join('');

  document.getElementById('simulador-cuerpo').innerHTML = `
    <p class="simulador-intro">${simulacion.introduccion || ''}</p>

    ${chipsFaltantes}

    <div class="simulador-seccion">
      <h4>Preguntas técnicas</h4>
      ${preguntas || '<p class="simulador-nota">No se generaron preguntas técnicas.</p>'}
    </div>

    <div class="simulador-seccion">
      <h4>Escenario conductual</h4>
      <div class="simulador-escenario">
        <p>${escenario.situacion || ''}</p>
        ${escenario.que_evalua ? `<p class="simulador-escenario__evalua"><strong>Evalúa:</strong> ${escenario.que_evalua}</p>` : ''}
      </div>
    </div>

    <div class="simulador-seccion">
      <h4>Consejos de preparación</h4>
      <ul class="simulador-consejos">${consejos || '<li>Repasa los fundamentos del cargo.</li>'}</ul>
    </div>
  `;
}

async function cerrarSimuladorIA() {
  const overlay = document.getElementById('overlay-simulador');
  const postulacionId = simulacionActivaId;

  // Modo lectura ("Ver mentoría"): solo cerrar, sin avances ni persistencia.
  if (simulacionSoloLectura) {
    simulacionSoloLectura = false;
    if (overlay) overlay.classList.remove('visible');
    return;
  }

  // Si la mentoría no se generó bien, solo cerramos el modal sin avanzar.
  if (!simulacionCompletable || !postulacionId) {
    simulacionActivaId = null;
    if (overlay) overlay.classList.remove('visible');
    return;
  }

  // Filtro de preparación: al cerrar, disparamos el PATCH que avanza a
  // 'entrevista'. Mostramos spinner en el botón mientras se registra.
  const boton = document.getElementById('btn-finalizar-simulador');
  if (boton) {
    boton.disabled = true;
    document.getElementById('spinner-finalizar').classList.add('visible');
    document.getElementById('texto-finalizar').textContent = 'Registrando preparación...';
  }

  // Enviamos el JSON de la mentoría para que quede guardado en la BD y
  // pueda consultarse después en modo lectura.
  const respuesta = await apiFetch(`/api/postulaciones/${postulacionId}/completar-simulacion`, {
    method: 'PATCH',
    body: JSON.stringify({ mentoria: simulacionDatos })
  });

  simulacionActivaId = null;
  simulacionCompletable = false;
  simulacionDatos = null;
  if (overlay) overlay.classList.remove('visible');

  if (respuesta && respuesta.ok) {
    mostrarToast('¡Mentoría completada! Avanzaste a Entrevista.', 'exito');
    if (typeof lanzarConfeti === 'function') lanzarConfeti();
    await cargarTablero(); // refleja el nuevo estado + "Check de Preparación"
  } else {
    mostrarToast((respuesta && respuesta.datos && respuesta.datos.mensaje) || 'No se pudo registrar la preparación.', 'error');
  }
}
