# Estado de las historias de usuario — Gestor de Perfiles Magneto

Este documento detalla, criterio por criterio, cómo quedó resuelta cada
historia de usuario, dónde vive el código que la resuelve, y qué le
falta al proyecto (si algo) para estar 100% cerrado.

---

## HU-RF-001 — Registro e inicio de sesión ✅ (ya la tenían)

Sin cambios respecto a lo que ya habían construido.

---

## HU-RF-002 — Gestionar perfil profesional ✅

**Dónde vive:** `controllers/perfil.controller.js` (función `guardarPerfil`),
`public/perfil.html` + `public/js/perfil.js`.

| Criterio | Cómo se cumple |
|---|---|
| Guardar perfil → almacena en BD + notificación de éxito | El botón "Guardar Perfil" hace `PUT /api/perfil`; si todo sale bien, se muestra un toast verde "Perfil actualizado correctamente". |
| Bloquear avance con campos obligatorios vacíos, resaltar en rojo | `perfil.js` valida el paso actual antes de dejar avanzar (`validarPasoActual`); los campos vacíos obligatorios se marcan con la clase `campo--error` (borde rojo) y aparece el mensaje "Por favor completa los campos obligatorios para continuar" si intentas guardar sin los datos básicos. |
| Modificar/eliminar y reevaluar match automáticamente | Al guardar, el backend reemplaza por completo las filas de experiencia/educación/habilidades del perfil (permite editar o quitar filas libremente desde el formulario). El "match" nunca se guarda precalculado: se calcula al vuelo cada vez que el candidato pide sus recomendaciones (`vacantes.controller.js`), así que automáticamente refleja cualquier cambio del perfil sin tener que "recalcular y guardar" nada aparte. |

**Nota de alcance:** para simplificar el guardado (y evitar sincronizar
ediciones registro por registro), cada vez que guardas el perfil se
reemplazan completamente las listas de experiencia/educación/habilidades
con lo que esté en el formulario en ese momento. Funcionalmente es
equivalente a "editar o eliminar", solo que internamente se implementa
como "borra todo lo viejo, inserta todo lo nuevo" — más simple y
confiable para el alcance de un MVP académico.

---

## HU-RF-003 — Completitud del perfil con retroalimentación ✅

**Dónde vive:** `calcularCompletitud()` en `perfil.controller.js`,
mostrada en `public/dashboard.html` + `public/js/dashboard.js`.

| Criterio | Cómo se cumple |
|---|---|
| Barra de progreso con % en tiempo real | Al entrar al panel principal, se pide `GET /api/perfil`, que devuelve `completitud` (0-100) calculado con base en 4 secciones de 25% cada una (datos básicos, educación, experiencia, habilidades). La barra se pinta con ese valor. |
| Lista explícita de campos faltantes si no es 100% | El mismo endpoint devuelve `faltantes`: un arreglo de mensajes legibles ("Agrega al menos una experiencia laboral...", etc.), que se listan debajo de la barra. |

---

## HU-RF-004 — Cargar y sincronizar vacantes ✅ (simulado, ver justificación)

**Dónde vive:** `sincronizarVacantes()` en `vacantes.controller.js`,
botón en `public/admin-vacantes.html`.

| Criterio | Cómo se cumple |
|---|---|
| Botón "Sincronizar Vacantes" registra vacantes estructuradas | Inserta un catálogo de 8 vacantes de ejemplo (con habilidades, salario, modalidad y nivel educativo) si todavía no existen en la BD. |
| Vacante queda en estado "Activa" para el motor de match | Toda vacante se crea con `estado = 'activa'` por defecto. |
| Falla de red/formato → mensaje de advertencia | Implementado con manejo de errores (`try/catch` + rollback de transacción) que devuelve el mensaje exacto pedido. Para poder **demostrar** este caso en la sustentación sin depender de que algo realmente falle, se agregó un parámetro de prueba: `POST /api/vacantes/sincronizar?simular_error=true` fuerza esa respuesta. |

**Importante — léelo antes de la sustentación:** no existe una API
pública de Magneto a la que un estudiante pueda conectarse. Por eso este
endpoint *simula* la sincronización insertando un catálogo de vacantes
de ejemplo ya estructurado, en vez de llamar a un servicio externo real.
Esto cumple el criterio de aceptación tal como está escrito (que las
vacantes queden "registradas... con sus requisitos estructurados"), pero
es importante que lo mencionen así en su informe/sustentación para ser
honestos sobre el alcance: **la integración real con Magneto no existe,
está simulada a propósito.**

