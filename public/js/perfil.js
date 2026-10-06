// Logica de la pantalla "Mi perfil" (formulario guiado / stepper).
// Cubre HU-RF-002, HU-RF-003 (indirectamente, via el dashboard) y
// HU-RNF-003 (validacion en tiempo real).

// IMPORTANTE: las constantes y el estado a nivel de modulo se declaran
// ARRIBA, ANTES del bloque de arranque "if (usuario)". Antes estaban
// declarados DESPUES de llamar a inicializarFormulario(), y como const/let
// viven en la "zona muerta temporal" (TDZ) hasta la linea donde se declaran,
// inicializarFormulario() reventaba con:
//   "Cannot access 'TIPS_MASCOTA' before initialization"
// Esa excepcion abortaba todo el arranque: el listener de submit nunca se
// enganchaba, por lo que "Guardar" no hacia nada y el GET /api/perfil no se
// completaba (de ahi la sensacion de "guardado atascado / barra no actualiza").

const TIPS_MASCOTA = {
  1: '¡Empecemos! Cuéntame tu nivel educativo, tu modalidad preferida y un poco sobre ti.',
  2: 'Ahora tu formación académica. Puedes agregar varios registros si quieres.',
  3: '¿Alguna experiencia laboral? No te preocupes si es tu primer trabajo, puedes dejarlo vacío.',
  4: '¡Último paso! Escribe tus habilidades y presiona Enter después de cada una.'
};

let pasoActual = 1;
const TOTAL_PASOS = 4;
let habilidadesActuales = []; // array de strings

// Arranque de la pantalla: ya con todas las declaraciones disponibles.
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
  configurarValidacionTiempoReal();
  configurarProgresoEnVivo();
  actualizarGloboMascota(TIPS_MASCOTA[1]);

  await cargarPerfilExistente();

  // Primera medicion de la barra en vivo, ya con los datos cargados.
  actualizarBarraEnVivo();

  document.getElementById('form-perfil').addEventListener('submit', guardarPerfil);
}

// ================================================================
// BARRA DE COMPLETITUD EN VIVO (HU-RF-003)
// Replica, en el frontend, la misma logica de 4 secciones (25% c/u)
// que usa el backend en calcularCompletitud(), para que la barra
// reaccione en tiempo real SIN tener que guardar en la base de datos.
// ================================================================

const MIN_HABILIDADES_VIVO = 3;

function configurarProgresoEnVivo() {
  const form = document.getElementById('form-perfil');
  // "input" cubre texto/textarea/number; "change" cubre selects y date.
  // Se escucha en el form (delegacion) para captar tambien las filas
  // repetibles que se agregan dinamicamente despues.
  form.addEventListener('input', actualizarBarraEnVivo);
  form.addEventListener('change', actualizarBarraEnVivo);
}

function calcularCompletitudEnVivo() {
  let secciones = 0;

  // Seccion 1: datos basicos (nivel + modalidad + resumen con algo de texto)
  const nivel = document.getElementById('nivel_educativo').value.trim();
  const modalidad = document.getElementById('modalidad_preferida').value.trim();
  const resumen = document.getElementById('resumen').value.trim();
  if (nivel && modalidad && resumen) secciones++;

  // Seccion 2: al menos una fila de educacion con sus requeridos llenos
  if (hayFilaCompleta('[data-fila-educacion]')) secciones++;

  // Seccion 3: al menos una fila de experiencia con sus requeridos llenos
  if (hayFilaCompleta('[data-fila-experiencia]')) secciones++;

  // Seccion 4: al menos 3 habilidades
  if (habilidadesActuales.length >= MIN_HABILIDADES_VIVO) secciones++;

  return secciones * 25;
}

