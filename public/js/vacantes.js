// Logica de la pantalla "Vacantes recomendadas".
// Cubre HU-RF-006 (recomendacion + explicacion del match),
// HU-RF-008 (filtros) y dispara HU-RF-009 (postular) desde aqui.

const usuario = protegerPagina();
if (usuario) {
  construirNavbarCandidato('vacantes.html');
  activarBotonSalir();
  renderizarWidgetCompletitud();

  document.getElementById('btn-aplicar-filtros').addEventListener('click', cargarVacantes);
  document.getElementById('btn-buscar').addEventListener('click', cargarVacantes);
  document.getElementById('btn-limpiar-filtros').addEventListener('click', limpiarFiltros);
  document.getElementById('btn-cerrar-match').addEventListener('click', cerrarModalMatch);

  // Enter en la barra de busqueda dispara la busqueda.
  document.getElementById('buscador-texto').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); cargarVacantes(); }
  });

  cargarVacantes();
}

// Validacion estricta del rango salarial de los filtros. Devuelve true si
// es valido; si no, muestra una alerta amigable y deja los campos marcados.
function validarRangoSalarioFiltros() {
  const campoMin = document.getElementById('filtro-salario-min');
  const campoMax = document.getElementById('filtro-salario-max');
  const errorBox = document.getElementById('filtros-error');

  const minTexto = campoMin.value.trim();
  const maxTexto = campoMax.value.trim();

  // Limpieza previa
  campoMin.classList.remove('campo--error');
  campoMax.classList.remove('campo--error');
  errorBox.classList.remove('visible');
  errorBox.textContent = '';

  if (minTexto === '' || maxTexto === '') return true; // sin rango que comparar

  const min = Number(minTexto);
  const max = Number(maxTexto);

  if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
    campoMin.classList.add('campo--error');
    campoMax.classList.add('campo--error');
    errorBox.textContent = 'El salario mínimo no puede ser mayor que el máximo. Corrige el rango para buscar.';
    errorBox.classList.add('visible');
    return false;
  }
  return true;
}

function limpiarFiltros() {
  document.getElementById('buscador-texto').value = '';
  document.getElementById('filtro-modalidad').value = '';
  document.getElementById('filtro-nivel').value = '';
  document.getElementById('filtro-salario-min').value = '';
  document.getElementById('filtro-salario-max').value = '';
  document.getElementById('filtro-salario-min').classList.remove('campo--error');
  document.getElementById('filtro-salario-max').classList.remove('campo--error');
  document.getElementById('filtros-error').classList.remove('visible');
  cargarVacantes();
}

function claseMatch(porcentaje) {
  if (porcentaje >= 70) return 'match-alto';
  if (porcentaje >= 40) return 'match-medio';
  return 'match-bajo';
}

// Iconos SVG limpios para la meta-info de cada vacante (sin emojis).
function iconoMeta(tipo) {
  const base = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const paths = {
    empresa: '<path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M19 21V9a2 2 0 0 0-2-2h-2"/><path d="M9 7h2M9 11h2M9 15h2"/>',
    modalidad: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z"/><circle cx="12" cy="11" r="2"/>',
    salario: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.5a2.6 2.6 0 0 0-2.8-1.5c-1.6 0-2.6.9-2.6 2 0 2.8 5.4 1.4 5.4 4.2 0 1.2-1.1 2.1-2.8 2.1a2.8 2.8 0 0 1-2.9-1.7"/><path d="M12 6.5v11"/>',
    nivel: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5"/>'
  };
  return `<svg class="meta-icono" ${base}>${paths[tipo] || ''}</svg>`;
}

function construirQueryFiltros() {
  const params = new URLSearchParams();
  const buscar = document.getElementById('buscador-texto').value.trim();
  const modalidad = document.getElementById('filtro-modalidad').value;
  const salarioMin = document.getElementById('filtro-salario-min').value;
  const salarioMax = document.getElementById('filtro-salario-max').value;
  const nivel = document.getElementById('filtro-nivel').value;

  if (buscar) params.set('buscar', buscar);
  if (modalidad) params.set('modalidad', modalidad);
  if (salarioMin) params.set('salario_min', salarioMin);
  if (salarioMax) params.set('salario_max', salarioMax);
  if (nivel) params.set('nivel_educativo', nivel);

  return params.toString();
}

