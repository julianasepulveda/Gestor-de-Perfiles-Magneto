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
  { estado: 'descartado', titulo: 'Descartado' }
];

const ETIQUETAS_ESTADO = {
  postulado: 'Postulado', en_revision: 'En revisión', entrevista: 'Entrevista',
  aceptado: 'Aceptado', descartado: 'Descartado'
};

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
      <td><span class="badge-estado ${p.estado === 'descartado' ? 'badge-estado--inactiva' : 'badge-estado--activa'}">${ETIQUETAS_ESTADO[p.estado]}</span></td>
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
    columnaDiv.className = 'kanban-columna';
    columnaDiv.innerHTML = `
      <div class="kanban-columna__titulo">
        <span>${columna.titulo}</span>
        <span class="kanban-columna__contador">${items.length}</span>
      </div>
    `;

    items.forEach(item => {
      const tarjeta = document.createElement('div');
      tarjeta.className = 'kanban-tarjeta';
      tarjeta.innerHTML = `
        <h5>${item.titulo}</h5>
        <p>${item.empresa} · ${item.modalidad}</p>
      `;
      tarjeta.addEventListener('click', () => abrirDetalle(item.id));
      columnaDiv.appendChild(tarjeta);
    });

    tablero.appendChild(columnaDiv);
  });

  contenedor.innerHTML = '';
  contenedor.appendChild(tablero);
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
  badge.className = `badge-estado ${postulacion.estado === 'descartado' ? 'badge-estado--inactiva' : 'badge-estado--activa'}`;

  const contenedorHistorial = document.getElementById('detalle-historial');
  contenedorHistorial.innerHTML = historial.map(h => `
    <div class="timeline-item">
      <div class="timeline-item__fecha">${new Date(h.fecha).toLocaleString('es-CO')}</div>
      <div class="timeline-item__estado">${ETIQUETAS_ESTADO[h.estado]}</div>
      <div class="timeline-item__motivo">${h.motivo}</div>
    </div>
  `).join('');
}

function cerrarDetalle() {
  document.getElementById('overlay-detalle').classList.remove('visible');
}
