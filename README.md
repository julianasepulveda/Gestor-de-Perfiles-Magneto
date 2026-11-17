# Gestor de Perfiles — Magneto (Perfil 360)

Plataforma web para la gestión de perfiles profesionales y la recomendación
explicable de vacantes. El sistema permite a un candidato construir su perfil,
recibir vacantes ordenadas por afinidad —indicando qué habilidades coinciden y
cuáles faltan—, postularse, y hacer seguimiento a cada proceso en un tablero de
trazabilidad. Incorpora un simulador de entrevistas con IA y un centro de
notificaciones en tiempo real.

---

## 1. Problema y solución

Los portales de empleo tradicionales operan como una "caja negra": el candidato
postula sin entender por qué no avanza, qué habilidades le faltan frente a lo que
exige el mercado, ni en qué estado está cada proceso. Esta falta de
**explicabilidad** genera frustración y **ausentismo en entrevistas**, porque el
candidato llega sin preparación ni contexto.

Perfil 360 aborda el problema con tres mecanismos:

- **Match explicable:** cada vacante muestra un porcentaje de coincidencia y el
  desglose de habilidades cumplidas (verde) y faltantes (rojo), con una fórmula
  transparente (80% habilidades, 20% nivel educativo).
- **Trazabilidad:** un tablero Kanban muestra el avance de cada postulación
  (postulado, en revisión, entrevista, aceptado, descartado, cancelada) con un
  historial inmutable de cada cambio de estado.
- **Preparación asistida por IA:** un simulador genera una mentoría técnica
  enfocada en las debilidades del candidato (preguntas técnicas, escenario
  conductual y consejos) antes de la entrevista, reduciendo el ausentismo y
  mejorando la tasa de éxito.

---

## 2. Arquitectura de software

El sistema sigue un modelo **Cliente/Servidor** con una separación en **tres
capas** y organización **MVC** en el backend:

- **Capa de presentación (cliente):** HTML5, CSS3 y JavaScript (Vanilla) servidos
  como contenido estático. El navegador consume la API REST mediante `fetch`.
- **Capa de lógica de negocio (servidor):** Node.js + Express, estructurado en
  rutas, controladores, middlewares y servicios.
- **Capa de datos:** MySQL, accedida con `mysql2` mediante un pool de conexiones
  y consultas parametrizadas.

Flujo de una petición:

```
Navegador (public/) --HTTP/JSON--> Rutas (routes/) --> Middleware (auth)
     --> Controladores (controllers/) --> Servicios (services/) --> MySQL
```

### Patrones de diseño aplicados

| Patrón | Dónde | Propósito |
|---|---|---|
| **Strategy** | `controllers/vacantes.controller.js` (`obtenerMatch`) | Selecciona en tiempo de ejecución el motor de match: algoritmo matemático 80/20 o IA (Groq), con fallback automático al algoritmo si la IA falla. |
| **Observer** | `services/notificaciones.observer.js` | `NotificacionSubject` emite eventos de negocio a observadores (`AuditoriaObserver`, `AlertaCandidatoObserver`) sin que los controladores conozcan las reacciones. |
| **Singleton** | `config/db.js` | Un único pool de conexiones a MySQL compartido por toda la aplicación. |
| **Middleware (Chain of Responsibility)** | `middlewares/auth.middleware.js` | `verificarToken` y `verificarRol` se encadenan antes del controlador, cortando la petición si la sesión o los permisos no son válidos. |

---

## 3. Stack tecnológico

- **Runtime:** Node.js
- **Framework web:** Express
- **Base de datos:** MySQL (driver `mysql2`)
- **Autenticación:** JWT (`jsonwebtoken`) + cifrado de contraseñas con `bcryptjs`
- **IA:** Groq API (modelo `openai/gpt-oss-20b`) para el simulador de entrevistas
  y el motor de match basado en IA
- **Frontend:** HTML5, CSS3, JavaScript (sin framework)
- **Utilidades:** `cors`, `dotenv`

---

## 4. Estructura del proyecto

```
gestor-perfiles-magneto/
├── config/
│   └── db.js                      # Pool de conexiones MySQL (Singleton)
├── controllers/                   # Lógica de negocio
│   ├── auth.controller.js
│   ├── perfil.controller.js
│   ├── vacantes.controller.js     # Incluye el motor de match (Strategy)
│   ├── postulaciones.controller.js# Tablero, mentoría IA, retirar
│   ├── habilidades.controller.js
│   └── notificaciones.controller.js
├── routes/                        # Definición de endpoints REST
│   ├── auth.routes.js
│   ├── perfil.routes.js
│   ├── vacantes.routes.js
│   ├── postulaciones.routes.js
│   ├── habilidades.routes.js
│   └── notificaciones.routes.js
├── middlewares/
│   └── auth.middleware.js         # verificarToken / verificarRol (JWT)
├── services/
│   └── notificaciones.observer.js # Centro de notificaciones (Observer)
├── db/
│   ├── schema.sql                 # Esquema completo de la base de datos
│   ├── migracion-cancelada-y-mentoria.sql
│   └── migracion-notificaciones.sql
├── public/                        # Frontend estático
│   ├── *.html
│   ├── css/style.css
│   ├── js/
│   └── img/
├── server.js                      # Punto de entrada
├── .env                           # Variables de entorno (NO se versiona)
└── package.json
```

