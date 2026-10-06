// Logica del panel principal (dashboard).
// Muestra contenido distinto segun el rol del usuario autenticado,
// mas la mascota contextual, insignias de logros y confeti.

const usuario = protegerPagina();

if (usuario) {
  activarBotonSalir();

  if (usuario.rol === 'admin') {
    document.getElementById('navbar-links').innerHTML = `<a href="admin-vacantes.html">Vacantes</a>`;
    document.getElementById('titulo-bienvenida').textContent = 'Panel de administración';
    document.getElementById('subtitulo-bienvenida').textContent = `Sesión iniciada como ${usuario.correo}`;
    document.getElementById('vista-admin').style.display = 'block';
    mostrarMascotaLimpia('mascota-bienvenida');

  } else {
    construirNavbarCandidato('dashboard.html');
    document.getElementById('titulo-bienvenida').textContent = `¡Hola de nuevo!`;
    document.getElementById('subtitulo-bienvenida').textContent = `Sesión iniciada como ${usuario.correo}`;
    document.getElementById('vista-candidato').style.display = 'block';

    mostrarMascotaLimpia('mascota-bienvenida');
    cargarCompletitud();
    renderizarWidgetCompletitud();
  }
}

const LOGROS = [
  { minimo: 1, icono: '🌱', texto: 'Perfil iniciado' },
  { minimo: 50, icono: '🚀', texto: 'A mitad de camino' },
  { minimo: 75, icono: '⭐', texto: 'Casi listo' },
  { minimo: 100, icono: '🏆', texto: '¡Perfil completo!' }
];

// Catalogo de sugerencias motivadoras. Cada entrada define palabras clave
// que se buscan dentro del texto "faltante" que envia el backend, un icono
// (SVG inline) y un mensaje que explica POR QUE conviene completar ese punto.
// Si el backend cambia el wording, el emparejamiento por palabras clave lo
// sigue reconociendo; y si no coincide con ninguno, hay un fallback generico.
const SVG_DATOS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
const SVG_EDUCACION = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5"/></svg>';
const SVG_EXPERIENCIA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>';
const SVG_HABILIDADES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9Z"/></svg>';
const SVG_GENERICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';

const CATALOGO_SUGERENCIAS = [
  {
    claves: ['datos básicos', 'datos basicos', 'nivel educativo', 'modalidad'],
    icono: SVG_DATOS,
    etiqueta: 'Datos básicos',
    mensaje: 'Completa tus datos básicos para que las empresas puedan ubicarte.',
    porque: 'Tu nivel educativo y tu modalidad preferida son los primeros filtros que aplican los reclutadores. Sin ellos, tu perfil ni siquiera aparece en muchas búsquedas.'
  },
  {
    claves: ['formación', 'formacion', 'académic', 'academic', 'educación', 'educacion'],
    icono: SVG_EDUCACION,
    etiqueta: 'Formación académica',
    mensaje: 'Agrega tu formación académica para respaldar tu perfil.',
    porque: 'Muchas vacantes exigen un nivel educativo mínimo. Registrar tus estudios permite que el motor de match te cruce con esas oportunidades y le da credibilidad a tu perfil.'
  },
  {
    claves: ['experiencia'],
    icono: SVG_EXPERIENCIA,
    etiqueta: 'Experiencia laboral',
    mensaje: 'Agrega tu experiencia para multiplicar tus oportunidades.',
    porque: 'Los reclutadores filtran perfiles con al menos una experiencia registrada. Añadirla te sube en los resultados y demuestra lo que sabes hacer en la práctica.'
  },
  {
    claves: ['habilidad'],
    icono: SVG_HABILIDADES,
    etiqueta: 'Habilidades',
    mensaje: 'Suma tus habilidades para que el match sea más preciso.',
    porque: 'El motor de recomendación cruza tus habilidades con las que exige cada vacante. Entre más habilidades reales registres, más alto será tu porcentaje de coincidencia.'
  }
];

// Dado un texto "faltante" del backend, devuelve la sugerencia enriquecida
// (icono + etiqueta + mensaje motivador + explicacion) que mejor coincide.
function mapearSugerencia(textoFaltante) {
  const texto = (textoFaltante || '').toLowerCase();
  const encontrada = CATALOGO_SUGERENCIAS.find(s => s.claves.some(c => texto.includes(c)));
  if (encontrada) return encontrada;
  // Fallback: usamos el propio texto del backend para no perder informacion.
  return {
    icono: SVG_GENERICO,
    etiqueta: 'Sugerencia',
    mensaje: textoFaltante,
    porque: 'Completar este dato hace tu perfil más robusto y mejora tus recomendaciones de vacantes.'
  };
}

