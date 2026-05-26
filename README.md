# MusiGym Musicala

Plataforma web inicial para MusiGym: práctica artística con rutas, rutinas, bitácoras, diagnósticos, autoevaluación, biblioteca embebida, llamado al profe e informes mensuales.

## Qué incluye

- Login con Google usando Firebase Auth.
- Roles: `admin`, `docente`, `estudiante`.
- Sincronización de estudiantes desde el Apps Script actual de Bitácoras de clase.
- Colecciones propias de MusiGym en Firestore.
- Activación manual de estudiantes MusiGym.
- Asignación de arte, instrumento, énfasis, nivel y docente.
- Panel Admin, Panel Docente y Panel Estudiante.
- Rutina automática inicial por reglas.
- MusiCoach conversacional simulado: recomienda qué practicar hoy usando objetivos, ruta, canciones, diagnóstico, sesiones y autoevaluaciones.
- Chat de apoyo para estudiante con modos de práctica, objetivos, ruta, explicación, motivación y versión suave.
- Registro opcional de interacciones de MusiCoach en Firestore (`musigym_coach_logs`).
- Ruta de avance inicial para guitarra y ruta general para otras artes.
- Biblioteca de guitarra embebida desde `assets/guitar-library.csv`.
- Llamado al profe con alarma visual/sonora para admin/docente.
- Diagnóstico inicial por estudiante.
- Bitácoras/sesiones.
- Autoevaluación post-sesión.
- Canciones deseadas por el estudiante.
- Generador de informes mensuales basado en sesiones, diagnóstico, ruta y autoevaluaciones.
- PWA básica con `manifest.webmanifest` y `sw.js`.

## Cómo probar localmente

No abrir con doble clic porque los módulos y el CSV pueden fallar por restricciones del navegador. Usar servidor local:

```bash
python -m http.server 8080
```

Luego abrir:

```txt
http://localhost:8080
```

## Archivos principales

```txt
index.html
styles.css
js/config.js
js/firebase.js
js/data.js
js/app.js
js/utils.js
assets/logo.png
assets/guitar-library.csv
apps-script/bitacoras-students-api.gs
firebase-rules/firestore.rules
manifest.webmanifest
sw.js
```

## Configuración importante

En `js/config.js` están:

- Config de Firebase actual del proyecto Bitácoras.
- URL del Apps Script que trae estudiantes desde Sheets.
- Correos bootstrap admin.
- Nombres de colecciones Firestore.

## Orden recomendado para probar

1. Abrir la app e iniciar sesión con un correo admin.
2. Ir a Admin.
3. Activar la alarma de llamados.
4. Sincronizar estudiantes desde Sheets.
5. Activar un estudiante como MusiGym.
6. Asignarle arte, instrumento, énfasis, nivel y docente.
7. Crear diagnóstico inicial.
8. Crear objetivos.
9. Crear rutina automática.
10. Registrar una sesión.
11. Entrar como estudiante o usar “Ver como estudiante”.
12. Probar MusiCoach con “¿Qué practico hoy?”, “Según mis objetivos”, “¿Qué sigue?” y el chat libre.
13. Agregar autoevaluación/canción deseada.
14. Generar informe mensual.

## Nota sobre la alarma

Los navegadores bloquean sonido automático si el docente no ha interactuado antes con la página. Por eso existe el botón “Activar alarma de llamados”. El docente/admin debe oprimirlo al abrir su panel.

## Nota sobre la biblioteca embebida

La app intenta abrir los recursos dentro de un iframe. Algunas páginas, Google Docs o Drive pueden bloquear la carga embebida por seguridad. En esos casos aparece también el botón para abrir externo.

## Próximos pasos buenos para Codex

- Reemplazar prompts nativos por modales bonitos.
- Agregar carga real de fotos/videos a Storage en bitácoras.
- Conectar MusiCoach a IA real con API segura desde backend/Cloud Function, usando el contexto pedagógico que ya arma esta versión.
- Crear calendario de reservas de espacios MusiGym.
- Mejorar filtros docentes por `teacherEmail` cuando todos los docentes ya estén asignados.
- Agregar exportación PDF de informes mensuales.
- Integrar biblioteca por arte/instrumento y no solo guitarra.