---

## HU-RF-005 — Consultar y administrar vacantes creadas ✅

**Dónde vive:** `listarVacantesAdmin` y `cambiarEstadoVacante` en
`vacantes.controller.js`, tabla en `public/admin-vacantes.html`.

| Criterio | Cómo se cumple |
|---|---|
| Listar vacantes con título, fecha y estado | Tabla que consume `GET /api/vacantes/admin`. |
| Cambiar a "Inactiva" → sale del feed + mensaje de confirmación | El interruptor (switch) llama a `PATCH /api/vacantes/:id/estado`; el filtro de `listarRecomendadas` solo trae vacantes con `estado = 'activa'`, así que una vacante inactiva desaparece del feed del candidato automáticamente. Se muestra el toast "Vacante pausada exitosamente". |

**Nota de alcance:** las historias no especificaron un login separado
para "empresas"; se implementó bajo el rol `admin` ya existente en el
sistema (ver README, sección "Crear tu primera cuenta de administrador").

---

## HU-RF-006 — Recomendar vacantes con explicación del match ✅

**Dónde vive:** `calcularMatch()`, `listarRecomendadas()` y
`obtenerDetalleMatch()` en `vacantes.controller.js`; pantalla
`public/vacantes.html`.

| Criterio | Cómo se cumple |
|---|---|
| Vacantes ordenadas descendente por % de coincidencia | `listarRecomendadas` calcula el match de cada vacante activa y las ordena con `.sort()` antes de responder. |
| "Ver detalle del match" → modal con habilidades coincidentes (verde) / faltantes (rojo) | Botón en cada tarjeta llama a `GET /api/vacantes/:id/match`, que devuelve `habilidades_coincidentes` y `habilidades_faltantes` por separado; el modal las pinta como chips verdes/rojos respectivamente. |

**Fórmula del match** (decisión de diseño ya discutida contigo): 80% del
puntaje según el % de habilidades requeridas que el candidato sí tiene,
20% según si su nivel educativo cumple o supera el requerido por la
vacante. Está en una sola función (`calcularMatch`) fácil de citar y
explicar en la sustentación.

---

## HU-RF-007 — Verificar estado de la postulación ✅

**Dónde vive:** `listarPostulaciones()` y `detallePostulacion()` en
`postulaciones.controller.js`; tablero en `public/postulaciones.html`.

| Criterio | Cómo se cumple |
|---|---|
| Tablero organizado en columnas por estado | `GET /api/postulaciones` trae todas las postulaciones del candidato; el frontend las agrupa en 5 columnas (postulado, en revisión, entrevista, aceptado, descartado). |
| Clic en tarjeta → panel lateral con fecha y motivo del estado actual | `GET /api/postulaciones/:id` devuelve el historial completo (`postulacion_historial`), mostrado como una línea de tiempo en el panel lateral. |
| Sin postulaciones → mensaje de estado vacío | Se muestra exactamente "No tienes postulaciones activas. Explora las vacantes para postularte" con un botón directo a Vacantes. |

**Nota de alcance importante:** ninguna historia de usuario que
recibimos indica **quién** mueve una postulación de una columna a otra
(por ejemplo, de "postulado" a "entrevista"). En la vida real eso lo
haría un reclutador desde el sistema interno de Magneto. Para que el
tablero tenga algo que mostrar y se pueda demostrar el historial
completo, se agregó `PATCH /api/postulaciones/:id/estado` (solo rol
`admin`) como mecanismo de avance manual. **Si en algún momento el
profesor les entrega una historia de usuario formal para esto, ya está
resuelta**; si no, tal como está ahora mismo cumple igual todos los
criterios de aceptación de HU-RF-007 (el candidato ve el tablero, el
detalle, y el estado vacío).

---

## HU-RF-008 — Filtrar vacantes por criterios clave ✅

**Dónde vive:** filtros en `listarRecomendadas()`
(`vacantes.controller.js`), barra de filtros en `public/vacantes.html`.

