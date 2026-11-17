// Logica de la pantalla "Mi perfil" (formulario guiado / stepper).
// Cubre HU-RF-002, HU-RF-003 y HU-RNF-003 (validacion en tiempo real).

// Las constantes y el estado de módulo se declaran antes del arranque para
// evitar errores de acceso en la zona muerta temporal (TDZ).

const TIPS_MASCOTA = {
  1: '¡Empecemos! Cuéntame tu nivel educativo, tu modalidad preferida y un poco sobre ti.',
  2: 'Ahora tu formación académica. Puedes agregar varios registros si quieres.',
  3: '¿Alguna experiencia laboral? No te preocupes si es tu primer trabajo, puedes dejarlo vacío.',
  4: '¡Último paso! Escribe tus habilidades y presiona Enter después de cada una.'
};

let pasoActual = 1;
const TOTAL_PASOS = 4;
let habilidadesActuales = [];

const usuario = protegerPagina();
if (usuario) {
  construirNavbarCandidato('perfil.html');
  activarBotonSalir();
  renderizarWidgetCompletitud();
  inicializarFormulario();
}

async function inicializarFormulario() {
  configurarStepper();
  configurarFilasRepetibles();
  configurarChipsHabilidades();
  cargarOpcionesHabilidades(); // puebla el datalist; falla en silencio sin bloquear el texto libre
  configurarValidacionTiempoReal();
  configurarProgresoEnVivo();
  configurarTooltipsSugerencia();
  actualizarGloboMascota(TIPS_MASCOTA[1]);

  await cargarPerfilExistente();

  // Primera medición de la barra en vivo con los datos ya cargados.
  actualizarBarraEnVivo();

  document.getElementById('form-perfil').addEventListener('submit', guardarPerfil);
}

// Barra de completitud en vivo (HU-RF-003): replica en el frontend la lógica
// de 4 secciones (25% c/u) del backend para reaccionar sin guardar en BD.

const MIN_HABILIDADES_VIVO = 3;

function configurarProgresoEnVivo() {
  const form = document.getElementById('form-perfil');
  // Delegación en el form para captar también las filas repetibles dinámicas:
  // 'input' cubre texto/textarea/number y 'change' cubre selects y fechas.
  form.addEventListener('input', actualizarBarraEnVivo);
  form.addEventListener('change', actualizarBarraEnVivo);
}

// Guía contextual: al enfocar un campo muestra una tarjeta flotante con la
// mascota y un mensaje para ese bloque; al perder el foco se oculta. Usa
// delegación con focusin/focusout para cubrir también las filas clonadas.

// Mensaje contextual por campo (clave = id exacto o data-campo de las filas).
const GUIA_MENSAJES = {
  // Paso 1 — datos básicos
  nivel_educativo: 'Elige tu nivel educativo más alto alcanzado o en curso. Nos ayuda a filtrar vacantes acordes.',
  modalidad_preferida: '¿Cómo prefieres trabajar? Remoto, presencial o híbrido. Lo usamos para priorizar tus recomendaciones.',
  resumen: 'Puedes poner acá tu perfil profesional, años de experiencia, tecnologías fuertes y qué tipo de retos buscas.',
  salario_esperado_min: 'Indica el mínimo que esperas ganar (en COP). Es opcional, pero mejora el match salarial.',
  salario_esperado_max: 'Indica el tope de tu expectativa salarial (en COP). Así evitamos mostrarte vacantes fuera de rango.',
  // Paso 2 — educación (campos de las filas repetibles)
  nivel: 'Selecciona el nivel del título: técnico, tecnólogo, pregrado, posgrado...',
  institucion: 'Escribe el nombre completo de la universidad o institución donde estudiaste.',
  titulo_obtenido: 'Pon el nombre del título tal como aparece en tu diploma (ej: Ingeniería de Sistemas).',
  fecha_graduacion: 'Si aún estás cursando, deja esta fecha vacía.',
  // Paso 3 — experiencia
  cargo: 'Escribe el cargo o rol que desempeñaste (ej: Desarrollador Backend).',
  empresa: 'Nombre de la empresa u organización donde trabajaste.',
  fecha_inicio: 'Fecha en la que empezaste en ese rol.',
  fecha_fin: 'Si es tu trabajo actual, deja la fecha de fin vacía.',
  descripcion: 'Usa verbos de acción y menciona logros medibles (ej: "reduje el tiempo de carga un 30%").',
  // Paso 4 — habilidades
  'input-habilidad': 'Escribe una habilidad y presiona Enter. Agrega al menos 3; puedes elegir de la lista o escribir las tuyas.'
};