async function cargarCompletitud() {
  const respuesta = await apiFetch('/api/perfil');
  if (!respuesta || !respuesta.ok) return;

  const { completitud, faltantes } = respuesta.datos;

  document.getElementById('texto-porcentaje').textContent = `${completitud}%`;
  document.getElementById('barra-relleno').style.width = `${completitud}%`;

  // El CTA cambia de texto segun el estado del perfil: invita a "completar"
  // cuando aun faltan datos, o a "editar" cuando ya esta al 100%.
  const textoBtnEditar = document.getElementById('texto-btn-editar-perfil');
  if (textoBtnEditar) {
    textoBtnEditar.textContent = completitud >= 100 ? 'Editar Perfil' : 'Completar Perfil';
  }

  renderizarSugerencias(completitud, faltantes || []);

  if (completitud >= 100 && !localStorage.getItem('perfil360_confeti_100')) {
    // Confeti solo la PRIMERA vez que llega a 100%
    lanzarConfeti();
    localStorage.setItem('perfil360_confeti_100', 'true');
  }

  renderizarLogros(completitud);
}

// ================================================================
// SECCION "SUGERENCIAS PARA DESTACAR" (HU-RF-003)
// Cada sugerencia es un acordeon: el encabezado (clicable) muestra el
// titulo + mensaje motivador; al hacer click se despliega el "por que"
// (explicabilidad). La mascota se muestra limpia, sin globo de texto.
// ================================================================
const SVG_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const SVG_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

function renderizarSugerencias(completitud, faltantes) {
  const card = document.getElementById('sugerencias-card');
  const titulo = document.getElementById('sugerencias-titulo');
  const subtitulo = document.getElementById('sugerencias-subtitulo');
  const lista = document.getElementById('sugerencias-lista');
  if (!card || !lista) return;

  lista.innerHTML = '';

  if (completitud >= 100) {
    // --- Perfil completo: mascota celebrando (pulgar arriba) ---
    card.classList.add('sugerencias-card--completo');
    titulo.textContent = '¡Tu perfil está listo para destacar!';
    subtitulo.textContent = 'Completaste todo. Ahora las empresas pueden encontrarte con toda claridad.';

    mostrarMascotaPulgarArriba('sugerencias-mascota');

    const li = document.createElement('li');
    li.className = 'sugerencia-acordeon sugerencia-acordeon--ok';
    li.innerHTML = `
      <div class="sugerencia-acordeon__cabecera" aria-disabled="true">
        <span class="sugerencia-acordeon__icono">${SVG_CHECK}</span>
        <div class="sugerencia-acordeon__titulos">
          <strong>Perfil completo</strong>
          <span>Tienes datos básicos, formación, experiencia y habilidades. ¡Visita tus vacantes recomendadas!</span>
        </div>
      </div>`;
    lista.appendChild(li);
    return;
  }

  // --- Perfil incompleto: mascota limpia + acordeones de sugerencias ---
  card.classList.remove('sugerencias-card--completo');
  titulo.textContent = 'Aumenta tus probabilidades';
  subtitulo.textContent = `Te falta poco (${completitud}% completado). Toca cada sugerencia para saber por qué suma.`;

  mostrarMascotaLimpia('sugerencias-mascota');

  faltantes.forEach(textoFaltante => {
    const sug = mapearSugerencia(textoFaltante);
    lista.appendChild(crearAcordeonSugerencia(sug));
  });
}

// Crea un item de acordeon clicable para una sugerencia.
function crearAcordeonSugerencia(sug) {
  const li = document.createElement('li');
  li.className = 'sugerencia-acordeon';

  const panelId = `sug-panel-${Math.random().toString(36).slice(2, 8)}`;

  li.innerHTML = `
    <button type="button" class="sugerencia-acordeon__cabecera" aria-expanded="false" aria-controls="${panelId}">
      <span class="sugerencia-acordeon__icono">${sug.icono}</span>
      <div class="sugerencia-acordeon__titulos">
        <strong>${sug.etiqueta}</strong>
        <span>${sug.mensaje}</span>
      </div>
      <span class="sugerencia-acordeon__chevron">${SVG_CHEVRON}</span>
    </button>
    <div class="sugerencia-acordeon__panel" id="${panelId}" role="region" hidden>
      <p><span class="sugerencia-acordeon__porque-label">¿Por qué importa?</span> ${sug.porque}</p>
    </div>`;

  const cabecera = li.querySelector('.sugerencia-acordeon__cabecera');
  const panel = li.querySelector('.sugerencia-acordeon__panel');

  cabecera.addEventListener('click', () => {
    const abierto = li.classList.toggle('abierto');
    cabecera.setAttribute('aria-expanded', String(abierto));
    panel.hidden = !abierto;
  });

  return li;
}

function renderizarLogros(completitud) {
  const contenedor = document.getElementById('logros-fila');
  contenedor.innerHTML = LOGROS.map(logro => {
    const desbloqueado = completitud >= logro.minimo;
    return `<div class="logro-chip ${desbloqueado ? 'desbloqueado' : ''}">
      <span class="logro-icono">${logro.icono}</span> ${logro.texto}
    </div>`;
  }).join('');
}
