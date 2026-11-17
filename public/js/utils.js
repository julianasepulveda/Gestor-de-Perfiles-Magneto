// Utilidades compartidas por las pantallas autenticadas del portal.
// Centraliza el envío del token y el manejo de sesión expirada (DRY).

const API_BASE = '';

/**
 * Protege una página: si no hay sesión válida, limpia el almacenamiento y
 * redirige al login. Se llama al inicio de cada pantalla protegida.
 * @returns {object|null} El usuario guardado, o null si se redirigió.
 */
function protegerPagina() {
  const token = localStorage.getItem('perfil360_token');
  const usuarioTexto = localStorage.getItem('perfil360_usuario');

  // Se rechazan los valores ausentes y los corruptos ('undefined'/'null' como
  // texto): un token literal "undefined" provocaría un 401 en cada petición.
  const tokenValido = token && token !== 'undefined' && token !== 'null';
  const usuarioValido = usuarioTexto && usuarioTexto !== 'undefined' && usuarioTexto !== 'null';

  if (!tokenValido || !usuarioValido) {
    localStorage.removeItem('perfil360_token');
    localStorage.removeItem('perfil360_usuario');
    window.location.href = 'login.html';
    return null;
  }

  try {
    return JSON.parse(usuarioTexto);
  } catch (error) {
    // Dato corrupto: se limpia y se redirige al login.
    localStorage.removeItem('perfil360_token');
    localStorage.removeItem('perfil360_usuario');
    window.location.href = 'login.html';
    return null;
  }
}

/**
 * Protege una página que requiere un rol específico. Si el usuario no lo
 * tiene, lo redirige al dashboard.
 * @param {string[]} rolesPermitidos
 * @returns {object|null} El usuario autorizado, o null si se redirigió.
 */
function protegerPaginaPorRol(rolesPermitidos) {
  const usuario = protegerPagina();
  if (!usuario) return null;

  if (!rolesPermitidos.includes(usuario.rol)) {
    window.location.href = 'dashboard.html';
    return null;
  }
  return usuario;
}

// Construye los enlaces del navbar del candidato marcando la página activa.
function construirNavbarCandidato(paginaActiva) {
  const paginas = [
    { href: 'perfil.html', texto: 'Perfil' },
    { href: 'vacantes.html', texto: 'Vacantes' },
    { href: 'postulaciones.html', texto: 'Postulaciones' }
  ];

  const contenedor = document.getElementById('navbar-links');
  if (!contenedor) return;

  contenedor.innerHTML = paginas
    .map(p => `<a href="${p.href}" class="${p.href === paginaActiva ? 'activo' : ''}">${p.texto}</a>`)
    .join('');
}

function activarBotonSalir() {
  const boton = document.getElementById('btn-salir');
  if (!boton) return;
  boton.addEventListener('click', () => {
    localStorage.removeItem('perfil360_token');
    localStorage.removeItem('perfil360_usuario');
    window.location.href = 'login.html';
  });
}

// Renderiza el widget de completitud del perfil en el navbar del candidato.
async function renderizarWidgetCompletitud() {
  const contenedor = document.getElementById('widget-completitud');
  if (!contenedor) return; // esta página no tiene el widget (ej. admin)

  const respuesta = await apiFetch('/api/perfil');
  if (!respuesta || !respuesta.ok) return;

  const { completitud } = respuesta.datos;

  contenedor.innerHTML = `
    <a href="perfil.html" class="widget-completitud" title="Ver mi perfil">
      <div class="widget-completitud__mascota-track">
        <div class="widget-completitud__barra-fondo">
          <div class="widget-completitud__barra-relleno" style="width:${completitud}%"></div>
        </div>
        <img class="widget-completitud__mascota" src="img/logo-perfil3601.png" alt=""
             style="left: calc(${completitud}% - 11px);" />
      </div>
      <span class="widget-completitud__texto">${completitud}% perfil</span>
    </a>
  `;

  return completitud;
}

