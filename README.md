# Gestor de Perfiles — Magneto (Perfil 360)

Proyecto de Ingeniería de Software — Universidad / Cohorte 4to semestre.

## Integrantes
- David Alzate
- Sebastian Ibarra
- Juliana Sepúlveda
- Stephanie Jaramillo

---

## ¿Qué es esto?

Un portal donde un **candidato** construye su perfil profesional, recibe
vacantes recomendadas de Magneto con un porcentaje de coincidencia
explicado (qué habilidades sí tiene, cuáles le faltan), puede postularse,
y le hace seguimiento a cada proceso en un tablero de trazabilidad. Un
**administrador** sincroniza las vacantes disponibles y controla su
visibilidad.

## Stack técnico

- **Backend**: Node.js + Express
- **Base de datos**: MySQL (mysql2)
- **Autenticación**: JWT + bcrypt
- **Frontend**: HTML + CSS + JavaScript puro (sin frameworks)

## Arquitectura

Monolito modular en capas (no microservicios — ver justificación
completa más abajo en la sección "Decisiones de arquitectura"):

```
gestor-perfiles-magneto/
├── server.js                    # Punto de entrada
├── middlewares/
│   └── auth.middleware.js       # Verifica JWT y rol (candidato/admin)
├── config/db.js                 # Conexión a MySQL (pool)
├── controllers/                 # Logica de negocio, un archivo por módulo
│   ├── auth.controller.js
│   ├── perfil.controller.js
│   ├── vacantes.controller.js
│   └── postulaciones.controller.js
├── routes/                      # Qué URL dispara qué controller
│   ├── auth.routes.js
│   ├── perfil.routes.js
│   ├── vacantes.routes.js
│   └── postulaciones.routes.js
├── db/schema.sql                # Todas las tablas de la base de datos
└── public/                      # Frontend
    ├── login.html / register.html / dashboard.html
    ├── perfil.html              # Formulario guiado (stepper)
    ├── vacantes.html            # Recomendaciones + filtros + match
    ├── postulaciones.html       # Tablero Kanban de trazabilidad
    ├── admin-vacantes.html      # Panel de administración
    ├── css/style.css
    └── js/ (un .js por pantalla + utils.js con funciones compartidas)
```

---

## 1. Requisitos previos

- Node.js 18+
- MySQL (o MariaDB) corriendo localmente
- VS Code

## 2. Configurar la base de datos

Ejecuta el script completo en tu cliente de MySQL:

```bash
mysql -u root -p < db/schema.sql
```

Esto crea la base `perfil360` y las 10 tablas del sistema (usuarios,
perfiles, experiencias, educaciones, habilidades, vacantes, postulaciones,
sus tablas de relación, e historial).

**Buena práctica de seguridad**: en vez de usar el usuario `root` para la
app, crea un usuario dedicado con permisos solo sobre esta base:

```sql
CREATE USER 'perfil360app'@'localhost' IDENTIFIED BY 'una_clave_segura_tuya';
GRANT ALL PRIVILEGES ON perfil360.* TO 'perfil360app'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Configurar `.env`

Copia `.env.example` a `.env` y coloca tus datos reales:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=perfil360app
DB_PASSWORD=una_clave_segura_tuya
DB_NAME=perfil360
PORT=3000
JWT_SECRET=un_texto_secreto_largo_e_inventado_por_ti
```

⚠️ **Nunca subas tu `.env` real a GitHub** (ya está en `.gitignore`). Si
en algún momento tu `.env` quedó expuesto públicamente, cambia esa
contraseña de MySQL de inmediato.

## 4. Instalar dependencias y correr

```bash
npm install
npm start        # o: npm run dev  (con reinicio automático)
```

Abre `http://localhost:3000` → te redirige al login.

## 5. Crear tu primera cuenta de administrador

Por diseño, **todo registro nuevo se crea como `candidato`** (así lo pide
la historia de usuario de registro). Para tener una cuenta `admin` de
prueba:

1. Regístrate normalmente desde `/register.html` con cualquier correo.
2. En MySQL, ejecuta:
   ```sql
   UPDATE usuarios SET rol = 'admin' WHERE correo = 'tu_correo@ejemplo.com';
   ```
