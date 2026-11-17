// Centro de Notificaciones — implementacion del patron Observer.
//
// El sujeto (NotificacionSubject) mantiene una lista de observadores y los
// notifica ante un evento de negocio. Los controladores emiten el evento con
// notificar(evento) sin conocer a los observadores concretos (desacople,
// principio abierto/cerrado: se pueden agregar reacciones sin modificar el
// emisor). Un evento es un objeto con la forma:
//   { tipo, usuarioId, titulo, mensaje, enlace }

const { pool } = require('../config/db');

/**
 * Sujeto observable del patron Observer. Registra observadores y les
 * propaga los eventos de negocio.
 */
class NotificacionSubject {
  constructor() {
    this._observadores = [];
  }

  /**
   * Registra un observador que implemente actualizar(evento).
   * @param {{actualizar: Function, nombre?: string}} observador
   * @returns {NotificacionSubject} la propia instancia (encadenable).
   */
  suscribir(observador) {
    if (observador && typeof observador.actualizar === 'function' && !this._observadores.includes(observador)) {
      this._observadores.push(observador);
    }
    return this;
  }

  /**
   * Elimina un observador previamente registrado.
   * @param {object} observador
   * @returns {NotificacionSubject} la propia instancia (encadenable).
   */
  desuscribir(observador) {
    this._observadores = this._observadores.filter(o => o !== observador);
    return this;
  }

  /**
   * Propaga un evento a todos los observadores. Cada observador se ejecuta
   * de forma aislada: un fallo en uno no afecta a los demas ni al flujo de
   * negocio que emitio el evento (la notificacion es un efecto secundario).
   * @param {{tipo: string, usuarioId: number, titulo: string, mensaje: string, enlace?: string}} evento
   * @returns {void}
   */
  notificar(evento) {
    this._observadores.forEach(observador => {
      Promise.resolve()
        .then(() => observador.actualizar(evento))
        .catch(err => console.error(`[Notificaciones] Observador "${observador.nombre || 'anonimo'}" fallo:`, err.message));
    });
  }
}

/**
 * Observador concreto de auditoria: registra en consola cada evento
 * emitido, para trazabilidad, sin acoplar esa responsabilidad al emisor.
 */
class AuditoriaObserver {
  constructor() {
    this.nombre = 'AuditoriaObserver';
  }

  /**
   * @param {{tipo: string, usuarioId: number, titulo: string}} evento
   * @returns {Promise<void>}
   */
  async actualizar(evento) {
    const fecha = new Date().toISOString();
    console.log('[AUDITORIA %s] tipo=%s usuario=%s titulo="%s"', fecha, evento.tipo, evento.usuarioId, evento.titulo);
  }
}

/**
 * Observador concreto que persiste la notificacion en la tabla
 * 'notificaciones' para mostrarla al candidato en el navbar.
 */
class AlertaCandidatoObserver {
  constructor() {
    this.nombre = 'AlertaCandidatoObserver';
  }

  /**
   * Inserta la notificacion si el evento trae los campos minimos.
   * @param {{usuarioId: number, titulo: string, mensaje: string, enlace?: string}} evento
   * @returns {Promise<void>}
   */
  async actualizar(evento) {
    if (!evento || !evento.usuarioId || !evento.titulo || !evento.mensaje) {
      console.warn('[AlertaCandidatoObserver] evento incompleto, no se persiste:', evento);
      return;
    }
    await pool.query(
      'INSERT INTO notificaciones (usuario_id, titulo, mensaje, enlace) VALUES (?, ?, ?, ?)',
      [evento.usuarioId, evento.titulo, evento.mensaje, evento.enlace || null]
    );
  }
}

// Instancia unica del sujeto, ya suscrita con los dos observadores. Es la
// que importan los controladores para emitir eventos con notificar().
const notificaciones = new NotificacionSubject();
notificaciones.suscribir(new AuditoriaObserver());
notificaciones.suscribir(new AlertaCandidatoObserver());

module.exports = {
  notificaciones,
  NotificacionSubject,
  AuditoriaObserver,
  AlertaCandidatoObserver
};
