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
    mostrarMascotaGuia('mascota-bienvenida', `¡Hola! Desde aquí puedes sincronizar y administrar las vacantes de Magneto.`);

  } else {
    construirNavbarCandidato('dashboard.html');
    document.getElementById('titulo-bienvenida').textContent = `¡Hola de nuevo!`;
    document.getElementById('subtitulo-bienvenida').textContent = `Sesión iniciada como ${usuario.correo}`;
    document.getElementById('vista-candidato').style.display = 'block';

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

async function cargarCompletitud() {
  const respuesta = await apiFetch('/api/perfil');
  if (!respuesta || !respuesta.ok) return;

  const { completitud, faltantes } = respuesta.datos;

  document.getElementById('texto-porcentaje').textContent = `${completitud}%`;
  document.getElementById('barra-relleno').style.width = `${completitud}%`;

  const lista = document.getElementById('lista-faltantes');
  lista.innerHTML = '';

  // Mascota contextual segun que tan avanzado esta el perfil
  if (completitud === 0) {
    mostrarMascotaGuia('mascota-bienvenida', '¡Empecemos! Cuéntame sobre ti para poder recomendarte las mejores vacantes.');
  } else if (completitud < 100) {
    mostrarMascotaGuia('mascota-bienvenida', `Vas muy bien, ${completitud}% completado. ¡Sigamos!`);
  } else {
    mostrarMascotaGuia('mascota-bienvenida', '¡Tu perfil está completo! Ya puedo recomendarte con toda precisión.');
  }

  if (completitud >= 100) {
    lista.innerHTML = '<li style="color: var(--verde-oscuro);">✓ ¡Tu perfil está completo! Ya puedes ver tus recomendaciones.</li>';

    // Confeti solo la PRIMERA vez que llega a 100% (se recuerda en localStorage
    // para no repetirlo cada vez que visite el dashboard)
    if (!localStorage.getItem('perfil360_confeti_100')) {
      lanzarConfeti();
      localStorage.setItem('perfil360_confeti_100', 'true');
    }
  } else {
    faltantes.forEach(mensaje => {
      const li = document.createElement('li');
      li.textContent = mensaje;
      lista.appendChild(li);
    });
  }

  renderizarLogros(completitud);
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
