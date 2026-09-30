# Guía completa de los módulos nuevos — Perfil, Vacantes y Postulaciones

Esta guía explica, con el mismo nivel de detalle que la guía de Node.js
desde cero que ya tienes, **todo el código agregado** para las historias
HU-RF-002 a HU-RF-009 y los requisitos no funcionales. Si ya leíste
`GUIA-PROFUNDA-NODE.md`, aquí no se repiten los conceptos básicos de
Node/Express/JWT — solo lo nuevo.

---

# 1. El middleware de autenticación (`middlewares/auth.middleware.js`)

Hasta ahora, `login`/`register` eran las únicas rutas de la API. Todo lo
nuevo (perfil, vacantes, postulaciones) necesita saber **quién** está
haciendo la petición y **qué rol** tiene, sin pedir la contraseña de
nuevo en cada clic. Para eso existen los middlewares de autenticación.

```js
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado...' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, mensaje: 'Sesión inválida o expirada...' });
  }
}
```

- `req.headers.authorization` es donde el frontend manda el token, con
  el formato `Bearer <token>` (es una convención estándar de HTTP, no
  algo que inventamos nosotros).
- `jwt.verify(...)` hace dos cosas a la vez: (1) confirma que la firma
  del token es válida (que de verdad lo generó tu backend con tu
  `JWT_SECRET`, y no fue alterado), y (2) confirma que no ha expirado.
  Si cualquiera de las dos falla, **lanza un error** — por eso está en
  un `try/catch`.
- `req.usuario = payload` — aquí es donde "inyectamos" la identidad del
  usuario dentro de la petición, para que el controller de turno (por
  ejemplo, `perfil.controller.js`) pueda leer `req.usuario.id` sin tener
  que volver a decodificar nada.
- `next()` es la función que Express le pasa a todo middleware: significa
  "ya terminé mi trabajo, deja que la petición siga su camino hacia el
  controller". Si nunca llamas a `next()`, la petición se queda
  colgada para siempre — es el error más común al escribir un
  middleware por primera vez.

```js
function verificarRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ ok: false, mensaje: 'No tienes permisos...' });
    }
    next();
  };
}
```

Esto es una **función que devuelve otra función** (un patrón llamado
"factory" o "higher-order function"). Se usa así en las rutas:

```js
router.post('/sincronizar', verificarToken, verificarRol('admin'), sincronizarVacantes);
```

Express ejecuta esa lista de izquierda a derecha: primero
`verificarToken` (¿quién eres?), luego `verificarRol('admin')` (¿tienes
permiso?), y solo si ambos llaman a `next()`, se ejecuta finalmente
`sincronizarVacantes`. Por qué `verificarRol('admin')` y no
`verificarRol` a secas: al escribirlo con paréntesis y el string
`'admin'`, se está *llamando* a la función factory ahí mismo, que
inmediatamente devuelve la función real de middleware ya "configurada"
para exigir el rol admin. Es lo que permite reusar el mismo middleware
para distintos roles sin duplicar código (`verificarRol('admin')`,
`verificarRol('candidato', 'admin')`, etc.).

**401 vs 403 — la diferencia importa:**
- **401 (Unauthorized)**: "no sé quién eres" (no mandaste token, o es
  inválido/expiró). El frontend, al recibir un 401, borra la sesión y
  te manda al login (ver `apiFetch` en `utils.js`, más abajo).
- **403 (Forbidden)**: "sé quién eres, pero no puedes hacer esto" (un
  candidato tratando de sincronizar vacantes, por ejemplo). El frontend
  no te saca de la sesión en este caso, porque tu sesión sigue siendo
  válida — simplemente no tienes permiso para esa acción puntual.

---

# 2. Módulo Perfil (`controllers/perfil.controller.js`)

## 2.1 El truco `ON DUPLICATE KEY UPDATE` para habilidades

```js
async function obtenerOCrearHabilidad(nombre) {
  const [resultado] = await pool.query(
    'INSERT INTO habilidades (nombre) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
    [nombreLimpio]
  );
  return resultado.insertId;
}
```

Las habilidades viven en un catálogo compartido (tabla `habilidades`)
porque tanto los perfiles como las vacantes las usan, y no queremos que
"Node.js" se guarde 50 veces distinto en la base de datos. El problema:
¿cómo insertas una habilidad solo si no existe, y en cualquier caso
obtienes su `id`, en una sola consulta (sin primero hacer un SELECT y
luego un INSERT por separado, que sería más lento y propenso a errores
de concurrencia)?