async function cargarVacantes() {
  // Validacion estricta: si el rango salarial es incoherente, no se busca.
  if (!validarRangoSalarioFiltros()) {
    mostrarToast('Revisa el rango salarial: el mínimo no puede superar al máximo.', 'error');
    return;
  }

  const contenedor = document.getElementById('contenedor-vacantes');
  const alertaPerfil = document.getElementById('alerta-perfil-incompleto');
  contenedor.innerHTML = '<div class="spinner-carga">Cargando vacantes...</div>';
  alertaPerfil.classList.remove('visible');

  const query = construirQueryFiltros();
  const respuesta = await apiFetch(`/api/vacantes/recomendadas${query ? `?${query}` : ''}`);

  if (!respuesta || !respuesta.ok) {
    contenedor.innerHTML = '<div class="spinner-carga">No se pudieron cargar las vacantes.</div>';
    return;
  }

  const { vacantes, perfil_incompleto } = respuesta.datos;

  if (perfil_incompleto) {
    alertaPerfil.textContent = 'Aún no has completado tu perfil, así que no podemos calcular tu coincidencia real con precisión. ';
    const link = document.createElement('a');
    link.href = 'perfil.html';
    link.textContent = 'Completa tu perfil aquí.';
    link.style.color = 'inherit';
    link.style.fontWeight = '700';
    alertaPerfil.appendChild(link);
    alertaPerfil.classList.add('visible');
  }

  if (vacantes.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <img src="img/logo-perfil3601.png" alt="" class="mascota-flotante" style="width:70px; margin-bottom:14px;" />
        <p>No se encontraron vacantes con los criterios seleccionados. Intenta ajustar los filtros</p>
      </div>`;
    return;
  }

  contenedor.innerHTML = '';
  vacantes.forEach(v => contenedor.appendChild(crearTarjetaVacante(v)));
}

function formatearSalario(valor) {
  return `$${Number(valor).toLocaleString('es-CO')}`;
}

const ETIQUETAS_NIVEL = {
  bachiller: 'Bachiller', tecnico: 'Técnico', tecnologo: 'Tecnólogo',
  pregrado: 'Pregrado', posgrado: 'Posgrado', maestria: 'Maestría', doctorado: 'Doctorado'
};

function crearTarjetaVacante(vacante) {
  const card = document.createElement('div');
  card.className = 'vacante-card';
  const modalidadLabel = vacante.modalidad.charAt(0).toUpperCase() + vacante.modalidad.slice(1);
  card.innerHTML = `
    <div class="vacante-card__info">
      <h4>${vacante.titulo}</h4>
      <div class="vacante-card__meta">
        <span class="vacante-meta__item">${iconoMeta('empresa')} ${vacante.empresa}</span>
        <span class="vacante-meta__item">${iconoMeta('modalidad')} ${modalidadLabel}</span>
        <span class="vacante-meta__item">${iconoMeta('salario')} ${formatearSalario(vacante.salario_min)} - ${formatearSalario(vacante.salario_max)}</span>
        <span class="vacante-meta__item">${iconoMeta('nivel')} ${ETIQUETAS_NIVEL[vacante.nivel_educativo_requerido] || vacante.nivel_educativo_requerido}</span>
      </div>
    </div>
    <div class="vacante-card__match">
      <div class="match-circulo ${claseMatch(vacante.match_porcentaje)}">${vacante.match_porcentaje}%</div>
      <span style="font-size:11px; color:var(--gris-texto);">coincidencia</span>
    </div>
    <div class="vacante-card__acciones">
      <button class="btn-chico secundario" data-accion="ver-match">Ver detalle del match</button>
      <button class="btn-chico primario" data-accion="postular">Postular</button>
    </div>
  `;

  card.querySelector('[data-accion="ver-match"]').addEventListener('click', () => abrirModalMatch(vacante.id, vacante.titulo));
  card.querySelector('[data-accion="postular"]').addEventListener('click', (e) => postularAVacante(vacante.id, e.target));

  return card;
}

// ================================================================
// Modal de detalle del match (HU-RF-006, 2do criterio)
// ================================================================

async function abrirModalMatch(vacanteId, titulo) {
  const modal = document.getElementById('modal-match');
  document.getElementById('match-titulo-vacante').textContent = titulo;
  document.getElementById('match-porcentaje-grande').textContent = '...';
  document.getElementById('match-habilidades-ok').innerHTML = '';
  document.getElementById('match-habilidades-falta').innerHTML = '';
  document.getElementById('match-nivel-educativo').textContent = '';
  modal.classList.add('visible');

  const respuesta = await apiFetch(`/api/vacantes/${vacanteId}/match`);
  if (!respuesta || !respuesta.ok) {
    mostrarToast('No se pudo calcular el detalle del match.', 'error');
    return;
  }

  const { match_porcentaje, habilidades_coincidentes, habilidades_faltantes, cumple_nivel_educativo, nivel_educativo_requerido, explicacion, motor_usado } = respuesta.datos;

  document.getElementById('match-porcentaje-grande').textContent = `${match_porcentaje}%`;

  const contOk = document.getElementById('match-habilidades-ok');
  contOk.innerHTML = habilidades_coincidentes.length
    ? habilidades_coincidentes.map(h => `<span class="skill-chip skill-chip--ok">${h}</span>`).join('')
    : '<span style="font-size:12.5px; color:var(--gris-texto);">Ninguna todavía.</span>';

  const contFalta = document.getElementById('match-habilidades-falta');
  contFalta.innerHTML = habilidades_faltantes.length
    ? habilidades_faltantes.map(h => `<span class="skill-chip skill-chip--falta">${h}</span>`).join('')
    : '<span style="font-size:12.5px; color:var(--gris-texto);">¡Ninguna! Cumples con todas.</span>';

  const nivelEl = document.getElementById('match-nivel-educativo');
  nivelEl.className = cumple_nivel_educativo ? 'match-nivel match-nivel--ok' : 'match-nivel match-nivel--no';
  nivelEl.textContent = cumple_nivel_educativo
    ? `Tu nivel educativo cumple con lo requerido (${ETIQUETAS_NIVEL[nivel_educativo_requerido]}).`
    : `Esta vacante requiere nivel educativo: ${ETIQUETAS_NIVEL[nivel_educativo_requerido]}.`;

  document.getElementById('match-explicacion').textContent = explicacion || '';
  document.getElementById('match-motor-usado').textContent = `Motor usado: ${motor_usado === 'ia' ? 'Inteligencia artificial (Groq)' : 'Algoritmo propio'}`;
}

function cerrarModalMatch() {
  document.getElementById('modal-match').classList.remove('visible');
}

// ================================================================
// Postular (HU-RF-009)
// ================================================================

async function postularAVacante(vacanteId, boton) {
  boton.disabled = true;
  boton.textContent = 'Enviando...';

  const respuesta = await apiFetch('/api/postulaciones', {
    method: 'POST',
    body: JSON.stringify({ vacante_id: vacanteId })
  });

  if (!respuesta) return;

  if (!respuesta.ok) {
    // Cubre el caso de "ya postulaste antes" (409) y otros errores
    mostrarToast(respuesta.datos.mensaje || 'No se pudo registrar tu postulación.', 'error');
    boton.textContent = respuesta.status === 409 ? 'Ya postulado' : 'Postular';
    boton.disabled = respuesta.status === 409;
    return;
  }

  mostrarToast(respuesta.datos.mensaje || 'Postulación registrada exitosamente', 'exito');
  boton.textContent = 'Postulado';
  boton.disabled = true;
  lanzarConfeti();
}