// Mensaje por defecto según el paso, cuando el campo no tiene uno propio.
const GUIA_POR_PASO = {
  1: 'Cuéntanos lo esencial de ti. Entre más claro tu resumen, mejores recomendaciones recibirás.',
  2: 'Agrega tu formación académica. Puedes incluir varios títulos.',
  3: 'Suma tu experiencia laboral. Si es tu primer empleo, puedes dejar este paso vacío.',
  4: '¡Casi listo! Tus habilidades son clave para el match con las vacantes.'
};

function mensajeGuiaParaCampo(elemento) {
  if (!elemento) return null;
  // Solo reacciona a campos de formulario reales.
  if (!elemento.matches || !elemento.matches('input, select, textarea')) return null;

  if (elemento.id && GUIA_MENSAJES[elemento.id]) return GUIA_MENSAJES[elemento.id];

  const dataCampo = elemento.getAttribute && elemento.getAttribute('data-campo');
  if (dataCampo && GUIA_MENSAJES[dataCampo]) return GUIA_MENSAJES[dataCampo];

  // Fallback por paso activo.
  return GUIA_POR_PASO[pasoActual] || null;
}

// Crea (una sola vez) la tarjeta guía flotante y la devuelve.
function obtenerTarjetaGuia() {
  let guia = document.getElementById('guia-mascota');
  if (guia) return guia;

  guia = document.createElement('div');
  guia.id = 'guia-mascota';
  guia.className = 'guia-mascota';
  guia.setAttribute('aria-live', 'polite');
  guia.innerHTML = `
    <img src="img/mascota-atenta.png" alt="" class="guia-mascota__img" />
    <div class="guia-mascota__texto" id="guia-mascota-texto"></div>
  `;
  document.body.appendChild(guia);
  return guia;
}

function mostrarGuia(mensaje) {
  const guia = obtenerTarjetaGuia();
  const texto = document.getElementById('guia-mascota-texto');
  if (texto) texto.textContent = mensaje;
  guia.classList.add('visible');
}

function ocultarGuia() {
  const guia = document.getElementById('guia-mascota');
  if (guia) guia.classList.remove('visible');
}

function configurarTooltipsSugerencia() {
  const form = document.getElementById('form-perfil');
  if (!form) return;

  // Al enfocar un campo: mostrar la guía con el mensaje contextual.
  form.addEventListener('focusin', (evento) => {
    const mensaje = mensajeGuiaParaCampo(evento.target);
    if (!mensaje) return;
    mostrarGuia(mensaje);
  });

  // Mientras escribe en un campo de texto, mantenemos la guía visible y
  // sincronizada (por si el foco venía de otra parte). No estorba la
  // escritura: solo actualiza el texto de la tarjeta flotante.
  form.addEventListener('input', (evento) => {
    const guia = document.getElementById('guia-mascota');
    if (!guia || !guia.classList.contains('visible')) return;
    const mensaje = mensajeGuiaParaCampo(evento.target);
    if (mensaje) {
      const texto = document.getElementById('guia-mascota-texto');
      if (texto) texto.textContent = mensaje;
    }
  });

  // Al salir del foco: si el nuevo elemento enfocado NO es un campo del
  // formulario, ocultamos la guía. focusout trae relatedTarget = destino.
  form.addEventListener('focusout', (evento) => {
    const destino = evento.relatedTarget;
    if (destino && form.contains(destino) && destino.matches('input, select, textarea')) {
      return; // el foco sigue dentro de un campo del form: la guía se mantiene
    }
    ocultarGuia();
  });
}

