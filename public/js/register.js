// Logica de la pantalla de registro.
// Se conecta con el backend en POST /api/auth/register

const API_BASE = ''; // mismo origen (el backend sirve este HTML)

const form = document.getElementById('form-registro');
const inputCorreo = document.getElementById('correo');
const inputPassword = document.getElementById('password');
const alertaError = document.getElementById('alerta-error');
const errorCorreo = document.getElementById('error-correo');
const errorPassword = document.getElementById('error-password');
const btnRegistrar = document.getElementById('btn-registrar');
const spinner = document.getElementById('spinner-registro');
const textoBtn = document.getElementById('texto-btn-registrar');
const modalExito = document.getElementById('modal-exito');
const btnIrLogin = document.getElementById('btn-ir-login');

const MIN_PASSWORD_LENGTH = 8;

// --- Mostrar / ocultar contraseña ---
document.getElementById('toggle-pass').addEventListener('click', () => {
  const esPassword = inputPassword.type === 'password';
  inputPassword.type = esPassword ? 'text' : 'password';
});

function limpiarErrores() {
  alertaError.classList.remove('visible');
  alertaError.textContent = '';
  [errorCorreo, errorPassword].forEach(el => {
    el.classList.remove('visible');
    el.textContent = '';
  });
  inputCorreo.classList.remove('campo--error');
  inputPassword.classList.remove('campo--error');
}

function mostrarErrorCampo(input, elError, mensaje) {
  input.classList.add('campo--error');
  elError.textContent = mensaje;
  elError.classList.add('visible');
}

function validarFormulario() {
  let valido = true;
  const correo = inputCorreo.value.trim();
  const password = inputPassword.value;

  const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!correo || !regexCorreo.test(correo)) {
    mostrarErrorCampo(inputCorreo, errorCorreo, 'Ingresa un correo electrónico válido.');
    valido = false;
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    mostrarErrorCampo(inputPassword, errorPassword, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    valido = false;
  }

  return valido;
}

function ponerCargando(cargando) {
  btnRegistrar.disabled = cargando;
  spinner.classList.toggle('visible', cargando);
  textoBtn.textContent = cargando ? 'Registrando...' : 'Registrarse';
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limpiarErrores();

  if (!validarFormulario()) return;

  const correo = inputCorreo.value.trim();
  const password = inputPassword.value;

  ponerCargando(true);

  try {
    const respuesta = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password })
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      // Caso: correo ya registrado, u otra validacion del backend
      alertaError.textContent = datos.mensaje || 'No se pudo completar el registro.';
      alertaError.classList.add('visible');
      return;
    }

    // Registro exitoso -> mostrar modal de confirmacion
    modalExito.classList.add('visible');
    form.reset();

  } catch (error) {
    console.error(error);
    alertaError.textContent = 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.';
    alertaError.classList.add('visible');
  } finally {
    ponerCargando(false);
  }
});

btnIrLogin.addEventListener('click', () => {
  window.location.href = 'login.html';
});