---

## 5. Instalación local

### Requisitos previos

- Node.js 18 o superior
- MySQL 8 (o MariaDB equivalente)

### Pasos

1. Clonar el repositorio e instalar dependencias:

   ```bash
   git clone https://github.com/julianasepulveda/Gestor-de-Perfiles-Magneto.git
   cd Gestor-de-Perfiles-Magneto
   npm install
   ```

2. Crear la base de datos ejecutando el esquema:

   ```bash
   mysql -u root -p < db/schema.sql
   ```

   Si ya tenías una versión anterior de la base, aplica las migraciones en vez
   de recrearla:

   ```bash
   mysql -u root -p perfil360 < db/migracion-cancelada-y-mentoria.sql
   mysql -u root -p perfil360 < db/migracion-notificaciones.sql
   ```

3. Crear el archivo `.env` en la raíz (ver sección 6).

4. Iniciar el servidor:

   ```bash
   npm start
   ```

   El servidor queda disponible en `http://localhost:3000`.

---

## 6. Variables de entorno (`.env`)

El archivo `.env` no se versiona (está en `.gitignore`) porque contiene secretos.
Crea uno en la raíz con las siguientes claves:

```env
# Conexión a MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password_mysql
DB_NAME=perfil360

# Servidor
PORT=3000

# Clave para firmar los tokens de sesión (usa un texto largo y único)
JWT_SECRET=una_clave_secreta_larga_y_unica

# Motor de match: "ia" (Groq con fallback) o "algoritmo" (solo matemático)
MOTOR_MATCH=ia

# Clave de la API de Groq (requerida solo si MOTOR_MATCH=ia y para la mentoría)
GROQ_API_KEY=tu_api_key_de_groq
```

> El sistema funciona sin `GROQ_API_KEY`: si la IA no está disponible, el motor
> de match cae automáticamente al algoritmo 80/20. El simulador de entrevistas sí
> requiere la clave para generar la mentoría.

---

## 7. Roles y pasos de prueba

El sistema maneja dos roles: **candidato** (por defecto al registrarse) y
**administrador**.

### Candidato

1. Registrarse desde `register.html` con un correo y contraseña (mínimo 8
   caracteres). La cuenta se crea con rol `candidato`.
2. Completar el perfil en `perfil.html` (datos básicos, educación, experiencia y
   habilidades). La barra de completitud y la mascota reaccionan en tiempo real.
3. Ver vacantes recomendadas en `vacantes.html`, revisar el detalle del match y
   postularse.
4. Seguir el proceso en `postulaciones.html`: completar la mentoría IA, retirar
   una postulación y consultar las notificaciones en la campana del navbar.

### Administrador

El rol `admin` no se asigna desde la interfaz; se establece directamente en la
base de datos sobre una cuenta ya registrada:

```sql
UPDATE usuarios SET rol = 'admin' WHERE correo = 'tu_correo_registrado';
```

Con una cuenta `admin` se habilita `admin-vacantes.html`, donde se pueden
sincronizar y crear vacantes, y cambiar su estado (activa/inactiva).

---

## 8. Endpoints principales de la API

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/api/auth/register` | Registro de usuario | Público |
| POST | `/api/auth/login` | Inicio de sesión (devuelve JWT) | Público |
| GET/PUT | `/api/perfil` | Consultar / guardar perfil | Candidato |
| GET | `/api/habilidades` | Catálogo de habilidades | Autenticado |
| GET | `/api/vacantes/recomendadas` | Vacantes con match | Candidato |
| GET | `/api/vacantes/:id/match` | Detalle del match (IA) | Candidato |
| POST | `/api/postulaciones` | Postularse a una vacante | Candidato |
| POST | `/api/postulaciones/:id/simular` | Generar mentoría IA | Candidato |
| PATCH | `/api/postulaciones/:id/completar-simulacion` | Finalizar mentoría | Candidato |
| GET | `/api/postulaciones/:id/mentoria` | Consultar mentoría guardada | Candidato |
| PATCH | `/api/postulaciones/:id/cancelar` | Retirar postulación | Candidato |
| GET | `/api/notificaciones` | Notificaciones + no leídas | Autenticado |
| PATCH | `/api/notificaciones/leer-todas` | Marcar como leídas | Autenticado |
| POST | `/api/vacantes` | Crear vacante | Admin |
| PATCH | `/api/vacantes/:id/estado` | Activar/pausar vacante | Admin |

---

## 9. Seguridad

- Contraseñas cifradas con `bcrypt`.
- Autenticación por JWT, validada en un middleware central; las rutas protegidas
  responden `401`/`403` ante tokens o permisos inválidos.
- Consultas SQL parametrizadas en todo el acceso a datos para prevenir inyección.
- Los secretos (claves, credenciales) se gestionan por variables de entorno y
  nunca se versionan.

---

## 10. Integrantes del equipo

| Nombre completo |

| David Alzate Monroy |
| Juliana Sepúlveda|
|Stephanie Jaramillo Alzate|
|Sebastián Andrés Ibarra Prada|

> Proyecto desarrollado para el curso de Ingeniería de Software.