function calcularCompletitudEnVivo() {
  let secciones = 0;

  // Sección 1: datos básicos (nivel, modalidad y resumen con texto).
  const nivel = document.getElementById('nivel_educativo').value.trim();
  const modalidad = document.getElementById('modalidad_preferida').value.trim();
  const resumen = document.getElementById('resumen').value.trim();
  if (nivel && modalidad && resumen) secciones++;

  // Sección 2: al menos una fila de educación con sus requeridos llenos.
  if (hayFilaCompleta('[data-fila-educacion]')) secciones++;

  // Sección 3: al menos una fila de experiencia con sus requeridos llenos.
  if (hayFilaCompleta('[data-fila-experiencia]')) secciones++;

  // Sección 4: al menos 3 habilidades.
  if (habilidadesActuales.length >= MIN_HABILIDADES_VIVO) secciones++;

  return secciones * 25;
}

// Devuelve true si existe al menos una fila del tipo dado con todos sus
// campos required diligenciados (misma regla que el guardado).
function hayFilaCompleta(selectorFila) {
  const filas = document.querySelectorAll(selectorFila);
  return Array.from(filas).some(fila => {
    const requeridos = fila.querySelectorAll('[data-campo][required]');
    if (requeridos.length === 0) return false;
    return Array.from(requeridos).every(c => c.value.trim() !== '');
  });
}

function actualizarBarraEnVivo() {
  const porcentaje = calcularCompletitudEnVivo();
  actualizarEstadoMascota(porcentaje);
  const barra = document.getElementById('barra-progreso-vivo');
  const texto = document.getElementById('texto-progreso-vivo');
  if (barra) barra.style.width = `${porcentaje}%`;
  if (texto) texto.textContent = `${porcentaje}%`;
  return porcentaje;
}

// Estado de la mascota según la completitud, en 4 rangos:
//   0-25% triste, 26-50% atenta, 51-85% feliz, 86-100% eufórica.
// Se recalcula desde actualizarBarraEnVivo() en cada cambio del formulario.
const ESTADOS_MASCOTA = [
  {
    hasta: 25,
    img: 'img/mascota-triste.png',
    clase: 'emocion-triste',
    mensaje: 'Mi perfil está muy vacío... ¡ayúdame a llenarlo!'
  },
  {
    hasta: 50,
    img: 'img/mascota-atenta.png',
    clase: 'emocion-atenta',
    mensaje: '¡Buen comienzo! Sigamos sumando datos clave.'
  },
  {
    hasta: 85,
    img: 'img/mascota-feliz.png',
    clase: 'emocion-feliz',
    mensaje: '¡Qué gran perfil! Cada vez estás más cerca de tu vacante ideal.'
  },
  {
    hasta: 100,
    img: 'img/mascota-euforica.png',
    clase: 'emocion-euforico',
    mensaje: '¡Perfil al máximo! Ya estás listo para brillar en las entrevistas.'
  }
];

const CLASES_EMOCION = ESTADOS_MASCOTA.map(e => e.clase);
const CLASES_MSG = ['msg-triste', 'msg-atenta', 'msg-feliz', 'msg-euforico'];

function actualizarEstadoMascota(porcentaje) {
  const mascota = document.getElementById('mascota-perfil');
  if (!mascota) return;

  const estado = ESTADOS_MASCOTA.find(e => porcentaje <= e.hasta) || ESTADOS_MASCOTA[ESTADOS_MASCOTA.length - 1];

  // Esta función corre en cada tecla: solo se toca el DOM cuando la emoción
  // cambia, para no reiniciar la animación CSS en cada pulsación.
  const yaEnEsteEstado = mascota.classList.contains(estado.clase);
  if (yaEnEsteEstado) return;

  mascota.setAttribute('src', estado.img);

  mascota.classList.remove(...CLASES_EMOCION);
  mascota.classList.add(estado.clase);

  const mensaje = document.getElementById('mascota-mensaje');
  if (mensaje) {
    mensaje.textContent = estado.mensaje;
    const claseMsg = estado.clase.replace('emocion-', 'msg-');
    mensaje.classList.remove(...CLASES_MSG);
    mensaje.classList.add(claseMsg, 'visible');
  }
}

// ================================================================
// STEPPER: mostrar/ocultar pasos y validar antes de avanzar
// ================================================================

function configurarStepper() {
  document.getElementById('btn-siguiente').addEventListener('click', () => {
    if (!validarPasoActual()) return;
    irAlPaso(pasoActual + 1);
  });

  document.getElementById('btn-anterior').addEventListener('click', () => {
    irAlPaso(pasoActual - 1);
  });

  // Tambien se puede saltar directo haciendo click en un paso ya visitado
  document.querySelectorAll('.stepper-nav__paso').forEach(el => {
    el.addEventListener('click', () => {
      const destino = Number(el.dataset.paso);
      if (destino < pasoActual) irAlPaso(destino); // solo retroceder libremente
    });
  });
}

