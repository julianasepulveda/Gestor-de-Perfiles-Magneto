// Logica del panel de administracion de vacantes.
// Cubre HU-RF-004 (sincronizar), HU-RF-005 (listar y cambiar estado)
// y HU-RNF-004 (confirmar antes de pausar una vacante).

const usuario = protegerPaginaPorRol(['admin']);

if (usuario) {
  activarBotonSalir();
  document.getElementById('btn-sincronizar').addEventListener('click', sincronizarVacantes);
  cargarVacantes();
}

async function cargarVacantes() {
  const cuerpoTabla = document.getElementById('cuerpo-tabla-vacantes');
  const respuesta = await apiFetch('/api/vacantes/admin');

  if (!respuesta || !respuesta.ok) {
    cuerpoTabla.innerHTML = '<tr><td colspan="5">No se pudieron cargar las vacantes.</td></tr>';
    return;
  }

  const { vacantes } = respuesta.datos;

  if (vacantes.length === 0) {
    cuerpoTabla.innerHTML = `
      <tr><td colspan="5" style="text-align:center; padding:40px; color:var(--gris-texto);">
        Aún no hay vacantes registradas. Presiona "Sincronizar Vacantes" para traer las disponibles desde Magneto.
      </td></tr>`;
    return;
  }

  cuerpoTabla.innerHTML = '';
  vacantes.forEach(v => cuerpoTabla.appendChild(crearFilaVacante(v)));
}

function formatearFecha(fechaTexto) {
  const fecha = new Date(fechaTexto);
  return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function crearFilaVacante(vacante) {
  const fila = document.createElement('tr');
  const activa = vacante.estado === 'activa';

  fila.innerHTML = `
    <td>${vacante.titulo}</td>
    <td style="text-transform:capitalize;">${vacante.modalidad}</td>
    <td>${formatearFecha(vacante.creado_en)}</td>
    <td><span class="badge-estado badge-estado--${vacante.estado}">${activa ? 'Activa' : 'Inactiva'}</span></td>
    <td>
      <label class="interruptor">
        <input type="checkbox" ${activa ? 'checked' : ''} data-id="${vacante.id}" />
        <span class="interruptor__deslizador"></span>
      </label>
    </td>
  `;

  const checkbox = fila.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', () => manejarCambioEstado(checkbox, vacante));

  return fila;
}

async function manejarCambioEstado(checkbox, vacante) {
  const nuevoEstado = checkbox.checked ? 'activa' : 'inactiva';

  // Confirmacion antes de pausar una vacante (HU-RNF-004): retirar
  // una oferta del feed de candidatos es una accion critica.
  if (nuevoEstado === 'inactiva') {
    const confirmado = await confirmarAccion({
      titulo: '¿Pausar esta vacante?',
      mensaje: `"${vacante.titulo}" dejará de mostrarse en el feed de los candidatos. Podrás reactivarla cuando quieras.`,
      textoConfirmar: 'Sí, pausar',
      textoCancelar: 'Cancelar'
    });

    if (!confirmado) {
      checkbox.checked = true; // revertir el switch visualmente
      return;
    }
  }

  const respuesta = await apiFetch(`/api/vacantes/${vacante.id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado: nuevoEstado })
  });

  if (!respuesta || !respuesta.ok) {
    mostrarToast('No se pudo actualizar el estado de la vacante.', 'error');
    checkbox.checked = !checkbox.checked; // revertir
    return;
  }

  mostrarToast(respuesta.datos.mensaje, 'exito');
  cargarVacantes(); // refresca la tabla (badge de estado, etc.)
}

async function sincronizarVacantes() {
  const boton = document.getElementById('btn-sincronizar');
  const spinner = document.getElementById('spinner-sincronizar');
  const texto = document.getElementById('texto-btn-sincronizar');
  const alertaError = document.getElementById('alerta-error');
  const alertaExito = document.getElementById('alerta-exito');

  alertaError.classList.remove('visible');
  alertaExito.classList.remove('visible');
  boton.disabled = true;
  spinner.classList.add('visible');
  texto.textContent = 'Sincronizando...';

  const respuesta = await apiFetch('/api/vacantes/sincronizar', { method: 'POST' });

  boton.disabled = false;
  spinner.classList.remove('visible');
  texto.textContent = '🔄 Sincronizar Vacantes';

  if (!respuesta) return;

  if (!respuesta.ok) {
    alertaError.textContent = respuesta.datos.mensaje || 'Error al sincronizar vacantes. Verifique la conexión con la fuente de datos';
    alertaError.classList.add('visible');
    return;
  }

  alertaExito.textContent = respuesta.datos.mensaje;
  alertaExito.classList.add('visible');
  cargarVacantes();
}