La respuesta es este truco de MySQL: intentas insertar; si ya existe una
fila con ese `nombre` (recuerda que la columna tiene `UNIQUE`), en vez
de fallar, ejecuta la parte de `ON DUPLICATE KEY UPDATE`. El truco
`id = LAST_INSERT_ID(id)` hace que, aunque técnicamentesea un "UPDATE",
MySQL reporte ese `id` existente como si fuera el "insertId" — así tu
código en JavaScript siempre puede leer `resultado.insertId` sin
importar si la habilidad era nueva o ya existía.

## 2.2 `calcularCompletitud()` — por qué está separada y exportada

```js
function calcularCompletitud({ perfil, experiencias, educaciones, habilidades }) { ... }
module.exports = { obtenerPerfil, guardarPerfil, calcularCompletitud };
```

Esta función NO habla con la base de datos ni con `req`/`res` — solo
recibe datos y devuelve un número y una lista. Eso la hace una **función
pura**: mismo input, siempre mismo output, fácil de probar de forma
aislada. Se exporta porque, en teoría, otros módulos podrían necesitar
saber qué tan completo está un perfil (por ejemplo, si más adelante
quisieran no recomendar vacantes a perfiles muy incompletos).

## 2.3 Transacciones en `guardarPerfil()` — el concepto más importante de este módulo

```js
const conexion = await pool.getConnection();
try {
  await conexion.beginTransaction();
  // ... varios INSERT/UPDATE/DELETE ...
  await conexion.commit();
} catch (error) {
  await conexion.rollback();
  // ...
} finally {
  conexion.release();
}
```

Guardar un perfil implica *varias* operaciones separadas: actualizar
los datos básicos, borrar y reinsertar experiencias, borrar y reinsertar
educaciones, borrar y reinsertar habilidades. **¿Qué pasa si el
servidor se cae justo después de borrar las experiencias viejas, pero
antes de insertar las nuevas?** Sin transacciones, el candidato se
quedaría sin ninguna experiencia guardada — un estado a medias,
corrupto.

Una **transacción** agrupa varias operaciones en un solo "todo o nada":
- `beginTransaction()`: "a partir de aquí, nada de lo que haga es
  definitivo todavía".
- Si todo sale bien, `commit()`: "confirma todos los cambios de una vez,
  de forma permanente".
- Si algo falla en el medio (el `catch` se activa), `rollback()`:
  "deshaz todo lo que había pasado desde el `beginTransaction`, como si
  nunca hubiera ocurrido".

`pool.getConnection()` en vez de `pool.query()` directo: las
transacciones necesitan que **todas** las consultas se ejecuten sobre
la **misma conexión** física a MySQL (si usaras `pool.query()`
normal, cada llamada podría tomar una conexión distinta del pool, y
MySQL no sabría que pertenecen al mismo "todo o nada"). Por eso se pide
prestada una conexión específica con `getConnection()`, se usa esa
misma variable (`conexion`) para todo, y **es obligatorio** liberarla al
final con `conexion.release()` — de ahí el `finally`, que se ejecuta
siempre, haya éxito o error.

## 2.4 Por qué se "borra todo y se reinserta" en vez de editar fila por fila

```js
await conexion.query('DELETE FROM experiencias WHERE perfil_id = ?', [perfilId]);
for (const exp of experiencias) { /* insertar cada una */ }
```

Sincronizar ediciones "inteligentemente" (detectar cuál fila cambió,
cuál se borró, cuál es nueva) es mucho más código y más propenso a
bugs. Para el alcance de este proyecto, es perfectamente válido (y más
simple de mantener) simplemente reemplazar toda la lista cada vez que
el candidato guarda su perfil. La única diferencia práctica es que los
`id` de experiencias/educaciones cambian en cada guardado — lo cual no
importa porque el frontend nunca depende de esos ids permanecer iguales
entre sesiones.

---

# 3. Módulo Vacantes (`controllers/vacantes.controller.js`)

## 3.1 El catálogo de ejemplo (`VACANTES_DE_EJEMPLO`)

