// Utilidades compartidas por todas las pantallas del portal (excepto
// login/register, que no requieren estar autenticado).
//
// Centralizar esto evita repetir la misma lógica de "agregar el token"
// y "qué hacer si la sesión expiró" en cada archivo .js de cada página
// (principio de buenas prácticas: no te repitas / DRY).

const API_BASE = '';

// --------------------------------------------------------------
// Protege una pagina: si no hay token guardado, redirige al login
// de inmediato. Se debe llamar al inicio de cada pantalla protegida.
// Devuelve el usuario guardado si todo esta bien.
// --------------------------------------------------------------
function protegerPagina() {
  const token = localStorage.getItem('perfil360_token');
  const usuarioTexto = localStorage.getItem('perfil360_usuario');

  // Se rechazan tanto los valores ausentes como los corruptos ('undefined'
  // o 'null' guardados como texto). Antes, un token literal "undefined"
  // pasaba este filtro y provocaba un 401 en cada peticion -> bucle de
  // redireccion al login. Ahora cualquier dato invalido se limpia y se
  // envia al usuario a login de forma limpia (sin reventar en JSON.parse).
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
    // Dato corrupto: lo limpiamos y mandamos a login en vez de dejar la
    // pagina rota por una excepcion no capturada.
    localStorage.removeItem('perfil360_token');
    localStorage.removeItem('perfil360_usuario');
    window.location.href = 'login.html';
    return null;
  }
}

// --------------------------------------------------------------
// Protege una pagina que ademas requiere un rol especifico (ej: solo
// 'admin'). Si el usuario no tiene ese rol, lo manda a su panel normal.
// --------------------------------------------------------------
function protegerPaginaPorRol(rolesPermitidos) {
  const usuario = protegerPagina();
  if (!usuario) return null;

  if (!rolesPermitidos.includes(usuario.rol)) {
    window.location.href = 'dashboard.html';
    return null;
  }
  return usuario;
}

// --------------------------------------------------------------
// Construye los links del navbar para un candidato, marcando cual
// pagina esta activa. Se reutiliza en dashboard/perfil/vacantes/postulaciones
// en vez de repetir el mismo HTML en cada archivo (DRY).
// --------------------------------------------------------------
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

// --------------------------------------------------------------
// Widget de completitud del perfil, para el navbar. Se muestra en
// TODAS las pantallas del candidato (no solo el dashboard), asi el
// candidato siempre sabe que tan completo esta su perfil y hacia
// donde va la mascota "caminando" sobre la barra.
// --------------------------------------------------------------
async function renderizarWidgetCompletitud() {
  const contenedor = document.getElementById('widget-completitud');
  if (!contenedor) return; // esta pagina no tiene el widget (ej. admin)

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

// --------------------------------------------------------------
// Confeti simple (sin librerias externas): crea N piezas de colores
// que caen desde arriba y se autodestruyen. Se usa para celebrar
// hitos como completar el perfil al 100% o postularse.
// --------------------------------------------------------------
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

// --------------------------------------------------------------
// Muestra la mascota con un globito de texto contextual. Se usa en
// login/registro/formularios para que ninguna pantalla se sienta
// "estatica". `destinoId` es el id del elemento donde se inserta.
// --------------------------------------------------------------
function mostrarMascotaGuia(destinoId, mensaje) {
  const destino = document.getElementById(destinoId);
  if (!destino) return;
  destino.innerHTML = `
    <img src="img/logo-perfil3601.png" alt="Perfil 360" class="mascota-flotante" />
    <div class="globo-texto">${mensaje}</div>
  `;
}

// --------------------------------------------------------------
// Mascota "limpia": solo la imagen flotando, sin globo de texto. Se usa
// cuando el texto estatico rompia el layout; el mensaje ahora vive en el
// titulo/subtitulo de la seccion, no en un globo sobre la mascota.
// --------------------------------------------------------------
function mostrarMascotaLimpia(destinoId) {
  const destino = document.getElementById(destinoId);
  if (!destino) return;
  destino.innerHTML = `
    <img src="img/logo-perfil3601.png" alt="Perfil 360" class="mascota-flotante mascota-img" />
  `;
}

// --------------------------------------------------------------
// Variante "pulgar arriba": mascota celebrando con una insignia de
// check. Se usa cuando el perfil llega al 100% para reforzar el logro.
// Ya no inyecta globo de texto (evita que rompa el layout).
// --------------------------------------------------------------
function mostrarMascotaPulgarArriba(destinoId) {
  const destino = document.getElementById(destinoId);
  if (!destino) return;
  destino.innerHTML = `
    <div class="mascota-celebra">
      <img src="img/logo-perfil3601.png" alt="Perfil 360" class="mascota-flotante mascota-img" />
      <span class="mascota-celebra__badge" aria-hidden="true">👍</span>
    </div>
  `;
}

// --------------------------------------------------------------
// Wrapper de fetch que agrega automaticamente el header Authorization
// con el token guardado, y que redirige al login si el backend
// responde 401 (sesion invalida o expirada) — cumple con el criterio
// de HU-RNF-002 de bloquear accesos no autorizados.
// --------------------------------------------------------------
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

// --------------------------------------------------------------
// Pequeño "toast" (notificación flotante) reutilizable en toda la app,
// para no tener que reimplementar un mensaje emergente en cada pantalla.
// --------------------------------------------------------------
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

// --------------------------------------------------------------
// Confirmación reutilizable antes de acciones críticas (HU-RNF-004).
// Devuelve una Promise<boolean> para poder usarse con await.
// --------------------------------------------------------------
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
