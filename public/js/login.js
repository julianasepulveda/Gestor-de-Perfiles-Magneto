// Logica de la pantalla de inicio de sesion.
// Se conecta con el backend en POST /api/auth/login

const API_BASE = '';

const form = document.getElementById('form-login');
const inputCorreo = document.getElementById('correo');
const inputPassword = document.getElementById('password');
const alertaError = document.getElementById('alerta-error');
const btnLogin = document.getElementById('btn-login');
const spinner = document.getElementById('spinner-login');
const textoBtn = document.getElementById('texto-btn-login');

document.getElementById('toggle-pass').addEventListener('click', () => {
  const esPassword = inputPassword.type === 'password';
  inputPassword.type = esPassword ? 'text' : 'password';
});

function ponerCargando(cargando) {
  btnLogin.disabled = cargando;
  spinner.classList.toggle('visible', cargando);
  textoBtn.textContent = cargando ? 'Ingresando...' : 'Iniciar Sesión';
}

function mostrarAlerta(mensaje) {
  alertaError.textContent = mensaje;
  alertaError.classList.add('visible');
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  alertaError.classList.remove('visible');

  const correo = inputCorreo.value.trim();
  const password = inputPassword.value;

  if (!correo || !password) {
    mostrarAlerta('Credenciales inválidas. Verifica tu correo y contraseña');
    return;
  }

  ponerCargando(true);

  try {
    const respuesta = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password })
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      // El formulario se queda en la misma pantalla (no navegamos a otro lado)
      mostrarAlerta(datos.mensaje || 'Credenciales inválidas. Verifica tu correo y contraseña');
      return;
    }

    // Blindaje: solo consideramos el login exitoso si el backend realmente
    // devolvio un token y el usuario. Sin esta comprobacion, si "datos.token"
    // viniera vacio o undefined, localStorage guardaria la cadena "undefined",
    // protegerPagina() la aceptaria como valida y la app mandaria el header
    // "Bearer undefined" -> el backend responde 401 -> apiFetch borra la
    // sesion y vuelve al login en bucle (el "bloqueo de acceso" reportado).
    if (!datos.token || !datos.usuario) {
      mostrarAlerta('No se pudo iniciar sesión. Intenta de nuevo.');
      return;
    }

    // Login exitoso: guardamos el token y el usuario, y redirigimos.
    // Se limpia la bandera del confeti para que la celebracion de "perfil
    // 100%" pueda volver a dispararse para la cuenta que inicia sesion.
    localStorage.setItem('perfil360_token', datos.token);
    localStorage.setItem('perfil360_usuario', JSON.stringify(datos.usuario));

    window.location.href = 'dashboard.html';

  } catch (error) {
    console.error(error);
    mostrarAlerta('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.');
  } finally {
    ponerCargando(false);
  }
});