Es un array de objetos JavaScript "hardcodeado" (escrito directamente en
el código) que simula lo que vendría de una API real de Magneto. Cada
vez que se llama `sincronizarVacantes()`, se recorre este array y, por
cada vacante, se verifica si ya existe (por título+empresa) antes de
insertarla — así puedes llamar "Sincronizar" muchas veces sin duplicar
nada.

## 3.2 Dos motores de match: algoritmo vs. inteligencia artificial

### El algoritmo (`calcularMatch`)

```js
const puntajeHabilidades = habilidadesVacante.length > 0
  ? coincidentes.length / habilidadesVacante.length
  : 1;
...
const porcentaje = Math.round((puntajeHabilidades * 0.8 + (cumpleEducacion ? 1 : 0) * 0.2) * 100);
```

Es matemática simple: cuenta cuántas de las habilidades que pide la
vacante SÍ tiene el candidato (`Set` se usa para que la búsqueda
`.has()` sea instantánea, en vez de recorrer el array completo cada
vez con `.includes()`), calcula qué proporción es esa, y la combina en
un 80/20 con si el nivel educativo alcanza. Todo el resultado se puede
explicar en una frase, y cualquiera puede verificarlo a mano con una
calculadora — de eso se trata "explicable".

### La IA (`calcularMatchIA`)

```js
const respuesta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
  body: JSON.stringify({
    model: 'llama-3.1-8b-instant',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: instruccionSistema },
      { role: 'user', content: JSON.stringify(datosParaElModelo) }
    ]
  }),
  signal: controlador.signal
});
```

Aquí, en vez de calcular nada nosotros, le mandamos los datos (perfil +
vacante) a un modelo de lenguaje alojado por Groq, con instrucciones
estrictas de responder **solo** un JSON con esa forma exacta. Detalles
importantes:

- **`fetch` nativo de Node**: desde Node 18, `fetch` viene incluido, no
  hace falta instalar ninguna librería para hacer peticiones HTTP salientes.
- **`temperature: 0`**: los modelos de lenguaje tienen un parámetro de
  "aleatoriedad". En 0, el modelo intenta ser lo más consistente posible
  dando la misma respuesta ante la misma pregunta — aun así, a
  diferencia del algoritmo, **no hay garantía matemática** de que sea
  100% igual siempre (esta es una de las razones por las que se
  recomendó el algoritmo como opción principal).
- **`response_format: { type: 'json_object' }`**: le pide a la API que
  fuerce su salida a ser JSON válido (sin esto, un modelo de lenguaje
  a veces agrega texto de más como "¡Claro! aquí está tu resultado:").
- **`AbortController` + `setTimeout`**: si la API tarda más de 8
  segundos, se cancela la petición en vez de dejar al usuario esperando
  indefinidamente. Esto es una buena práctica siempre que tu código
  dependa de un servicio externo que no controlas.
- **`JSON.parse(contenidoTexto)`**: la respuesta de la API viene como
  *texto* (aunque ese texto tenga forma de JSON); hay que convertirlo a
  un objeto de JavaScript real antes de poder leer sus propiedades.

## 3.3 `obtenerMatch()` — el patrón "Strategy" explicado simple

```js
async function obtenerMatch(...) {
  if (process.env.MOTOR_MATCH === 'ia') {
    try {
      return await calcularMatchIA(...);
    } catch (error) {
      console.error('⚠️  Fallo el motor de IA, usando el algoritmo como respaldo:', error.message);
      return calcularMatch(...);
    }
  }
  return calcularMatch(...);
}
```

En programación, cuando tienes **dos formas distintas de resolver el
mismo problema** y quieres poder cambiar entre ellas sin reescribir el
código que las usa, se le llama patrón "Strategy". Aquí, el resto del
controller (`listarRecomendadas`, `obtenerDetalleMatch`) **nunca** llama
directamente a `calcularMatch` ni a `calcularMatchIA` — siempre llama a
`obtenerMatch`, que decide cuál usar según la variable de entorno
`MOTOR_MATCH`. Ventajas de este diseño:

- Cambiar de motor es editar **una sola línea** en tu `.env`, sin tocar
  ningún archivo de código.
