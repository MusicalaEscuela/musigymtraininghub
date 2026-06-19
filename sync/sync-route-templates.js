/**
 * Sincroniza las plantillas de ruta desde "Bitácoras de clase"
 * (proyecto Firebase: bitacoras-de-clase, colección: route_templates)
 * hacia MusiGym (proyecto: musigym-training-hub, colección: musigym_route_templates).
 *
 * MusiGym lee musigym_route_templates en getRouteForInstrument(). Si la
 * colección está vacía, usa las rutas locales (DEFAULT_ROUTES) como respaldo.
 *
 * Ejecutar:  node sync/sync-route-templates.js
 *
 * Requiere dos service accounts (Configuración del proyecto > Cuentas de servicio
 * > Generar nueva clave privada) guardados como:
 *   - sync/serviceAccount.bitacoras.json   (proyecto bitacoras-de-clase)
 *   - sync/serviceAccount.musigym.json     (proyecto musigym-training-hub)
 * Estos .json NO deben subirse al repo (ver sync/.gitignore).
 *
 * Programación: córrelo manualmente cuando cambien las rutas, o agéndalo
 * (cron / Tarea programada de Windows / GitHub Action) para que corra solo.
 */

const path = require("path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const bitacorasKey = require(path.join(__dirname, "serviceAccount.bitacoras.json"));
const musigymKey = require(path.join(__dirname, "serviceAccount.musigym.json"));

const bitacorasApp = initializeApp({ credential: cert(bitacorasKey) }, "bitacoras");
const musigymApp = initializeApp({ credential: cert(musigymKey) }, "musigym");

const srcDb = getFirestore(bitacorasApp);
const dstDb = getFirestore(musigymApp);

const SOURCE_COLLECTION = "route_templates";
const TARGET_COLLECTION = "musigym_route_templates";

// MusiGym mapea por instrumento/área. Hoy solo distingue "guitarra" y "general".
// Ajusta esta función si en bitácoras usas otras claves de instrumento.
function resolveKey(data, docId) {
  const raw = (
    data.instrumentKey ||
    data.areaKey ||
    data.routeTemplateId ||
    data.processKey ||
    docId ||
    ""
  )
    .toString()
    .toLowerCase();
  if (raw.includes("guitarra")) return "guitarra";
  return raw || "general";
}

// La experiencia (número) de bitácoras se traduce al "nivel" cosmético de MusiGym.
const LEVEL_BY_EXPERIENCE = { 1: "Inicial", 2: "Básico", 3: "Intermedio", 4: "Avanzado" };

function toMusiGymItem(goal = {}, index = 0) {
  const experience = Number(goal.experience) || 1;
  return {
    id: (goal.id || `meta-${index + 1}`).toString(),
    component: (goal.componentLabel || goal.component || "").toString(),
    level: LEVEL_BY_EXPERIENCE[experience] || "",
    title: (goal.title || "").toString(),
    description: (goal.description || "").toString(),
    order: Number(goal.order) || index + 1,
  };
}

async function run() {
  const snap = await srcDb.collection(SOURCE_COLLECTION).get();
  if (snap.empty) {
    console.log("No hay plantillas en", SOURCE_COLLECTION, "— nada que sincronizar.");
    return;
  }

  let written = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const goals = Array.isArray(data.customGoals)
      ? data.customGoals
      : Array.isArray(data.goals)
      ? data.goals
      : [];
    if (!goals.length) {
      console.log("Plantilla sin metas, se omite:", docSnap.id);
      continue;
    }

    const key = resolveKey(data, docSnap.id);
    const items = goals
      .map(toMusiGymItem)
      .sort((a, b) => a.order - b.order)
      .map(({ order, ...rest }) => rest); // MusiGym no usa "order"

    await dstDb.collection(TARGET_COLLECTION).doc(key).set(
      {
        key,
        routeName: (data.routeName || "").toString(),
        sourceTemplateId: docSnap.id,
        items,
        syncedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    written += 1;
    console.log(`✓ ${key} (${items.length} metas) ← ${docSnap.id}`);
  }

  console.log(`Listo. ${written} plantilla(s) sincronizada(s) a ${TARGET_COLLECTION}.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error en la sincronización:", err);
    process.exit(1);
  });