function irAlPaso(numero) {
  if (numero < 1 || numero > TOTAL_PASOS) return;
  pasoActual = numero;

  // Actualiza el globo de la mascota y la anima al cambiar de sección.
  actualizarGloboMascota(TIPS_MASCOTA[pasoActual]);
  animarSaltoMascota();

  document.querySelectorAll('.paso-formulario').forEach(el => {
    el.classList.toggle('activo', Number(el.dataset.paso) === pasoActual);
  });

  document.querySelectorAll('.stepper-nav__paso').forEach(el => {
    const num = Number(el.dataset.paso);
    el.classList.toggle('activo', num === pasoActual);
    el.classList.toggle('completado', num < pasoActual);
  });

  document.getElementById('btn-anterior').style.visibility = pasoActual === 1 ? 'hidden' : 'visible';
  document.getElementById('btn-siguiente').style.display = pasoActual === TOTAL_PASOS ? 'none' : 'inline-block';
  document.getElementById('btn-guardar').style.display = pasoActual === TOTAL_PASOS ? 'inline-flex' : 'none';
}

// ================================================================
// MASCOTA GAMIFICADA (lateral del formulario)
// ================================================================

// Actualiza el globo de texto breve que acompaña a la mascota.
function actualizarGloboMascota(mensaje) {
  const globo = document.getElementById('mascota-globo-perfil');
  if (!globo) return;
  globo.textContent = mensaje;
  // Reinicia la animacion de aparicion del globo.
  globo.classList.remove('visible');
  // Forzar reflow para reiniciar la transicion.
  void globo.offsetWidth;
  globo.classList.add('visible');
}

// Pequeño salto + parpadeo de opacidad de la mascota al cambiar de seccion.
function animarSaltoMascota() {
  const mascota = document.getElementById('mascota-perfil');
  if (!mascota) return;
  mascota.classList.remove('mascota-salta');
  void mascota.offsetWidth; // reflow para poder reiniciar la animacion
  mascota.classList.add('mascota-salta');
}

// ================================================================
// VALIDACION EN TIEMPO REAL (HU-RNF-003)
// Resalta en rojo los campos vacios/invalidos y deshabilita "Siguiente"
// mientras el paso actual tenga errores.
// ================================================================

function configurarValidacionTiempoReal() {
  const form = document.getElementById('form-perfil');

  form.addEventListener('input', () => {
    actualizarEstadoBotonSiguiente();
  });

  // Validación en vivo de fechas: al cambiar cualquier campo de fecha
  // (incluidos los de filas clonadas, por eso es delegado con 'change'),
  // revalidamos el paso mostrando errores en rojo y avisamos si la fecha es
  // futura o el rango fin<inicio es incoherente.
  form.addEventListener('change', (evento) => {
    const campo = evento.target;
    if (!campo || campo.getAttribute('type') !== 'date') return;

    const hoy = hoyISO();
    if (campo.value && campo.value > hoy) {
      mostrarToast('No puedes usar una fecha futura. Corrige la fecha.', 'error');
    }
    // Revalida el paso actual (educación/experiencia) marcando los campos.
    validarPasoActual(true);
  });

  // Validación en vivo del rango salarial: apenas el usuario escribe un
  // mínimo mayor que el máximo, se marcan en rojo los campos y aparece el
  // mensaje, sin tener que esperar a dar "Guardar".
  const campoMin = document.getElementById('salario_esperado_min');
  const campoMax = document.getElementById('salario_esperado_max');
  [campoMin, campoMax].forEach(campo => {
    if (!campo) return;
    campo.addEventListener('input', () => validarRangoSalarial(true));
    campo.addEventListener('blur', () => validarRangoSalarial(true));
  });
}

function marcarCampo(elemento, esValido) {
  elemento.classList.toggle('campo--error', !esValido);
}