- Si la IA falla (sin internet, sin API key, rate limit, JSON mal
  formado), el `catch` automáticamente usa el algoritmo como respaldo
  — el sistema **nunca se cae** por culpa de un problema externo, solo
  se "degrada" a la opción más simple. Esto es una práctica muy
  valorada en sistemas reales: preferir una respuesta imperfecta pero
  inmediata, a un error total.

## 3.4 ¿Cómo comparar cuál te conviene entregar?

| | Algoritmo propio | IA (Groq) |
|---|---|---|
| **Explicabilidad** | Total — cualquiera puede verificar el cálculo a mano | Parcial — el modelo "decide" internamente, no puedes probar matemáticamente por qué dio ese número exacto |
| **Velocidad** | Instantáneo (milisegundos) | Depende de la red y de Groq — normalmente 0.5 a 3 segundos, pero puede variar |
| **Costo** | Gratis siempre | Gratis dentro del límite de la capa gratuita de Groq; si el profesor o muchos usuarios lo prueban a la vez, podrías toparte con un rate limit |
| **Dependencias externas** | Ninguna | Requiere internet + una API key + que el servicio de Groq esté disponible ese día |
| **Consistencia** | Exactamente el mismo resultado siempre para los mismos datos | Con `temperature: 0` es bastante consistente, pero no 100% garantizado matemáticamente |
| **Qué tan fácil es defenderlo en la sustentación** | Muy fácil: "esto es una regla de negocio simple que programamos nosotros" | Requiere explicar cómo funciona un LLM, qué es un prompt, y admitir que no controlas el cálculo exacto |

**Recomendación práctica**: entrega con `MOTOR_MATCH=algoritmo` (el
valor por defecto) para la sustentación — es más seguro y más fácil de
defender frente al profesor. Si quieres *mostrar* el motor de IA como
un plus/extra opcional durante la demo, puedes cambiar la variable de
entorno en vivo y reiniciar el servidor para que vean ambos
funcionando, dejando claro cuál es el que realmente usa el sistema por
defecto.

## 3.5 Filtros dinámicos con SQL (HU-RF-008)

```js
let sql = `SELECT ... FROM vacantes WHERE estado = 'activa'`;
const params = [];

if (modalidad) {
  sql += ' AND modalidad = ?';
  params.push(modalidad);
}
```

En vez de escribir una consulta SQL fija, se va **construyendo el texto
de la consulta poco a poco**, agregando un `AND campo = ?` solo si ese
filtro realmente llegó en la petición. El array `params` se llena en el
mismo orden en que se van agregando los `?` al texto — mysql2 los
empareja por posición. Este patrón te permite tener filtros
"opcionales" sin necesitar una consulta distinta escrita a mano por
cada combinación posible de filtros.

---

# 4. Módulo Postulaciones (`controllers/postulaciones.controller.js`)

## 4.1 Cómo se evita postular dos veces (HU-RF-009, sin usar un `SELECT` antes)

```sql
UNIQUE KEY uq_usuario_vacante (usuario_id, vacante_id)
```
(esto está en `db/schema.sql`, tabla `postulaciones`)

```js
try {
  const [resultado] = await conexion.query('INSERT INTO postulaciones ...', [...]);
  ...
} catch (errorInterno) {
  if (errorInterno.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ ok: false, mensaje: 'Ya has postulado a esta vacante' });
  }
  throw errorInterno;
}
```