// Devuelve true si existe al menos UNA fila del tipo dado con todos sus
// campos "required" diligenciados (misma regla que usa el guardado).
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
  const barra = document.getElementById('barra-progreso-vivo');
  const texto = document.getElementById('texto-progreso-vivo');
  if (barra) barra.style.width = `${porcentaje}%`;
  if (texto) texto.textContent = `${porcentaje}%`;
  return porcentaje;
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

  // Mascota gamificada: actualiza su globo de texto y hace un pequeño salto
  // cada vez que el usuario cambia de seccion.
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
  document.getElementById('form-perfil').addEventListener('input', () => {
    actualizarEstadoBotonSiguiente();
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

// Revisa filas repetibles (educacion o experiencia): si una fila tiene
// AL MENOS un campo lleno, todos sus campos "required" deben estarlo.
// Filas completamente vacias no cuentan como error (se ignoran al guardar).
function validarFilasRepetibles(selectorFila, mostrarErrores) {
  const filas = document.querySelectorAll(selectorFila);
  let todoValido = true;

  filas.forEach(fila => {
    const campos = fila.querySelectorAll('[data-campo]');
    const algunoLleno = Array.from(campos).some(c => c.value.trim() !== '');

    campos.forEach(campo => {
      const esRequerido = campo.hasAttribute('required');
      const estaVacio = campo.value.trim() === '';
      const esInvalido = algunoLleno && esRequerido && estaVacio;

      if (esInvalido) todoValido = false;
      if (mostrarErrores) marcarCampo(campo, !esInvalido);
    });
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
  const valido = validarPasoActual(false); // no mostrar errores mientras el usuario escribe, solo al intentar avanzar
  document.getElementById('btn-siguiente').disabled = false; // el boton se mantiene clickeable; al hacer click SI se muestran errores
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
  // Cada vez que cambia el set de habilidades, refrescamos la barra en vivo
  // (la seccion 4 depende de tener >= 3 habilidades).
  actualizarBarraEnVivo();

  const contenedor = document.getElementById('chips-habilidades');
  contenedor.innerHTML = '';

  habilidadesActuales.forEach(nombre => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `${nombre} <button type="button" aria-label="Quitar">✕</button>`;
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
  }

  return rangoValido;
}

async function guardarPerfil(evento) {
  evento.preventDefault();

  if (!validarPaso1(true)) {
    irAlPaso(1);
    return;
  }

  // Validacion de negocio: el salario minimo no puede superar al maximo.
  // Si el rango es incoherente, bloqueamos el envio, llevamos al usuario
  // al paso 1 (donde estan los campos de salario) y mostramos una alerta
  // amigable, sin tocar al servidor.
  if (!validarRangoSalarial(true)) {
    irAlPaso(1);
    mostrarToast('El salario mínimo no puede ser mayor que el máximo. Corrige el rango para continuar.', 'error');
    return;
  }

  const boton = document.getElementById('btn-guardar');
  const spinner = document.getElementById('spinner-guardar');
  const texto = document.getElementById('texto-btn-guardar');

  // Cuando el guardado sale bien redirigimos al dashboard; en ese caso NO
  // reactivamos el boton (evita que parpadee "clickeable" mientras se
  // dispara la redireccion). Este flag controla ese comportamiento.
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

  // Todo el flujo va dentro de try/finally: pase lo que pase (exito, error
  // del servidor o excepcion de red), el boton y el spinner SIEMPRE se
  // restablecen en el finally. Asi nunca queda "atascado" en "Guardando...".
  try {
    console.log('[perfil] Enviando PUT /api/perfil con:', cuerpo);
    const respuesta = await apiFetch('/api/perfil', { method: 'PUT', body: JSON.stringify(cuerpo) });

    // apiFetch devuelve null cuando el backend respondio 401 (sesion
    // expirada): en ese caso ya redirigio al login, no hay nada mas que hacer.
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

    // --- Guardado exitoso (HTTP 200) -> actualizamos la UI ---
    console.log('[perfil] Guardado OK. Actualizando barra de completitud.');
    mostrarToast((respuesta.datos && respuesta.datos.mensaje) || 'Perfil actualizado correctamente', 'exito');

    const completitud = await renderizarWidgetCompletitud();
    console.log('[perfil] Completitud recalculada:', completitud);

    // Si el perfil quedo al 100%, celebramos antes de redirigir para que
    // el usuario alcance a ver el confeti y el mensaje de la mascota.
    let esperaRedireccion = 1200;
    if (completitud >= 100 && !localStorage.getItem('perfil360_confeti_100')) {
      lanzarConfeti();
      localStorage.setItem('perfil360_confeti_100', 'true');
      actualizarGloboMascota('¡Tu perfil quedó al 100%! Ya puedo recomendarte con toda precisión.');
      animarSaltoMascota();
      esperaRedireccion = 2600; // mas tiempo para disfrutar la celebracion
    }

    // Redireccion automatica al panel principal tras un exito (HU-RF-003).
    // Dejamos un pequeño margen para que el toast de exito sea visible.
    console.log('[perfil] Redirigiendo a dashboard.html en %d ms.', esperaRedireccion);
    redirigiendo = true;
    texto.textContent = 'Redirigiendo...';
    setTimeout(() => { window.location.href = 'dashboard.html'; }, esperaRedireccion);
    return; // evitamos reactivar el boton: ya nos vamos del formulario
  } catch (error) {
    // Manejo explicito de errores de red / excepciones inesperadas para
    // evitar fallos silenciosos (ej. "Uncaught (in promise)").
    console.error('[perfil] Error inesperado al guardar el perfil:', error);
    mostrarToast('Ocurrió un error inesperado al guardar. Revisa tu conexión e intenta de nuevo.', 'error');
  } finally {
    // En caso de exito con redireccion, dejamos el boton deshabilitado y el
    // spinner visible hasta que la navegacion ocurra. En cualquier otro caso
    // (error / validacion) restauramos el boton para que pueda reintentar.
    if (!redirigiendo) {
      boton.disabled = false;
      spinner.classList.remove('visible');
      texto.textContent = 'Guardar Perfil';
    }
  }
}