// Revisa el PASO 1 (datos basicos): siempre visible, siempre se valida igual
function validarPaso1(mostrarErrores) {
  const nivel = document.getElementById('nivel_educativo');
  const modalidad = document.getElementById('modalidad_preferida');
  const resumen = document.getElementById('resumen');

  const nivelValido = nivel.value.trim() !== '';
  const modalidadValida = modalidad.value.trim() !== '';
  const resumenValido = resumen.value.trim().length >= 10;

  if (mostrarErrores) {
    marcarCampo(nivel, nivelValido);
    marcarCampo(modalidad, modalidadValida);
    marcarCampo(resumen, resumenValido);
    document.getElementById('error-resumen').classList.toggle('visible', !resumenValido);
  }

  return nivelValido && modalidadValida && resumenValido;
}

// Devuelve la fecha de HOY en formato YYYY-MM-DD (para el atributo max y
// para comparar). Se usa en la validación de fechas.
function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Revisa filas repetibles (educacion o experiencia):
//  - si una fila tiene AL MENOS un campo lleno, todos sus campos "required"
//    deben estarlo;
//  - ninguna fecha puede ser FUTURA (posterior a hoy);
//  - en experiencia, la fecha de fin no puede ser anterior a la de inicio.
// Filas completamente vacias no cuentan como error (se ignoran al guardar).
function validarFilasRepetibles(selectorFila, mostrarErrores) {
  const filas = document.querySelectorAll(selectorFila);
  const hoy = hoyISO();
  let todoValido = true;

  filas.forEach(fila => {
    const campos = fila.querySelectorAll('[data-campo]');
    const algunoLleno = Array.from(campos).some(c => c.value.trim() !== '');

    campos.forEach(campo => {
      const esRequerido = campo.hasAttribute('required');
      const estaVacio = campo.value.trim() === '';
      let esInvalido = algunoLleno && esRequerido && estaVacio;

      // Regla de fecha futura: aplica a cualquier input de fecha con valor.
      if (campo.getAttribute('type') === 'date' && campo.value && campo.value > hoy) {
        esInvalido = true;
      }

      if (esInvalido) todoValido = false;
      if (mostrarErrores) marcarCampo(campo, !esInvalido);
    });

    // Coherencia de rango en experiencia: fin >= inicio (si ambas existen).
    const inicio = fila.querySelector('[data-campo="fecha_inicio"]');
    const fin = fila.querySelector('[data-campo="fecha_fin"]');
    if (inicio && fin && inicio.value && fin.value && fin.value < inicio.value) {
      todoValido = false;
      if (mostrarErrores) {
        marcarCampo(inicio, false);
        marcarCampo(fin, false);
      }
    }
  });

  return todoValido;
}

function validarPasoActual(mostrarErrores = true) {
  if (pasoActual === 1) return validarPaso1(mostrarErrores);
  if (pasoActual === 2) return validarFilasRepetibles('[data-fila-educacion]', mostrarErrores);
  if (pasoActual === 3) return validarFilasRepetibles('[data-fila-experiencia]', mostrarErrores);
  return true; // paso 4 (habilidades) no bloquea el avance
}

function actualizarEstadoBotonSiguiente() {
  // El botón se mantiene clickeable; los errores se muestran al intentar avanzar.
  const valido = validarPasoActual(false);
  document.getElementById('btn-siguiente').disabled = false;
}

// ================================================================
// FILAS REPETIBLES: educacion y experiencia
// ================================================================

function configurarFilasRepetibles() {
  document.getElementById('btn-agregar-educacion').addEventListener('click', () => agregarFila('educacion'));
  document.getElementById('btn-agregar-experiencia').addEventListener('click', () => agregarFila('experiencia'));
}

function agregarFila(tipo, datosIniciales = null) {
  const plantilla = document.getElementById(`plantilla-${tipo}`);
  const clon = plantilla.content.cloneNode(true);
  const fila = clon.querySelector(`[data-fila-${tipo}]`);

  // Limita los campos de fecha a HOY como máximo: el selector nativo del
  // navegador no dejará elegir fechas futuras (validación de 1ª capa).
  const hoy = hoyISO();
  fila.querySelectorAll('input[type="date"]').forEach(campoFecha => {
    campoFecha.setAttribute('max', hoy);
  });

  if (datosIniciales) {
    fila.querySelectorAll('[data-campo]').forEach(campo => {
      const nombre = campo.dataset.campo;
      if (datosIniciales[nombre] !== undefined && datosIniciales[nombre] !== null) {
        campo.value = datosIniciales[nombre];
      }
    });
  }

  fila.querySelector('[data-accion="quitar"]').addEventListener('click', () => {
    fila.remove();
    actualizarEstadoBotonSiguiente();
    actualizarBarraEnVivo(); // quitar una fila puede bajar el %
  });

  const lista = document.getElementById(tipo === 'educacion' ? 'lista-educaciones' : 'lista-experiencias');
  lista.appendChild(fila);
}