| Criterio | Cómo se cumple |
|---|---|
| Aplicar filtros → solo vacantes que cumplan todos los criterios | Los filtros (modalidad, rango salarial, nivel educativo) se mandan como query params y se agregan como condiciones `AND` en el SQL — todas deben cumplirse a la vez. |
| Sin resultados → mensaje específico | Si el arreglo de vacantes viene vacío, se muestra exactamente "No se encontraron vacantes con los criterios seleccionados. Intenta ajustar los filtros". |

---

## HU-RF-009 — Postular a una vacante ✅

**Dónde vive:** `postular()` en `postulaciones.controller.js`, botón
"Postular" en cada tarjeta de `public/vacantes.html`.

| Criterio | Cómo se cumple |
|---|---|
| Postular → registra, estado inicial "Postulado", mensaje de éxito | `POST /api/postulaciones` inserta la postulación y su primera fila de historial; responde "Postulación registrada exitosamente". |
| Postular 2 veces a la misma vacante → bloqueado, sin duplicado | La tabla `postulaciones` tiene una restricción `UNIQUE (usuario_id, vacante_id)`; si se viola, mysql2 devuelve el código `ER_DUP_ENTRY`, que el backend traduce al mensaje "Ya has postulado a esta vacante" (409), sin crear ninguna fila nueva. |
| Postulación exitosa aparece de inmediato en el tablero | El tablero simplemente lee de la misma tabla `postulaciones` en tiempo real cada vez que se visita la página — no hay caché ni retraso. |

---

## Requisitos no funcionales

### HU-RNF-001 — Rendimiento del cálculo de match ✅ (con nota)

El cálculo es una comparación de conjuntos (habilidades) en memoria —
computacionalmente trivial, del orden de milisegundos incluso con
cientos de vacantes. **No se hizo una prueba de carga formal** (no tiene
sentido con datos de ejemplo tan pequeños); si el profesor pide evidencia
cuantitativa, se puede medir con `console.time()` alrededor del bucle en
`listarRecomendadas()` y reportar el resultado.

### HU-RNF-002 — Cifrado y trazabilidad ✅

- Contraseñas con `bcrypt` (10 rondas) — ya estaba desde la HU de login.
- Cada cambio de estado de una postulación se guarda de forma
  **inmutable** (nunca se actualiza ni se borra) en
  `postulacion_historial`, con fecha y hora automáticas.
- Todas las rutas protegidas exigen un JWT válido
  (`middlewares/auth.middleware.js`); sin token o con token
  inválido/expirado, la API responde 401 y el frontend (`utils.js`,
  función `apiFetch`) redirige automáticamente al login.

### HU-RNF-003 — Validación en tiempo real ✅

Implementado en el formulario de perfil (`perfil.js`): los campos
vacíos/inválidos se marcan en rojo (`campo--error`) mientras el usuario
escribe, y el intento de avanzar de sección sin llenar lo obligatorio
queda bloqueado hasta corregir.

### HU-RNF-004 — Confirmar antes de eliminar elementos críticos ✅

Función reutilizable `confirmarAccion()` en `utils.js` (un modal de
confirmación genérico, no uno distinto por pantalla). Se usa antes de
pausar una vacante en `admin-vacantes.js`. Si el candidato cancela, no se
altera nada en la base de datos.

---

## Qué NO se construyó (y por qué)

- **Integración real con la API de Magneto**: no existe acceso público
  para estudiantes; la sincronización está simulada a propósito (ver
  HU-RF-004 arriba). Si el profesor exige una integración real, sería
  necesario conseguir credenciales/documentación oficial de Magneto —
  algo fuera del alcance de un proyecto de curso.
- **Motor de match con IA externa**: decisión conjunta de usar un
  algoritmo propio explicable en vez de una API de terceros (ver
  justificación en el README, sección "Decisiones de arquitectura").
- **Rol "Empresa" separado de "Administrador"**: HU-RF-005 menciona
  ambos actores indistintamente; se implementó como un solo rol `admin`
  para no complicar el modelo de permisos sin una historia de usuario
  que especifique la diferencia real entre ambos.
- **Endpoint formal para que un reclutador mueva postulaciones de
  columna**: no vino una historia de usuario para esto; se agregó una
  versión mínima (ver nota en HU-RF-007) para que el tablero sea
  demostrable de principio a fin.

Si necesitas que profundicemos en cualquiera de estos puntos, o llegan
historias de usuario nuevas del profesor, dímelo y seguimos.