3. Cierra sesión y vuelve a iniciar sesión con ese correo — ahora te
   redirige al panel de administración de vacantes.

## 6. Flujo recomendado para probar todo el sistema

1. Crea una cuenta **admin** (paso anterior) → entra a "Administrar
   vacantes" → presiona **"Sincronizar Vacantes"** (esto carga 8
   vacantes de ejemplo, simulando la fuente de Magneto).
2. Crea una cuenta **candidato** → ve a **"Mi perfil"** → completa las
   4 secciones del formulario guiado y guarda.
3. Ve a **"Vacantes"** → verás las 8 vacantes ordenadas por % de
   coincidencia con tu perfil, con filtros arriba.
4. Haz clic en **"Ver detalle del match"** en cualquiera → verás qué
   habilidades coinciden (verde) y cuáles te faltan (rojo).
5. Presiona **"Postular"** en alguna vacante.
6. Ve a **"Postulaciones"** → verás tu tablero Kanban con la tarjeta en
   la columna "Postulado". Haz clic en la tarjeta para ver el detalle.
7. (Opcional, para ver el tablero "moverse") Vuelve a MySQL y ejecuta
   manualmente un cambio de estado, o usa la ruta
   `PATCH /api/postulaciones/:id/estado` con Postman/Thunder Client
   estando logueado como admin, con body
   `{ "estado": "entrevista", "motivo": "..." }`.

---

## Decisiones de arquitectura

**Monolito modular en capas, no microservicios.** Con 4 módulos
relacionados (auth, perfil, vacantes, postulaciones) que comparten la
misma base de datos relacional, separar en microservicios agregaría
complejidad de orquestación, redes y despliegue sin ningún beneficio
real para un proyecto académico de este tamaño — sería sobre-ingeniería.
En cambio, cada módulo sigue el mismo patrón interno
(`routes → controller → base de datos`), lo cual:
- Es fácil de explicar y sustentar.
- Permite que cada integrante del equipo tome un módulo sin pisarse con
  los demás (mismo patrón, distinto archivo).
- Escala agregando más módulos sin rediseñar nada.

**Motor de recomendación: algoritmo propio, no una API de IA externa.**
El valor central del proyecto es la *explicabilidad*. Un cálculo
determinístico (80% del puntaje según habilidades coincidentes, 20%
según si el nivel educativo cumple lo requerido) es 100% auditable,
gratis, instantáneo, y no depende de un servicio externo que podría
fallar o tener rate limits el día de la sustentación.

**Sincronización de vacantes simulada.** No existe una API pública de
Magneto para estudiantes, así que `POST /api/vacantes/sincronizar`
inserta un catálogo de 8 vacantes de ejemplo (con habilidades y
requisitos estructurados) si aún no existen en la base de datos —
exactamente el mismo efecto que tendría una integración real, sin
depender de credenciales de terceros.

---

## Historias de usuario cubiertas

| Historia | Estado |
|---|---|
| HU-RF-001 Registro e inicio de sesión | ✅ |
| HU-RF-002 Gestionar perfil profesional | ✅ |
| HU-RF-003 Completitud del perfil con retroalimentación | ✅ |
| HU-RF-004 Cargar y sincronizar vacantes (simulado) | ✅ |
| HU-RF-005 Consultar y administrar vacantes | ✅ |
| HU-RF-006 Recomendar vacantes con explicación del match | ✅ |
| HU-RF-007 Verificar estado de la postulación (tablero) | ✅ |
| HU-RF-008 Filtrar vacantes por criterios clave | ✅ |
| HU-RF-009 Postular a una vacante | ✅ |
| HU-RNF-001 Rendimiento del cálculo de match | ✅ (ver nota) |
| HU-RNF-002 Cifrado y trazabilidad | ✅ |
| HU-RNF-003 Validación en tiempo real | ✅ |
| HU-RNF-004 Confirmar antes de eliminar/pausar | ✅ |

Ver `ESTADO-HISTORIAS-DE-USUARIO.md` para el detalle de cómo se cumple
cada criterio de aceptación, uno por uno.
