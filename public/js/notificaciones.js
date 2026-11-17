// Centro de Notificaciones del navbar del candidato. Se auto-inicializa:
// inyecta la campana con su badge, carga las notificaciones y despliega un
// dropdown al hacer clic. Depende de apiFetch() (utils.js), que debe cargarse
// antes.
(function () {
  // No hace nada sin sesión (login/registro) o sin navbar.
  const token = localStorage.getItem('perfil360_token');
  if (!token || token === 'undefined' || token === 'null') return;

  document.addEventListener('DOMContentLoaded', inicializarCampana);

  // SVG de campana (limpio, hereda currentColor).
  const SVG_CAMPANA = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

  function inicializarCampana() {
    const navbar = document.querySelector('.navbar');
    if (!navbar || document.getElementById('campana-notif')) return;

    // Contenedor de la campana.
    const wrap = document.createElement('div');
    wrap.className = 'notif-campana';
    wrap.id = 'campana-notif';
    wrap.innerHTML = `
      <button class="notif-campana__btn" id="notif-boton" aria-label="Notificaciones" aria-haspopup="true" aria-expanded="false">
        ${SVG_CAMPANA}
        <span class="notif-badge" id="notif-badge" hidden>0</span>
      </button>
      <div class="notif-dropdown" id="notif-dropdown" hidden>
        <div class="notif-dropdown__cabecera">
          <span>Notificaciones</span>
        </div>
        <div class="notif-dropdown__lista" id="notif-lista">
          <div class="notif-vacio">Cargando...</div>
        </div>
      </div>
    `;

    // Lo insertamos antes del widget de completitud si existe, si no, antes
    // del botón de salir (queda a la derecha, junto al resto de controles).
    const widget = document.getElementById('widget-completitud');
    const salir = document.getElementById('btn-salir');
    if (widget) navbar.insertBefore(wrap, widget);
    else if (salir) navbar.insertBefore(wrap, salir);
    else navbar.appendChild(wrap);

    document.getElementById('notif-boton').addEventListener('click', alternarDropdown);

    // Cerrar al hacer clic fuera.
    document.addEventListener('click', (e) => {
      const cont = document.getElementById('campana-notif');
      if (cont && !cont.contains(e.target)) cerrarDropdown();
    });
    // Cerrar con Escape.
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarDropdown(); });

    cargarNotificaciones();
  }

  let notificacionesCache = [];

  async function cargarNotificaciones() {
    const respuesta = await apiFetch('/api/notificaciones');
    if (!respuesta || !respuesta.ok) return;

    notificacionesCache = (respuesta.datos && respuesta.datos.notificaciones) || [];
    const noLeidas = (respuesta.datos && respuesta.datos.no_leidas) || 0;
    pintarBadge(noLeidas);
    pintarLista(notificacionesCache);
  }

  function pintarBadge(n) {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (n > 0) {
      badge.textContent = n > 9 ? '9+' : String(n);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function pintarLista(lista) {
    const cont = document.getElementById('notif-lista');
    if (!cont) return;

    if (!lista || lista.length === 0) {
      cont.innerHTML = '<div class="notif-vacio">No tienes notificaciones todavía.</div>';
      return;
    }

    cont.innerHTML = lista.map(n => {
      const enlace = n.enlace ? escaparAtributo(n.enlace) : '';
      const claseNoLeida = n.leida ? '' : ' notif-item--no-leida';
      const cta = n.enlace
        ? `<a class="notif-item__cta" href="${enlace}">Ir ahora</a>`
        : '';
      return `
        <div class="notif-item${claseNoLeida}">
          <div class="notif-item__titulo">${escaparHtml(n.titulo)}</div>
          <div class="notif-item__mensaje">${escaparHtml(n.mensaje)}</div>
          <div class="notif-item__pie">
            <span class="notif-item__fecha">${fechaRelativa(n.fecha_creacion)}</span>
            ${cta}
          </div>
        </div>
      `;
    }).join('');
  }

  async function alternarDropdown() {
    const dropdown = document.getElementById('notif-dropdown');
    if (!dropdown) return;
    if (dropdown.hidden) await abrirDropdown();
    else cerrarDropdown();
  }

  async function abrirDropdown() {
    const dropdown = document.getElementById('notif-dropdown');
    const boton = document.getElementById('notif-boton');
    if (!dropdown) return;
    dropdown.hidden = false;
    if (boton) boton.setAttribute('aria-expanded', 'true');

    // Al abrir: marcamos todas como leídas (quita el badge). Mantenemos el
    // resaltado visual de "no leída" en la lista ya abierta para que el
    // usuario vea cuáles eran nuevas; el badge sí baja a 0.
    const hayNoLeidas = notificacionesCache.some(n => !n.leida);
    if (hayNoLeidas) {
      await apiFetch('/api/notificaciones/leer-todas', { method: 'PATCH' });
      pintarBadge(0);
    }
  }

  function cerrarDropdown() {
    const dropdown = document.getElementById('notif-dropdown');
    const boton = document.getElementById('notif-boton');
    if (dropdown) dropdown.hidden = true;
    if (boton) boton.setAttribute('aria-expanded', 'false');
  }

  // --- Utilidades ---

  // Fecha relativa simple en español ("hace 5 min", "hace 2 h", "hace 3 d").
  function fechaRelativa(fechaIso) {
    const fecha = new Date(fechaIso);
    if (isNaN(fecha.getTime())) return '';
    const seg = Math.floor((Date.now() - fecha.getTime()) / 1000);
    if (seg < 60) return 'hace un momento';
    const min = Math.floor(seg / 60);
    if (min < 60) return `hace ${min} min`;
    const horas = Math.floor(min / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    if (dias < 30) return `hace ${dias} d`;
    return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  }

  function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto == null ? '' : String(texto);
    return div.innerHTML;
  }

  // Para el href del CTA: solo permitimos páginas internas simples.
  function escaparAtributo(valor) {
    const limpio = String(valor).replace(/[^a-zA-Z0-9_\-.?=&/]/g, '');
    return limpio;
  }
})();
