// Logica de la pantalla "Mi perfil" (formulario guiado / stepper).
// Cubre HU-RF-002, HU-RF-003 (indirectamente, via el dashboard) y
// HU-RNF-003 (validacion en tiempo real).

const usuario = protegerPagina();
if (usuario) {
  construirNavbarCandidato('perfil.html');
  activarBotonSalir();
  renderizarWidgetCompletitud();
  inicializarFormulario();
}

const TIPS_MASCOTA = {
  1: '¡Empecemos! Cuéntame tu nivel educativo, tu modalidad preferida y un poco sobre ti.',
  2: 'Ahora tu formación académica. Puedes agregar varios registros si quieres.',
  3: '¿Alguna experiencia laboral? No te preocupes si es tu primer trabajo, puedes dejarlo vacío.',
  4: '¡Último paso! Escribe tus habilidades y presiona Enter después de cada una.'
};

let pasoActual = 1;
const TOTAL_PASOS = 4;
let habilidadesActuales = []; // array de strings

async function inicializarFormulario() {
  configurarStepper();
  configurarFilasRepetibles();
  configurarChipsHabilidades();
  configurarValidacionTiempoReal();
  mostrarMascotaGuia('mascota-guia-perfil', TIPS_MASCOTA[1]);

  await cargarPerfilExistente();

  document.getElementById('form-perfil').addEventListener('submit', guardarPerfil);
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

  mostrarMascotaGuia('mascota-guia-perfil', TIPS_MASCOTA[pasoActual]);

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

async function guardarPerfil(evento) {
  evento.preventDefault();

  if (!validarPaso1(true)) {
    irAlPaso(1);
    return;
  }

  const boton = document.getElementById('btn-guardar');
  const spinner = document.getElementById('spinner-guardar');
  const texto = document.getElementById('texto-btn-guardar');

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

  const respuesta = await apiFetch('/api/perfil', { method: 'PUT', body: JSON.stringify(cuerpo) });

  boton.disabled = false;
  spinner.classList.remove('visible');
  texto.textContent = 'Guardar Perfil';

  if (!respuesta) return;

  if (!respuesta.ok) {
    mostrarToast(respuesta.datos.mensaje || 'No se pudo guardar tu perfil.', 'error');
    return;
  }

  mostrarToast(respuesta.datos.mensaje || 'Perfil actualizado correctamente', 'exito');

  const completitud = await renderizarWidgetCompletitud();
  if (completitud >= 100 && !localStorage.getItem('perfil360_confeti_100')) {
    lanzarConfeti();
    localStorage.setItem('perfil360_confeti_100', 'true');
    mostrarMascotaGuia('mascota-guia-perfil', '🎉 ¡Tu perfil quedó 100% completo! Ya puedo recomendarte con toda precisión.');
  }
}
