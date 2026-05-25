import { CONFIG, DEFAULT_ROUTES } from "./config.js";
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "./firebase.js";
import {
  safeText,
  normalizeText,
  slugify,
  emailKey,
  parseCsv,
  monthKey,
  monthRange,
  uid,
} from "./utils.js";

const C = CONFIG.collections;

function nowStamp() {
  return serverTimestamp();
}

function normalizeStudentFromScript(raw = {}) {
  const name = safeText(raw.nombre || raw.name || raw.estudiante || raw.Nombre);
  const email = safeText(raw.email || raw.correo || raw.correoElectronico || raw.Email).toLowerCase();
  const sourceKey = safeText(raw.studentKey || raw.id || raw.codigo || raw.documento || raw.ID);
  const processes = Array.isArray(raw.processes) ? raw.processes : [];
  const firstProcess = processes[0] || {};
  const instrument = safeText(raw.instrumento || firstProcess.instrumento || firstProcess.detalle || raw.curso);
  const emphasis = safeText(raw.enfasis || raw.estilo || firstProcess.enfasis || raw.interesesMusicales);
  const art = safeText(raw.arte || firstProcess.arte || (instrument ? "Música" : ""));
  const id = sourceKey || email || slugify(name);

  return {
    id: slugify(id),
    sourceStudentKey: sourceKey || slugify(name),
    name,
    email,
    age: safeText(raw.edad || raw.age),
    status: safeText(raw.estado || raw.status || "Activo"),
    course: safeText(raw.curso || raw.course),
    art: art || "Música",
    instrument: instrument || "Guitarra",
    emphasis: emphasis || "Técnica",
    level: safeText(raw.level || raw.nivel || "Inicial"),
    interests: safeText(raw.interesesMusicales || raw.intereses || raw.observaciones),
    source: "bitacoras-apps-script",
    raw,
  };
}

export async function fetchStudentsFromAppsScript() {
  const url = new URL(CONFIG.appsScript.studentsUrl);
  url.searchParams.set("action", "students");
  url.searchParams.set("includeInactive", "true");

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) throw new Error(`Apps Script respondió ${response.status}`);
  const payload = await response.json();
  if (payload.ok === false) throw new Error(payload.error || "No fue posible leer estudiantes");
  const rows = payload.students || payload.data || [];
  return rows.map(normalizeStudentFromScript).filter((s) => s.name);
}