Una alternativa "ingenua" sería primero hacer un `SELECT` para ver si ya
existe una postulación, y solo si no existe, hacer el `INSERT`. El
problema: entre ese `SELECT` y ese `INSERT` podría pasar una fracción de
segundo en la que otra petición (por ejemplo, el usuario hizo doble
clic sin querer) inserte la misma fila — a esto se le llama una
**condición de carrera** (race condition). La solución más robusta es
dejar que la propia base de datos garantice la regla con una
restricción `UNIQUE`, e interceptar el error específico
(`ER_DUP_ENTRY`, el código que usa mysql2/MySQL para "ya existe una fila
que viola una restricción UNIQUE") para traducirlo a un mensaje
amigable. Es más simple, y matemáticamente imposible de "ganarle" con
mala suerte de timing.

## 4.2 El historial inmutable (HU-RNF-002)

```js
await conexion.query(
  'INSERT INTO postulacion_historial (postulacion_id, estado, motivo) VALUES (?, ?, ?)',
  [resultado.insertId, 'postulado', 'Postulación registrada por el candidato.']
);
```

Cada vez que el estado de una postulación cambia, se **inserta una fila
nueva** en `postulacion_historial` — nunca se actualiza ni se borra
ninguna fila anterior. Esto es lo que hace que el historial sea
"inmutable": es un registro permanente de todo lo que pasó, con fecha y
hora automáticas (`DEFAULT CURRENT_TIMESTAMP`), tal como lo pide
HU-RNF-002 ("el sistema debe registrar cada cambio de estado... con
fecha y hora").

---

# 5. El frontend nuevo

## 5.1 `public/js/utils.js` — por qué existe

Sin este archivo, cada pantalla nueva (`perfil.js`, `vacantes.js`, etc.)
tendría que repetir: cómo mandar el token en cada `fetch`, qué hacer si
el backend responde 401, cómo mostrar una notificación, cómo pedir
confirmación antes de una acción crítica. Centralizarlo en un solo
archivo, cargado en todas las páginas protegidas, es aplicar el
principio **DRY (Don't Repeat Yourself)**.

```js
async function apiFetch(ruta, opciones = {}) {
  const token = localStorage.getItem('perfil360_token');
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opciones.headers || {}) }
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
```

El operador `...` (spread) dentro de `headers` combina tres objetos en
uno: el `Content-Type` fijo, el `Authorization` (solo si hay token —
por eso el `? :` condicional dentro de un objeto), y cualquier header
extra que la pantalla que llama haya querido agregar. Si el backend
responde 401 en cualquier punto de la app, `apiFetch` se encarga de
limpiar la sesión y redirigir — así ninguna pantalla nueva tiene que
acordarse de hacerlo manualmente, es automático con solo usar esta
función en vez de `fetch` directo.

`confirmarAccion()` usa una `Promise` para poder usarse con `await`
aunque internamente dependa de que el usuario haga clic en un botón (un
evento asíncrono por naturaleza):

```js
function confirmarAccion({ titulo, mensaje, ... }) {
  return new Promise((resolve) => {
    // ...crea el modal...
    overlay.querySelector('#confirmar-cancelar').addEventListener('click', () => limpiar(false));
    overlay.querySelector('#confirmar-aceptar').addEventListener('click', () => limpiar(true));
  });
}
```
`new Promise((resolve) => {...})` crea una promesa que se queda "en
espera" hasta que en algún punto del código se llama a `resolve(valor)`
— en este caso, no se resuelve hasta que el usuario haga clic en uno de
los dos botones. Por eso, quien llama a esta función puede escribir:

```js
const confirmado = await confirmarAccion({ ... });
if (!confirmado) return;
```
Como si fuera una pregunta bloqueante normal, aunque por dentro esté
esperando una interacción humana en la pantalla.

## 5.2 `perfil.js` — el stepper (formulario por pasos)

La idea central: solo un `<div class="paso-formulario">` tiene la clase
`activo` a la vez (CSS lo esconde con `display: none` si no la tiene).
`irAlPaso(numero)` es la única función que cambia cuál paso se ve:

```js
function irAlPaso(numero) {
  pasoActual = numero;
  document.querySelectorAll('.paso-formulario').forEach(el => {
    el.classList.toggle('activo', Number(el.dataset.paso) === pasoActual);
  });
  ...
}
```

`classList.toggle('activo', condicion)` es una forma corta de decir
"agrega la clase si `condicion` es verdadera, quítala si es falsa" —
evita escribir un `if/else` con `.add()`/`.remove()` por separado.

### Filas repetibles con `<template>`

```html
<template id="plantilla-educacion"> ... </template>
```
```js
function agregarFila(tipo, datosIniciales = null) {
  const plantilla = document.getElementById(`plantilla-${tipo}`);
  const clon = plantilla.content.cloneNode(true);
  ...
  document.getElementById(...).appendChild(clon);
}
```

La etiqueta HTML `<template>` es un fragmento de HTML que el navegador
**no renderiza** por sí solo — es solo un molde guardado en memoria.
`cloneNode(true)` crea una copia completa e independiente de ese molde
(el `true` significa "clona también todo lo de adentro, no solo la
etiqueta exterior"). Esto permite agregar tantas filas de experiencia o
educación como el usuario quiera, cada una siendo una copia nueva e
independiente del HTML original, sin tener que escribir el HTML a mano
con JavaScript (`innerHTML +=`, que es más propenso a errores y a
problemas de seguridad).

### Validación en tiempo real (HU-RNF-003)

```js
function validarFilasRepetibles(selectorFila, mostrarErrores) {
  const filas = document.querySelectorAll(selectorFila);
  let todoValido = true;
  filas.forEach(fila => {
    const campos = fila.querySelectorAll('[data-campo]');
    const algunoLleno = Array.from(campos).some(c => c.value.trim() !== '');
    campos.forEach(campo => {
      const esInvalido = algunoLleno && campo.hasAttribute('required') && campo.value.trim() === '';
      if (esInvalido) todoValido = false;
      if (mostrarErrores) marcarCampo(campo, !esInvalido);
    });
  });
  return todoValido;
}
```

La regla de negocio aquí es sutil: una fila completamente vacía no es un
error (el usuario simplemente no quiso agregar esa experiencia), pero
una fila **a medio llenar** sí lo es (si escribiste el cargo pero no la
empresa, eso está incompleto). Por eso primero se calcula `algunoLleno`
(¿esta fila tiene *algo* escrito?), y el campo solo se marca como
inválido si la fila tiene algo Y ese campo específico está vacío Y ese
campo es obligatorio.

## 5.3 `vacantes.js` — armar la URL de los filtros

```js
function construirQueryFiltros() {
  const params = new URLSearchParams();
  if (modalidad) params.set('modalidad', modalidad);
  ...
  return params.toString();
}
```

`URLSearchParams` es una utilidad nativa del navegador para construir
correctamente la parte de una URL después del `?` (se encarga de
"escapar" caracteres especiales automáticamente, algo que sería fácil
de hacer mal armando el string a mano con `+`). `.toString()` la
convierte en el texto final, por ejemplo:
`modalidad=remoto&salario_min=3000000`.

## 5.4 `postulaciones.js` — agrupar en columnas sin pedirle nada extra al backend

```js
const COLUMNAS = [
  { estado: 'postulado', titulo: 'Postulado' },
  ...
];

COLUMNAS.forEach(columna => {
  const items = postulaciones.filter(p => p.estado === columna.estado);
  ...
});
```

El backend simplemente devuelve **todas** las postulaciones del
candidato en una sola lista plana. Es el frontend quien decide
agruparlas visualmente en columnas, usando `.filter()` para quedarse
solo con las que coinciden con el estado de cada columna. Esto mantiene
el backend simple (no tiene que preocuparse por cómo se ve el tablero) y
deja la lógica de presentación donde corresponde: en el frontend.

## 5.5 `admin-vacantes.js` — deshacer un cambio visual si el usuario cancela

```js
checkbox.addEventListener('change', () => manejarCambioEstado(checkbox, vacante));

async function manejarCambioEstado(checkbox, vacante) {
  if (nuevoEstado === 'inactiva') {
    const confirmado = await confirmarAccion({ ... });
    if (!confirmado) {
      checkbox.checked = true; // revertir el switch visualmente
      return;
    }
  }
  ...
}
```

El evento `change` de un checkbox se dispara **después** de que el
usuario ya lo movió visualmente. Si el usuario cancela la confirmación,
hay que "deshacer" ese movimiento a mano (`checkbox.checked = true`),
o el switch quedaría mostrando un estado que en realidad no se aplicó
— un detalle pequeño pero importante para que la interfaz nunca mienta
sobre el estado real de los datos.

---

# 6. Cómo seguir extendiendo el proyecto tú solo

Si el profesor agrega una historia de usuario nueva, el patrón a seguir
siempre es el mismo (ya lo aplicaste 3 veces: perfil, vacantes,
postulaciones):

1. ¿Necesitas guardar algo nuevo? Agrega la tabla en `db/schema.sql`.
2. Crea `controllers/nombre.controller.js` con la lógica de negocio.
3. Crea `routes/nombre.routes.js` que conecte URLs a esas funciones,
   protegidas con `verificarToken` (y `verificarRol(...)` si aplica).
4. Móntala en `server.js`: `app.use('/api/nombre', nombreRoutes);`
5. Crea la pantalla en `public/nombre.html` + `public/js/nombre.js`,
   reutilizando `utils.js` para las llamadas a la API, el navbar, y las
   notificaciones/confirmaciones.
