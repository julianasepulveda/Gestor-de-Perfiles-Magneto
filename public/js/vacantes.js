// Logica de la pantalla "Vacantes recomendadas".
// Cubre HU-RF-006 (recomendacion + explicacion del match),
// HU-RF-008 (filtros) y dispara HU-RF-009 (postular) desde aqui.

const usuario = protegerPagina();
if (usuario) {
  construirNavbarCandidato('vacantes.html');
  activarBotonSalir();
  renderizarWidgetCompletitud();
  document.getElementById('btn-aplicar-filtros').addEventListener('click', cargarVacantes);
  document.getElementById('btn-cerrar-match').addEventListener('click', cerrarModalMatch);
  cargarVacantes();
}

function claseMatch(porcentaje) {
  if (porcentaje >= 70) return 'match-alto';
  if (porcentaje >= 40) return 'match-medio';
  return 'match-bajo';
}

function construirQueryFiltros() {
  const params = new URLSearchParams();
  const modalidad = document.getElementById('filtro-modalidad').value;
  const salarioMin = document.getElementById('filtro-salario-min').value;
  const salarioMax = document.getElementById('filtro-salario-max').value;
  const nivel = document.getElementById('filtro-nivel').value;

  if (modalidad) params.set('modalidad', modalidad);
  if (salarioMin) params.set('salario_min', salarioMin);
  if (salarioMax) params.set('salario_max', salarioMax);
  if (nivel) params.set('nivel_educativo', nivel);

  return params.toString();
}

async function cargarVacantes() {
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
  card.innerHTML = `
    <div class="vacante-card__info">
      <h4>${vacante.titulo}</h4>
      <div class="vacante-card__meta">
        <span>🏢 ${vacante.empresa}</span>
        <span>📍 ${vacante.modalidad}</span>
        <span>💰 ${formatearSalario(vacante.salario_min)} - ${formatearSalario(vacante.salario_max)}</span>
        <span>🎓 ${ETIQUETAS_NIVEL[vacante.nivel_educativo_requerido] || vacante.nivel_educativo_requerido}</span>
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

  document.getElementById('match-nivel-educativo').textContent = cumple_nivel_educativo
    ? `✓ Tu nivel educativo cumple con lo requerido (${ETIQUETAS_NIVEL[nivel_educativo_requerido]}).`
    : `✕ Esta vacante requiere nivel educativo: ${ETIQUETAS_NIVEL[nivel_educativo_requerido]}.`;

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
  boton.textContent = '✓ Postulado';
  boton.disabled = true;
  lanzarConfeti();
}