// ================================================================
// CHIPS DE HABILIDADES
// ================================================================

function configurarChipsHabilidades() {
  const input = document.getElementById('input-habilidad');
  input.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' || evento.key === ',') {
      evento.preventDefault();
      agregarHabilidad(input.value);
      input.value = '';
    }
  });
}

// Catálogo maestro de habilidades traído del backend, usado para el datalist
// de autocompletado y los ovalitos clicables bajo el input.
let catalogoHabilidades = [];

// Puebla el datalist y los ovalitos del catálogo. Falla en silencio: si el
// endpoint no responde, no hay sugerencias pero el texto libre sigue funcionando.
async function cargarOpcionesHabilidades() {
  try {
    const respuesta = await apiFetch('/api/habilidades');
    if (!respuesta || !respuesta.ok) return;

    const habilidades = (respuesta.datos && respuesta.datos.habilidades) || [];
    catalogoHabilidades = habilidades
      .map(h => h && h.nombre)
      .filter(Boolean);

    // Datalist nativo como ayuda al escribir.
    const datalist = document.getElementById('opciones-habilidades');
    if (datalist) {
      datalist.innerHTML = '';
      catalogoHabilidades.forEach(nombre => {
        const opcion = document.createElement('option');
        opcion.value = nombre;
        datalist.appendChild(opcion);
      });
    }

    // Ovalitos clicables con todo el catálogo.
    renderizarCatalogoHabilidades();
  } catch (error) {
    console.warn('[perfil] No se pudo cargar el catálogo de habilidades:', error);
  }
}

// Dibuja los ovalitos clicables del catálogo bajo el input. Al pulsar uno se
// agrega como habilidad; los ya agregados quedan deshabilitados para no duplicar.
function renderizarCatalogoHabilidades() {
  const contenedor = document.getElementById('catalogo-habilidades');
  const titulo = document.getElementById('catalogo-habilidades-titulo');
  if (!contenedor) return;

  contenedor.innerHTML = '';

  if (catalogoHabilidades.length === 0) {
    if (titulo) titulo.style.display = 'none';
    return;
  }
  if (titulo) titulo.style.display = '';

  const seleccionadas = new Set(habilidadesActuales.map(h => h.toLowerCase().trim()));

  catalogoHabilidades.forEach(nombre => {
    const yaAgregada = seleccionadas.has(nombre.toLowerCase().trim());

    const ovalo = document.createElement('button');
    ovalo.type = 'button';
    ovalo.className = 'skill-ovalo' + (yaAgregada ? ' skill-ovalo--agregada' : '');
    ovalo.textContent = nombre;
    ovalo.disabled = yaAgregada;
    ovalo.setAttribute('aria-pressed', yaAgregada ? 'true' : 'false');
    if (!yaAgregada) {
      ovalo.addEventListener('click', () => agregarHabilidad(nombre));
    }
    contenedor.appendChild(ovalo);
  });
}

function agregarHabilidad(nombre) {
  const limpio = nombre.trim();
  if (!limpio) return;

  const yaExiste = habilidadesActuales.some(h => h.toLowerCase() === limpio.toLowerCase());
  if (yaExiste) return;

  habilidadesActuales.push(limpio);
  renderizarChips();
}

function quitarHabilidad(nombre) {
  habilidadesActuales = habilidadesActuales.filter(h => h !== nombre);
  renderizarChips();
}

