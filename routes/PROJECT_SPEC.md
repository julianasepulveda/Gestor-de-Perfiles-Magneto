# Especificación del Proyecto: Gestor de Perfiles - Magneto (Perfil 360)

## 1. Contexto y Propósito
El sistema resuelve la falta de explicabilidad en los portales de empleo tradicionales. El candidato construye su perfil profesional (experiencia, educación, habilidades) y el sistema recomienda vacantes bajo un criterio de coincidencia claro (explicando qué habilidades faltan o coinciden). Incluye un tablero de trazabilidad para ver el estado de cada postulación (postulado, en revisión, entrevista, descartado).

## 2. Stack Tecnológico
- Backend: Node.js, Express
- Base de Datos: MySQL (mysql2)
- Autenticación: JWT + bcrypt
- Frontend: HTML5, CSS3, Vanilla JavaScript (DOM manipulation)

## 3. Historias de Usuario y Criterios de Aceptación (Rúbrica)
- **HU-RF-002 - Gestionar perfil profesional:** El candidato llena un formulario guiado. Al dar "Guardar Perfil", se almacena en BD y muestra "Perfil actualizado correctamente". Si hay campos vacíos obligatorios, se bloquea el avance, se resaltan en rojo y muestra "Por favor completa los campos obligatorios...". Permite modificar/eliminar registros y reevalúa el match automáticamente.
- **HU-RF-003 - Indicar completitud del perfil:** Al ingresar, se despliega una barra de progreso que calcula el % completado en tiempo real. Si no es 100%, muestra una lista explícita de campos faltantes.
- **HU-RF-004 - Cargar y sincronizar vacantes (Admin):** Módulo para que un rol "admin" importe/registre vacantes estructuradas (requisitos, educación, habilidades clave). Al registrarse, quedan en estado "Activa" para el motor de match.
- **HU-RF-005 - Consultar y administrar vacantes:** El administrador puede ver las vacantes y cambiar su estado.
- **Resto del Flujo:** El sistema debe recomendar vacantes según completitud, permitir postularse a la vacante (solo una vez por vacante) y mostrar un tablero de postulaciones.

## 4. Bugs Críticos a Solucionar (Prioridad 1)
- **Bug de Login:** Al iniciar sesión con una cuenta ya registrada, el sistema no recuerda el estado previo o bloquea el acceso.
- **Bug de Guardado de Perfil:** Al dar "Guardar perfil", falla la persistencia, entra en bucle y la barra no se actualiza. Una vez guardado la primera vez, debe permitir editarlo correctamente con buena persistencia.
- **Barra de Completitud Estática:** La barra de HU-RF-003 no está reaccionando a medida que se llena el formulario. Debe ser 100% dinámica.
- **Bug de Vacantes Recomendadas (Match fallido):** Actualmente no están apareciendo las vacantes recomendadas en la vista del candidato. El sistema debe cruzar correctamente las habilidades del usuario guardadas en la base de datos con las habilidades clave de las vacantes activas y mostrarlas ordenadas de mayor a menor porcentaje de coincidencia.


## 5. Requerimientos de UI/UX, Gamificación y Diseño
- **Diseño Profesional e Innovador:** Respetar la colorimetría de la empresa. Eliminar emoticonos genéricos, agrandar la barra de búsqueda y lograr un aspecto visual agradable y muy profesional.
- **Gamificación (Logo interactivo):** El logo de la plataforma debe estar presente en todos los formularios y debe tener animaciones interactuando con el usuario (ej. apuntando a campos, reaccionando cuando se completa una sección).
- **Tablero de Postulaciones:** Debe mostrarse como una tabla profesional o tablero Kanban claro que refleje el avance.

## 6. Módulo de Administrador (Simulación)
- Debe existir una vista para el rol Administrador donde pueda publicar/crear vacantes manualmente (asignando salario, modalidad, nivel educativo y habilidades clave) para que se inserten en la BD y alimenten el algoritmo de match de los candidatos.