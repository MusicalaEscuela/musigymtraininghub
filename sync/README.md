# Sincronización de rutas: Bitácoras de clase → MusiGym

MusiGym muestra la "Ruta de avance" leyendo la colección
`musigym_route_templates` de su propio Firebase. Este script copia las
plantillas de ruta desde el Firebase de **Bitácoras de clase**
(`route_templates`) hacia esa colección.

Si la colección está vacía, MusiGym usa las rutas locales (`DEFAULT_ROUTES`
en `js/config.js`) como respaldo, así que nada se rompe si no corre el sync.

## Mapeo
- Por **instrumento/área**: cada plantilla de bitácoras se guarda en MusiGym
  con la clave del instrumento (`guitarra`, `general`, …).
- Las metas (`customGoals`) de bitácoras se transforman a los ítems que
  MusiGym pinta: `{ id, component, level, title, description }`.
- La "experiencia" (número) se traduce a nivel: 1=Inicial, 2=Básico,
  3=Intermedio, 4=Avanzado.

## Requisitos
1. Node.js 18+
2. Instalar dependencias:
   ```
   cd sync
   npm install firebase-admin
   ```
3. Dos claves de servicio (Firebase Console → ⚙️ Configuración del proyecto →
   Cuentas de servicio → Generar nueva clave privada):
   - `serviceAccount.bitacoras.json` (proyecto **bitacoras-de-clase**)
   - `serviceAccount.musigym.json` (proyecto **musigym-training-hub**)

   ⚠️ Estos archivos están en `.gitignore`. Nunca los subas al repo.

## Ejecutar
```
node sync/sync-route-templates.js
```

## Que corra solo
- **Manual:** ejecútalo cada vez que cambies rutas en bitácoras.
- **Automático (recomendado):** agéndalo con el Programador de tareas de
  Windows, un cron, o una GitHub Action diaria.
- **Casi en vivo:** alternativamente, una Cloud Function en bitácoras con
  trigger `onWrite` sobre `route_templates` que escriba en el Firestore de
  MusiGym (misma lógica de transformación de este script).