export async function syncStudentsFromScript() {
  const students = await fetchStudentsFromAppsScript();
  const batch = writeBatch(db);
  const existingSnaps = await getDocs(collection(db, C.students));
  const existing = new Map(existingSnaps.docs.map((d) => [d.id, d.data()]));

  students.forEach((student) => {
    const ref = doc(db, C.students, student.id);
    const previous = existing.get(student.id) || {};
    batch.set(
      ref,
      {
        ...student,
        isMusiGym: previous.isMusiGym ?? false,
        art: previous.art || student.art,
        instrument: previous.instrument || student.instrument,
        emphasis: previous.emphasis || student.emphasis,
        level: previous.level || student.level,
        teacherEmail: previous.teacherEmail || "",
        activeRoutineId: previous.activeRoutineId || "",
        updatedAt: nowStamp(),
        createdAt: previous.createdAt || nowStamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();
  return students;
}

export async function listStudents({ onlyMusiGym = false } = {}) {
  const base = collection(db, C.students);
  const q = onlyMusiGym
    ? query(base, where("isMusiGym", "==", true))
    : query(base);
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => safeText(a.name).localeCompare(safeText(b.name), "es", { sensitivity: "base" }));
}

export async function listUsers() {
  const snap = await getDocs(query(collection(db, C.users)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => safeText(a.name || a.email).localeCompare(safeText(b.name || b.email), "es", { sensitivity: "base" }));
}

export async function saveUserRole(email, data) {
  const id = safeText(email).toLowerCase();
  await setDoc(
    doc(db, C.users, id),
    {
      email: safeText(email).toLowerCase(),
      name: safeText(data.name),
      role: safeText(data.role) || "estudiante",
      updatedAt: nowStamp(),
      createdAt: data.createdAt || nowStamp(),
    },
    { merge: true }
  );
}

export async function updateStudent(id, patch) {
  await setDoc(
    doc(db, C.students, id),
    {
      ...patch,
      updatedAt: nowStamp(),
    },
    { merge: true }
  );
}

export async function ensureAdminPreviewStudent(profile) {
  const id = `admin_preview_${profile.uid || emailKey(profile.email)}`;
  const ref = doc(db, C.students, id);
  const snap = await getDoc(ref);
  const previous = snap.exists() ? snap.data() : {};
  await setDoc(
    ref,
    {
      nombre: "Vista de prueba Admin",
      name: "Vista de prueba Admin",
      email: profile.email || "",
      isPreviewProfile: true,
      isMusiGym: true,
      ownerAdminUid: profile.uid || "",
      art: previous.art || "Música",
      instrument: previous.instrument || "Guitarra",
      emphasis: previous.emphasis || "Guitarra inicial",
      level: previous.level || "Inicial",
      teacherEmail: previous.teacherEmail || "",
      source: "admin_student_preview",
      updatedAt: nowStamp(),
      createdAt: previous.createdAt || nowStamp(),
    },
    { merge: true }
  );
  return id;
}

export async function findStudentByEmail(email) {
  const clean = safeText(email).toLowerCase();
  if (!clean) return null;
  const snap = await getDocs(query(collection(db, C.students), where("email", "==", clean), limit(1)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function getStudent(id) {
  const snap = await getDoc(doc(db, C.students, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listByStudent(collectionName, studentId, orderField = "createdAt", direction = "desc") {
  const snap = await getDocs(query(collection(db, collectionName), where("studentId", "==", studentId)));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return items.sort((a, b) => {
    const av = a[orderField]?.toMillis ? a[orderField].toMillis() : new Date(a[orderField] || 0).getTime();
    const bv = b[orderField]?.toMillis ? b[orderField].toMillis() : new Date(b[orderField] || 0).getTime();
    return direction === "asc" ? av - bv : bv - av;
  });
}

export function observeTeacherCalls(callback) {
  const q = query(collection(db, C.teacherCalls), where("status", "==", "pending"), limit(20));
  return onSnapshot(q, (snap) => {
    const calls = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const av = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bv = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bv - av;
      });
    callback(calls);
  });
}

export async function requestTeacherHelp(student, message = "") {
  return addDoc(collection(db, C.teacherCalls), {
    studentId: student.id,
    studentName: student.name,
    teacherEmail: student.teacherEmail || "",
    art: student.art || "",
    instrument: student.instrument || "",
    message: safeText(message) || "Necesito asesoría del profe.",
    status: "pending",
    createdAt: nowStamp(),
    updatedAt: nowStamp(),
  });
}

export async function resolveTeacherCall(id, resolvedBy = "") {
  await updateDoc(doc(db, C.teacherCalls, id), {
    status: "resolved",
    resolvedBy,
    resolvedAt: nowStamp(),
    updatedAt: nowStamp(),
  });
}

export async function createObjective(data) {
  return addDoc(collection(db, C.objectives), {
    studentId: data.studentId,
    title: safeText(data.title),
    description: safeText(data.description),
    art: safeText(data.art),
    instrument: safeText(data.instrument),
    component: safeText(data.component),
    status: data.status || "active",
    priority: data.priority || "media",
    createdBy: data.createdBy || "",
    createdAt: nowStamp(),
    updatedAt: nowStamp(),
  });
}

export async function saveDiagnostic(data) {
  return addDoc(collection(db, C.diagnostics), {
    studentId: data.studentId,
    evaluatorEmail: data.evaluatorEmail || "",
    date: data.date ? Timestamp.fromDate(new Date(data.date)) : nowStamp(),
    art: safeText(data.art),
    instrument: safeText(data.instrument),
    strengths: safeText(data.strengths),
    challenges: safeText(data.challenges),
    interests: safeText(data.interests),
    technique: safeText(data.technique),
    theory: safeText(data.theory),
    repertoire: safeText(data.repertoire),
    habits: safeText(data.habits),
    recommendation: safeText(data.recommendation),
    createdAt: nowStamp(),
    updatedAt: nowStamp(),
  });
}

export async function saveSession(data) {
  const sessionRef = await addDoc(collection(db, C.sessions), {
    studentId: data.studentId,
    teacherEmail: data.teacherEmail || "",
    date: data.date ? Timestamp.fromDate(new Date(data.date)) : nowStamp(),
    type: safeText(data.type) || "Práctica guiada",
    summary: safeText(data.summary),
    objectivesWorked: data.objectivesWorked || [],
    routeItemsWorked: data.routeItemsWorked || [],
    practiceRecommendations: safeText(data.practiceRecommendations),
    nextPractice: safeText(data.nextPractice),
    teacherNotes: safeText(data.teacherNotes),
    studentMood: safeText(data.studentMood),
    progressScore: Number(data.progressScore || 0),
    createdAt: nowStamp(),
    updatedAt: nowStamp(),
  });
  const routeItemsWorked = data.routeItemsWorked || [];
  for (const itemId of routeItemsWorked) {
    const item = getRouteForInstrument(data.instrument || "").find((routeItem) => routeItem.id === itemId);
    if (item) await setRouteItemProgress(data.studentId, item, "in_progress", "Trabajado en sesión.");
  }
  return sessionRef;
}

export async function saveSelfEvaluation(data) {
  return addDoc(collection(db, C.selfEvaluations), {
    studentId: data.studentId,
    sessionId: data.sessionId || "",
    feeling: safeText(data.feeling || data.mood),
    energyLevel: Number(data.energyLevel || data.energy || 3),
    difficultyLevel: Number(data.difficultyLevel || data.difficulty || 3),
    whatWentWell: safeText(data.whatWentWell || data.learned),
    whatWasDifficult: safeText(data.whatWasDifficult || data.doubt),
    whatDoIWantNext: safeText(data.whatDoIWantNext || data.nextGoal),
    mood: safeText(data.feeling || data.mood),
    energy: Number(data.energyLevel || data.energy || 3),
    clarity: Number(data.clarity || 3),
    difficulty: Number(data.difficultyLevel || data.difficulty || 3),
    learned: safeText(data.whatWentWell || data.learned),
    doubt: safeText(data.whatWasDifficult || data.doubt),
    nextGoal: safeText(data.whatDoIWantNext || data.nextGoal),
    createdAt: nowStamp(),
    updatedAt: nowStamp(),
  });
}

export async function getNextQuestions(studentId) {
  const snap = await getDoc(doc(db, C.nextQuestions, studentId));
  if (!snap.exists()) return { id: studentId, studentId, questions: [] };
  return { id: snap.id, ...snap.data(), questions: snap.data().questions || [] };
}

export function getPendingQuestions(questionDoc) {
  return (questionDoc?.questions || []).filter((q) => (q.status || "pending") === "pending");
}

export function validateNextQuestions(questions = []) {
  const pending = questions.filter((q) => (q.status || "pending") === "pending");
  if (pending.length > 3) throw new Error("Solo puedes tener máximo 3 preguntas pendientes.");
  questions.forEach((q) => {
    if (safeText(q.text).length > 300) throw new Error("Cada pregunta puede tener máximo 300 caracteres.");
  });
}

export async function saveNextQuestions(studentId, questions) {
  const normalized = (questions || []).map((q) => ({
    id: q.id || uid("question"),
    text: safeText(q.text).slice(0, 300),
    status: ["pending", "answered", "archived"].includes(q.status) ? q.status : "pending",
    createdAt: q.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  validateNextQuestions(normalized);
  await setDoc(doc(db, C.nextQuestions, studentId), { studentId, questions: normalized, updatedAt: nowStamp() }, { merge: true });
}

export async function updateNextQuestionStatus(studentId, questionId, status) {
  const current = await getNextQuestions(studentId);
  const questions = (current.questions || []).map((q) =>
    q.id === questionId ? { ...q, status, updatedAt: new Date().toISOString() } : q
  );
  await saveNextQuestions(studentId, questions);
}

export async function saveSongRequest(data) {
  return addDoc(collection(db, C.songRequests), {
    studentId: data.studentId,
    songName: safeText(data.songName),
    artist: safeText(data.artist),
    reason: safeText(data.reason),
    status: data.status || "requested",
    difficultyGuess: data.difficultyGuess || "",
    createdAt: nowStamp(),
    updatedAt: nowStamp(),
  });
}

export async function updateSongRequest(id, patch) {
  await setDoc(doc(db, C.songRequests, id), { ...patch, updatedAt: nowStamp() }, { merge: true });
}

export function getRouteForInstrument(instrument) {
  const key = normalizeText(instrument).includes("guitarra") ? "guitarra" : "general";
  return DEFAULT_ROUTES[key] || DEFAULT_ROUTES.general;
}

export async function listRouteProgress(studentId) {
  const snap = await getDocs(query(collection(db, C.routeProgress), where("studentId", "==", studentId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setRouteItemProgress(studentId, item, status, note = "") {
  const id = `${studentId}_${item.id}`;
  await setDoc(
    doc(db, C.routeProgress, id),
    {
      studentId,
      routeItemId: item.id,
      title: item.title,
      component: item.component,
      level: item.level,
      status,
      note: safeText(note),
      updatedAt: nowStamp(),
      createdAt: nowStamp(),
    },
    { merge: true }
  );
}

export function getRouteProgressByComponent(student, progress = []) {
  const route = getRouteForInstrument(student?.instrument);
  const progressMap = new Map(progress.map((p) => [p.routeItemId, p.status]));
  return route.reduce((acc, item) => {
    acc[item.component] ||= { total: 0, achieved: 0, inProgress: 0 };
    acc[item.component].total += 1;
    const status = progressMap.get(item.id);
    if (status === "achieved" || status === "completed") acc[item.component].achieved += 1;
    if (status === "in_progress") acc[item.component].inProgress += 1;
    return acc;
  }, {});
}

export function generateRoutine(student, objectives = [], progress = [], songs = []) {
  const instrument = safeText(student.instrument || "Guitarra");
  const level = safeText(student.level || "Inicial");
  const incompleteRoute = getRouteForInstrument(instrument).filter((item) => {
    const found = progress.find((p) => p.routeItemId === item.id);
    return !found || found.status !== "completed";
  });
  const focusRoute = incompleteRoute.slice(0, 2);
  const activeObjectives = objectives.filter((o) => (o.status || "active") === "active").slice(0, 2);
  const currentSong = songs.find((s) => ["approved", "in_progress", "requested"].includes(s.status)) || null;

  const blocks = [
    {
      id: uid("block"),
      name: "Llegada y calentamiento",
      component: "Hábitos",
      minutes: 5,
      instructions:
        instrument === "Guitarra"
          ? "Revisa postura, afinación, respiración y movilidad suave de manos. Nada de entrar a tocar como si la muñeca fuera repuesto barato."
          : "Prepara cuerpo, atención y materiales. Define una intención concreta para la práctica.",
    },
    {
      id: uid("block"),
      name: focusRoute[0]?.title || "Técnica base",
      component: focusRoute[0]?.component || "Técnica",
      minutes: level === "Inicial" ? 10 : 15,
      instructions:
        focusRoute[0]?.description || "Trabaja una habilidad técnica concreta con repetición lenta, consciente y medible.",
    },
    {
      id: uid("block"),
      name: activeObjectives[0]?.title || focusRoute[1]?.title || "Objetivo principal",
      component: activeObjectives[0]?.component || focusRoute[1]?.component || "Proceso",
      minutes: 15,
      instructions:
        activeObjectives[0]?.description || focusRoute[1]?.description || "Avanza un objetivo puntual y escribe qué funcionó y qué se trabó.",
    },
    {
      id: uid("block"),
      name: currentSong ? `Repertorio: ${currentSong.songName}` : "Repertorio / creación",
      component: "Repertorio",
      minutes: 15,
      instructions: currentSong
        ? `Trabaja una sección pequeña de ${currentSong.songName}. Mejor 4 compases bien hechos que toda la canción en modo licuadora.`
        : "Elige una pieza, ejercicio o creación breve. La meta es cerrar algo pequeño y claro.",
    },
    {
      id: uid("block"),
      name: "Cierre y dudas para el profe",
      component: "Reflexión",
      minutes: 5,
      instructions:
        "Escribe una duda concreta, marca tu sensación de la sesión y define el siguiente paso antes de huir de la responsabilidad artística.",
    },
  ];

  return {
    title: `Rutina ${instrument} - ${level}`,
    blocks,
    generatedReason: "Rutina generada con instrumento, nivel, objetivos activos, canciones y avance de ruta.",
  };
}

export async function saveGeneratedRoutine(student, routine, createdBy = "") {
  const ref = await addDoc(collection(db, C.routines), {
    studentId: student.id,
    title: routine.title,
    blocks: routine.blocks,
    active: true,
    generatedReason: routine.generatedReason || "",
    createdBy,
    createdAt: nowStamp(),
    updatedAt: nowStamp(),
  });
  await updateStudent(student.id, { activeRoutineId: ref.id });
  return ref;
}

export async function setRoutineActive(studentId, routineId) {
  const routines = await listByStudent(C.routines, studentId);
  const batch = writeBatch(db);
  routines.forEach((routine) => {
    batch.set(doc(db, C.routines, routine.id), { active: routine.id === routineId, updatedAt: nowStamp() }, { merge: true });
  });
  batch.set(doc(db, C.students, studentId), { activeRoutineId: routineId, updatedAt: nowStamp() }, { merge: true });
  await batch.commit();
}

export async function loadGuitarLibrary() {
  const response = await fetch("./assets/guitar-library.csv");
  const text = await response.text();
  const rows = parseCsv(text);
  const headers = rows.shift() || [];
  const index = Object.fromEntries(headers.map((h, i) => [normalizeText(h), i]));
  const get = (row, name) => safeText(row[index[normalizeText(name)]]);
  return rows
    .map((row, i) => ({
      id: get(row, "ID") || `guitarra-${i + 1}`,
      name: get(row, "Nombre"),
      level: get(row, "Nivel"),
      author: get(row, "Autor") || "Musicala",
      category: get(row, "Categoría") || "General",
      notes: get(row, "Observaciones"),
      link: get(row, "Link"),
      active: ["si", "sí", "true", "1", "activo"].includes(normalizeText(get(row, "Activo") || "Sí")),
      order: Number(get(row, "Orden") || 9999),
      tags: safeText(get(row, "Tags"))
        .split(/[;,]/)
        .map(safeText)
        .filter(Boolean),
      goalKeys: safeText(get(row, "GoalKeys"))
        .split(/[;,]/)
        .map(safeText)
        .filter(Boolean),
    }))
    .filter((item) => item.active && item.name)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "es"));
}

export function buildCoachSuggestion({ student, objectives, routine, progress, songs, diagnostics, evaluations }) {
  const instrument = safeText(student?.instrument || "tu arte");
  const activeObjective = objectives.find((o) => (o.status || "active") === "active");
  const lastEval = evaluations[0];
  const openSong = songs.find((s) => ["requested", "approved", "in_progress"].includes(s.status));
  const route = getRouteForInstrument(instrument);
  const pendingRoute = route.find((item) => !progress.some((p) => p.routeItemId === item.id && p.status === "completed"));
  const routineBlocks = routine?.blocks || [];

  const parts = [];
  parts.push(`Hoy haría una práctica enfocada en ${instrument}.`);

  if (lastEval?.mood && ["Regular", "Me costó", "Me sentí bloqueado/a"].includes(lastEval.mood)) {
    parts.push("Como la última sensación no fue tan fluida, baja velocidad y busca claridad antes de exigirte más.");
  }

  if (activeObjective) {
    parts.push(`Objetivo central: ${activeObjective.title}.`);
  } else if (pendingRoute) {
    parts.push(`Siguiente paso de ruta: ${pendingRoute.title}.`);
  }

  if (openSong) {
    parts.push(`Conecta esto con la canción “${openSong.songName}”: trabaja solo una sección pequeña.`);
  }

  if (routineBlocks.length) {
    parts.push(`Usa la rutina activa: ${routineBlocks.map((b) => `${b.minutes || 5} min ${b.name}`).join(" · ")}.`);
  } else {
    parts.push("Divide la sesión en 5 min calentamiento, 15 min técnica, 15 min repertorio y 5 min cierre.");
  }

  if (diagnostics[0]?.recommendation) {
    parts.push(`Dato del diagnóstico: ${diagnostics[0].recommendation}`);
  }

  return parts.join(" ");
}

export async function generateMonthlyReport(student, key = monthKey()) {
  const { start, end } = monthRange(key);
  const sessionsSnap = await getDocs(query(collection(db, C.sessions), where("studentId", "==", student.id)));
  const sessions = sessionsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((item) => {
      const ms = item.date?.toMillis ? item.date.toMillis() : new Date(item.date || 0).getTime();
      return ms >= start.getTime() && ms < end.getTime();
    })
    .sort((a, b) => {
      const av = a.date?.toMillis ? a.date.toMillis() : 0;
      const bv = b.date?.toMillis ? b.date.toMillis() : 0;
      return av - bv;
    });
  const diagnostics = await listByStudent(C.diagnostics, student.id, "createdAt", "desc");
  const objectives = await listByStudent(C.objectives, student.id, "createdAt", "desc");
  const evaluations = await listByStudent(C.selfEvaluations, student.id, "createdAt", "desc");
  const progress = await listRouteProgress(student.id);
  const songs = await listByStudent(C.songRequests, student.id, "createdAt", "desc");
  const routines = await listByStudent(C.routines, student.id, "createdAt", "desc");
  const nextQuestions = await getNextQuestions(student.id);
  const workedQuestions = (nextQuestions.questions || []).filter((q) => {
    if ((q.status || "pending") !== "answered") return false;
    const ms = new Date(q.updatedAt || q.createdAt || 0).getTime();
    return ms >= start.getTime() && ms < end.getTime();
  });

  const completed = progress.filter((p) => p.status === "completed" || p.status === "achieved").length;
  const inProgress = progress.filter((p) => p.status === "in_progress").length;
  const avgProgress = sessions.length
    ? Math.round(sessions.reduce((sum, s) => sum + Number(s.progressScore || 0), 0) / sessions.length)
    : 0;

  const strengths = sessions
    .map((s) => s.summary)
    .filter(Boolean)
    .slice(-4)
    .join(" ");
  const recommendations = sessions
    .map((s) => s.nextPractice || s.practiceRecommendations)
    .filter(Boolean)
    .slice(-4)
    .join(" ");

  const text = [
    `Resumen del proceso\nDurante ${key}, ${student.name} participo en ${sessions.length} sesion(es) de MusiGym en ${student.instrument || student.art || "su proceso artistico"}. ${diagnostics[0]?.recommendation ? `Diagnostico inicial: ${diagnostics[0].recommendation}` : ""}`,
    sessions.length
      ? `Avances principales\nEl proceso evidencio avances relacionados con: ${strengths || "la practica guiada y el seguimiento de objetivos."}`
      : "Avances principales\nAun no hay sesiones registradas en este mes, por lo que el informe queda como borrador de seguimiento.",
    objectives.length
      ? `Aspectos por fortalecer\nObjetivos activos o recientes: ${objectives.slice(0, 4).map((o) => o.title).join(", ")}.`
      : "Aspectos por fortalecer\nTodavia no se han creado objetivos especificos para este estudiante.",
    `Participacion y autonomia\nEn la ruta se registran ${completed} logro(s) completado(s) y ${inProgress} en proceso. El promedio de avance reportado por sesiones es ${avgProgress}/100. ${evaluations.length ? "Las autoevaluaciones aportan informacion sobre energia, dificultad y proximos intereses." : "Se recomienda pedir una autoevaluacion al cierre de cada sesion."}`,
    `Preguntas o intereses del estudiante\n${workedQuestions.length ? `Preguntas e inquietudes trabajadas: ${workedQuestions.map((q) => q.text).join("; ")}.` : "No hay preguntas marcadas como respondidas durante este mes."} ${songs.length ? `Canciones solicitadas: ${songs.slice(0, 4).map((s) => s.songName).join(", ")}.` : ""}`,
    routines[0] ? `Rutina y avance\nRutina reciente: ${routines[0].title}.` : "Rutina y avance\nAun no hay rutina registrada para este proceso.",
    recommendations
      ? `Recomendaciones para el siguiente mes\n${recommendations}`
      : "Recomendaciones para el siguiente mes\nMantener una rutina breve, constante y conectada con repertorio significativo para el estudiante.",
    "Comentario final calido y profesional\nEl proceso sigue creciendo mejor cuando los pasos son pequenos, claros y sostenidos entre sesiones.",
  ].join("\n\n");

  const report = {
    studentId: student.id,
    studentName: student.name,
    month: key,
    sessionsCount: sessions.length,
    completedRouteItems: completed,
    inProgressRouteItems: inProgress,
    averageProgress: avgProgress,
    generatedText: text,
    generatedAt: nowStamp(),
    updatedAt: nowStamp(),
    createdAt: nowStamp(),
  };

  const reportId = `${student.id}_${key}`;
  await setDoc(doc(db, C.monthlyReports, reportId), report, { merge: true });
  return { id: reportId, ...report };
}