// Confeti sin librerías externas para celebrar hitos (perfil al 100%, postular).
function lanzarConfeti() {
  const colores = ['#0CBB4E', '#17C3C0', '#6C5CE7', '#F5A623', '#E4483B'];
  const cantidad = 60;

  for (let i = 0; i < cantidad; i++) {
    const pieza = document.createElement('div');
    pieza.className = 'confeti-pieza';
    pieza.style.left = `${Math.random() * 100}vw`;
    pieza.style.background = colores[Math.floor(Math.random() * colores.length)];
    pieza.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    pieza.style.animationDelay = `${Math.random() * 0.4}s`;
    pieza.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(pieza);
    setTimeout(() => pieza.remove(), 3500);
  }
}

// Inserta la mascota con un globo de texto contextual en el elemento destinoId.
function mostrarMascotaGuia(destinoId, mensaje) {
  const destino = document.getElementById(destinoId);
  if (!destino) return;
  destino.innerHTML = `
    <img src="img/logo-perfil3601.png" alt="Perfil 360" class="mascota-flotante" />
    <div class="globo-texto">${mensaje}</div>
  `;
}

// Inserta la mascota sin globo de texto (solo la imagen flotante).
function mostrarMascotaLimpia(destinoId) {
  const destino = document.getElementById(destinoId);
  if (!destino) return;
  destino.innerHTML = `
    <img src="img/logo-perfil3601.png" alt="Perfil 360" class="mascota-flotante mascota-img" />
  `;
}

// Inserta la mascota celebrando con una insignia de check (perfil al 100%).
function mostrarMascotaPulgarArriba(destinoId) {
  const destino = document.getElementById(destinoId);
  if (!destino) return;
  destino.innerHTML = `
    <div class="mascota-celebra">
      <img src="img/logo-perfil3601.png" alt="Perfil 360" class="mascota-flotante mascota-img" />
      <span class="mascota-celebra__badge" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"/><path d="M7 11l4-7a2 2 0 0 1 3 1.8V9h4.5a2 2 0 0 1 2 2.3l-1.2 6.5a2 2 0 0 1-2 1.7H7"/></svg></span>
    </div>
  `;
}

/**
 * Wrapper de fetch que añade el header Authorization con el token guardado y
 * redirige al login si el backend responde 401 (HU-RNF-002).
 * @param {string} ruta
 * @param {RequestInit} [opciones]
 * @returns {Promise<{ok: boolean, status: number, datos: object}|null>}
 */
async function apiFetch(ruta, opciones = {}) {
  const token = localStorage.getItem('perfil360_token');

  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.headers || {})
    }
  });

  if (respuesta.status === 401) {
    localStorage.removeItem('perfil360_token');
    localStorage.removeItem('perfil360_usuario');
    window.location.href = 'login.html';
    return null;
  }

  const datos = await respuesta.json().catch(() => ({}));
  return { ok: respuesta.ok, status: respuesta.status, datos };
}

// Muestra un toast (notificación flotante) reutilizable en toda la app.
function mostrarToast(mensaje, tipo = 'exito') {
  let contenedor = document.getElementById('toast-contenedor');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'toast-contenedor';
    contenedor.className = 'toast-contenedor';
    document.body.appendChild(contenedor);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${tipo}`;
  toast.textContent = mensaje;
  contenedor.appendChild(toast);

  setTimeout(() => toast.classList.add('toast--visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Modal de confirmación reutilizable antes de acciones críticas (HU-RNF-004).
 * @param {{titulo: string, mensaje: string, textoConfirmar?: string, textoCancelar?: string}} opciones
 * @returns {Promise<boolean>} true si el usuario confirma.
 */
function confirmarAccion({ titulo, mensaje, textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay visible';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>${titulo}</h3>
        <p>${mensaje}</p>
        <div style="display:flex; gap:12px;">
          <button class="btn-secundario" id="confirmar-cancelar" style="flex:1;">${textoCancelar}</button>
          <button class="btn-primario" id="confirmar-aceptar" style="flex:1;">${textoConfirmar}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const limpiar = (resultado) => {
      overlay.remove();
      resolve(resultado);
    };

    overlay.querySelector('#confirmar-cancelar').addEventListener('click', () => limpiar(false));
    overlay.querySelector('#confirmar-aceptar').addEventListener('click', () => limpiar(true));
  });
}