function renderizarChips() {
  // La sección 4 depende de tener >= 3 habilidades, así que se refresca la barra.
  actualizarBarraEnVivo();
  renderizarCatalogoHabilidades();

  const contenedor = document.getElementById('chips-habilidades');
  contenedor.innerHTML = '';

  habilidadesActuales.forEach(nombre => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `${nombre} <button type="button" aria-label="Quitar"><svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
    chip.querySelector('button').addEventListener('click', () => quitarHabilidad(nombre));
    contenedor.appendChild(chip);
  });
}

// ================================================================
// CARGAR datos existentes (si el candidato ya habia guardado antes)
// ================================================================

async function cargarPerfilExistente() {
  const respuesta = await apiFetch('/api/perfil');
  if (!respuesta || !respuesta.ok) return;

  const { perfil, experiencias, educaciones, habilidades } = respuesta.datos;

  if (perfil) {
    document.getElementById('nivel_educativo').value = perfil.nivel_educativo || '';
    document.getElementById('modalidad_preferida').value = perfil.modalidad_preferida || '';
    document.getElementById('resumen').value = perfil.resumen || '';
    document.getElementById('salario_esperado_min').value = perfil.salario_esperado_min || '';
    document.getElementById('salario_esperado_max').value = perfil.salario_esperado_max || '';
  }

  educaciones.forEach(edu => agregarFila('educacion', {
    nivel: edu.nivel,
    institucion: edu.institucion,
    titulo_obtenido: edu.titulo_obtenido,
    fecha_graduacion: edu.fecha_graduacion ? edu.fecha_graduacion.split('T')[0] : ''
  }));

  experiencias.forEach(exp => agregarFila('experiencia', {
    cargo: exp.cargo,
    empresa: exp.empresa,
    fecha_inicio: exp.fecha_inicio ? exp.fecha_inicio.split('T')[0] : '',
    fecha_fin: exp.fecha_fin ? exp.fecha_fin.split('T')[0] : '',
    descripcion: exp.descripcion || ''
  }));

  habilidadesActuales = habilidades.map(h => h.nombre);
  renderizarChips();
}

// ================================================================
// GUARDAR (envio final del formulario)
// ================================================================

function recolectarFilas(selectorFila) {
  const filas = document.querySelectorAll(selectorFila);
  const resultado = [];

  filas.forEach(fila => {
    const objeto = {};
    fila.querySelectorAll('[data-campo]').forEach(campo => {
      objeto[campo.dataset.campo] = campo.value.trim() || null;
    });
    // Solo se incluyen filas que tengan al menos un campo diligenciado
    if (Object.values(objeto).some(v => v)) resultado.push(objeto);
  });

  return resultado;
}

// Valida que el rango salarial sea coherente: si el usuario diligencia
// ambos campos, el minimo no puede ser mayor que el maximo. Devuelve true
// si el rango es valido. Marca los campos en rojo cuando hay error.
function validarRangoSalarial(mostrarErrores = true) {
  const campoMin = document.getElementById('salario_esperado_min');
  const campoMax = document.getElementById('salario_esperado_max');

  const minTexto = campoMin.value.trim();
  const maxTexto = campoMax.value.trim();

  // Si falta alguno de los dos, no hay rango que comparar: se considera valido.
  if (minTexto === '' || maxTexto === '') {
    if (mostrarErrores) {
      marcarCampo(campoMin, true);
      marcarCampo(campoMax, true);
    }
    return true;
  }

  const min = Number(minTexto);
  const max = Number(maxTexto);
  const rangoValido = !(Number.isFinite(min) && Number.isFinite(max) && min > max);

  if (mostrarErrores) {
    marcarCampo(campoMin, rangoValido);
    marcarCampo(campoMax, rangoValido);
    const msg = document.getElementById('error-salario');
    if (msg) msg.classList.toggle('visible', !rangoValido);
  }

  return rangoValido;
}

/**
 * Valida el formulario, arma el payload y envía PUT /api/perfil. Ante éxito
 * actualiza la barra de completitud y redirige al dashboard; el botón y el
 * spinner siempre se restablecen vía finally.
 * @param {SubmitEvent} evento
 * @returns {Promise<void>}
 */
async function guardarPerfil(evento) {
  evento.preventDefault();

  if (!validarPaso1(true)) {
    irAlPaso(1);
    return;
  }

  // Si el rango salarial es incoherente, se bloquea el envío y se vuelve al paso 1.
  if (!validarRangoSalarial(true)) {
    irAlPaso(1);
    mostrarToast('El salario mínimo no puede ser mayor que el máximo. Corrige el rango para continuar.', 'error');
    return;
  }

  // Fechas de educación: no futuras.
  if (!validarFilasRepetibles('[data-fila-educacion]', true)) {
    irAlPaso(2);
    mostrarToast('Revisa las fechas de tu formación: no pueden ser futuras.', 'error');
    return;
  }

  // Fechas de experiencia: no futuras y fin >= inicio.
  if (!validarFilasRepetibles('[data-fila-experiencia]', true)) {
    irAlPaso(3);
    mostrarToast('Revisa las fechas de tu experiencia: no pueden ser futuras ni terminar antes de empezar.', 'error');
    return;
  }

  const boton = document.getElementById('btn-guardar');
  const spinner = document.getElementById('spinner-guardar');
  const texto = document.getElementById('texto-btn-guardar');

  // Si el guardado redirige, no se reactiva el botón para que no parpadee.
  let redirigiendo = false;

  boton.disabled = true;
  spinner.classList.add('visible');
  texto.textContent = 'Guardando...';

  const cuerpo = {
    nivel_educativo: document.getElementById('nivel_educativo').value,
    resumen: document.getElementById('resumen').value.trim(),
    modalidad_preferida: document.getElementById('modalidad_preferida').value,
    salario_esperado_min: document.getElementById('salario_esperado_min').value || null,
    salario_esperado_max: document.getElementById('salario_esperado_max').value || null,
    educaciones: recolectarFilas('[data-fila-educacion]'),
    experiencias: recolectarFilas('[data-fila-experiencia]'),
    habilidades: habilidadesActuales
  };

  // El flujo va en try/finally para que el botón y el spinner siempre se
  // restablezcan y nunca queden atascados en "Guardando...".
  try {
    console.log('[perfil] Enviando PUT /api/perfil con:', cuerpo);
    const respuesta = await apiFetch('/api/perfil', { method: 'PUT', body: JSON.stringify(cuerpo) });

    // apiFetch devuelve null cuando el backend respondió 401: ya redirigió al login.
    if (!respuesta) {
      console.warn('[perfil] apiFetch devolvio null (probable 401 / sesion expirada).');
      return;
    }

    console.log('[perfil] Respuesta del servidor:', respuesta.status, respuesta.datos);

    if (!respuesta.ok) {
      console.error('[perfil] El guardado fallo. HTTP', respuesta.status, respuesta.datos);
      mostrarToast((respuesta.datos && respuesta.datos.mensaje) || 'No se pudo guardar tu perfil.', 'error');
      return;
    }

    console.log('[perfil] Guardado OK. Actualizando barra de completitud.');
    mostrarToast((respuesta.datos && respuesta.datos.mensaje) || 'Perfil actualizado correctamente', 'exito');

    const completitud = await renderizarWidgetCompletitud();
    console.log('[perfil] Completitud recalculada:', completitud);

    // Si el perfil quedó al 100%, se celebra antes de redirigir.
    let esperaRedireccion = 1200;
    if (completitud >= 100 && !localStorage.getItem('perfil360_confeti_100')) {
      lanzarConfeti();
      localStorage.setItem('perfil360_confeti_100', 'true');
      actualizarGloboMascota('¡Tu perfil quedó al 100%! Ya puedo recomendarte con toda precisión.');
      animarSaltoMascota();
      esperaRedireccion = 2600; // más tiempo para la celebración
    }

    // Redirección automática al dashboard tras el éxito (HU-RF-003).
    console.log('[perfil] Redirigiendo a dashboard.html en %d ms.', esperaRedireccion);
    redirigiendo = true;
    texto.textContent = 'Redirigiendo...';
    setTimeout(() => { window.location.href = 'dashboard.html'; }, esperaRedireccion);
    return;
  } catch (error) {
    console.error('[perfil] Error inesperado al guardar el perfil:', error);
    mostrarToast('Ocurrió un error inesperado al guardar. Revisa tu conexión e intenta de nuevo.', 'error');
  } finally {
    // Tras un éxito con redirección el botón queda deshabilitado; en cualquier
    // otro caso se restaura para permitir reintentar.
    if (!redirigiendo) {
      boton.disabled = false;
      spinner.classList.remove('visible');
      texto.textContent = 'Guardar Perfil';
    }
  }
}
