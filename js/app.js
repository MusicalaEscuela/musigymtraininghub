import { CONFIG, CATALOGS } from "./config.js";
import {
  loginWithGoogle,
  logout,
  observeAuth,
  getUserProfile,
} from "./firebase.js";
import {
  syncStudentsFromScript,
  listStudents,
  listUsers,
  saveUserRole,
  updateStudent,
  findStudentByEmail,
  studentAccessEmail,
  restampStudentAccessEmail,
  listByStudentEmail,
  listRouteProgressByEmail,
  getStudent,
  listByStudent,
  createObjective,
  updateObjective,
  deleteObjective,
  saveDiagnostic,
  saveSession,
  updateSession,
  deleteSession,
  saveSelfEvaluation,
  getNextQuestions,
  getPendingQuestions,
  saveNextQuestions,
  updateNextQuestionStatus,
  getRouteProgressByComponent,
  saveSongRequest,
  updateSongRequest,
  deleteSongRequest,
  getRouteForInstrument,
  loadRouteTemplates,
  listRouteProgress,
  setRouteItemProgress,
  generateRoutine,
  saveGeneratedRoutine,
  setRoutineActive,
  updateRoutine,
  listRoutineTemplates,
  saveRoutineTemplate,
  deleteRoutineTemplate,
  defaultRoutineTemplate,
  buildRoutineFromTemplate,
  templateKeyForInstrument,
  loadResourceLibrary,
  resourcesForStudent,
  observeTeacherCalls,
  requestTeacherHelp,
  resolveTeacherCall,
  buildCoachResponse,
  saveCoachLog,
  generateMonthlyReport,
} from "./data.js";
import {
  escapeHtml,
  safeText,
  normalizeText,
  formatDate,
  formatDateTime,
  monthKey,
  unique,
  uid,
} from "./utils.js";

const C = CONFIG.collections;
const appRoot = document.getElementById("app");

const state = {
  booting: true,
  user: null,
  profile: null,
  students: [],
  users: [],
  selectedStudentId: "",
  studentSearch: "",
  showAllStudents: false,
  currentViewMode: "admin",
  editingRoutineId: "",
  routineDraft: null,
  routineTemplates: [],
  editingTemplateKey: "",
  templateDraft: null,
  followUpTimers: [],
  timerStarted: false,
  selectedEvaluationSessionId: "",
  activeTab: "hoy",
  bundle: null,
  library: [],
  libraryFilter: { q: "", category: "", level: "" },
  teacherCalls: [],
  message: "",
  coachMessagesByStudent: {},
  coachOpen: false,
  diagnosticFormOpen: false,
  objectiveFormOpen: false,
  editingObjectiveId: "",
  songFormOpen: false,
  editingSongId: "",
  editingSessionId: "",
  sessionFormOpen: false,
  audioReady: false,
  audioContext: null,
  unsubscribeCalls: null,
};

function setMessage(message) {
  state.message = message || "";
  render();
  if (message) setTimeout(() => {
    if (state.message === message) {
      state.message = "";
      render();
    }
  }, 4500);
}

function optionList(items, selected = "") {
  return (items || [])
    .map((item) => `<option value="${escapeHtml(item)}" ${safeText(selected) === safeText(item) ? "selected" : ""}>${escapeHtml(item)}</option>`)
    .join("");
}

function getFormData(form) {
  const data = new FormData(form);
  return Object.fromEntries([...data.entries()].map(([k, v]) => [k, safeText(v)]));
}

async function loadBaseData() {
  const onlyMusiGym = !state.profile?.isAdmin;
  const [students, users, library] = await Promise.all([
    listStudents({ onlyMusiGym }).catch((e) => {
      console.warn(e);
      return [];
    }),
    state.profile?.isAdmin ? listUsers().catch(() => []) : Promise.resolve([]),
    state.library.length ? Promise.resolve(state.library) : loadResourceLibrary().catch(() => []),
    // Plantillas de ruta sincronizadas desde Bitácoras de clase. Si la
    // colección está vacía, getRouteForInstrument usa las rutas locales.
    loadRouteTemplates().catch(() => {}),
  ]);
  // Excluir los perfiles "Vista de prueba Admin" creados por la version
  // anterior; esa funcion ya no existe.
  state.students = students.filter((s) => !s.isPreviewProfile && s.source !== "admin_student_preview");
  state.users = users;
  state.library = library;
  if (state.profile?.isAdmin) {
    state.routineTemplates = await listRoutineTemplates().catch(() => []);
  }

  if (state.profile?.isStudent) {
    let student = null;
    const profileStudentId = state.profile.studentId || state.profile.studentKey || "";
    if (profileStudentId) {
      student = await getStudent(profileStudentId).catch(() => null);
    }
    if (!student) {
      student = await findStudentByEmail(state.profile.email).catch(() => null);
    }
    if (student?.isMusiGym) state.selectedStudentId = student.id;
  }

  if (!state.profile?.isStudent && !state.selectedStudentId && students.length) {
    // Abrir por defecto la ficha del primer estudiante ACTIVO en MusiGym;
    // si ninguno esta activo, caer al primero de la lista.
    const firstActive = students.find((s) => s.isMusiGym);
    state.selectedStudentId = (firstActive || students[0]).id;
  }

  if (state.selectedStudentId) await openStudent(state.selectedStudentId, false);
}

// Sincroniza estudiantes desde Sheets automaticamente al abrir la app.
// Solo admins (son quienes pueden escribir en Firestore). Corre en segundo
// plano para no bloquear la carga, y solo una vez por sesion del navegador.
async function autoSyncStudents() {
  if (!state.profile?.isAdmin) return;
  if (sessionStorage.getItem("musigym_autosynced") === "1") return;
  sessionStorage.setItem("musigym_autosynced", "1");
  try {
    setMessage("Actualizando estudiantes desde Sheets...");
    render();
    await syncStudentsFromScript();
    await loadBaseData();
    setMessage("Estudiantes actualizados desde Sheets.");
    render();
  } catch (error) {
    console.warn("Auto-sync de estudiantes fallo", error);
    sessionStorage.removeItem("musigym_autosynced");
    setMessage("No se pudo sincronizar automaticamente. Puedes usar el boton de sincronizar.");
    render();
  }
}

async function openStudent(studentId, shouldRender = true) {
  state.selectedStudentId = studentId;
  state.bundle = null;
  state.activeTab = "hoy";
  if (shouldRender) render();

  const student = await getStudent(studentId);
  if (!student) return;

  // Si quien mira es el propio estudiante (no admin ni docente), las consultas
  // del proceso deben filtrar por studentEmail para que las reglas las acepten
  // ("las reglas no son filtros" en Firestore). Admin/docente usan studentId.
  const viewerIsStudent = state.profile?.isStudent && !state.profile?.isAdmin && !state.profile?.isTeacher;
  const accessEmail = studentAccessEmail(student) || safeText(state.profile?.email).toLowerCase();
  const listProcess = (col, orderField = "createdAt", direction = "desc") =>
    viewerIsStudent
      ? listByStudentEmail(col, accessEmail, orderField, direction)
      : listByStudent(col, studentId, orderField, direction);

  const [objectives, routines, sessions, diagnostics, evaluations, songs, progress, reports, coachLogs] = await Promise.all([
    listProcess(C.objectives).catch(() => []),
    listProcess(C.routines).catch(() => []),
    listProcess(C.sessions, "date", "desc").catch(() => []),
    listProcess(C.diagnostics).catch(() => []),
    listProcess(C.selfEvaluations).catch(() => []),
    listProcess(C.songRequests).catch(() => []),
    (viewerIsStudent ? listRouteProgressByEmail(accessEmail) : listRouteProgress(studentId)).catch(() => []),
    listProcess(C.monthlyReports, "generatedAt", "desc").catch(() => []),
    listProcess(C.coachLogs, "createdAt", "desc").catch(() => []),
  ]);
  const nextQuestions = await getNextQuestions(studentId).catch(() => ({ studentId, questions: [] }));

  const activeRoutine = routines.find((r) => r.active) || routines[0] || null;
  state.bundle = { student, objectives, routines, activeRoutine, sessions, diagnostics, evaluations, songs, progress, reports, coachLogs, nextQuestions };
  if (shouldRender) render();
}

function startTeacherCallListener() {
  if (state.unsubscribeCalls) state.unsubscribeCalls();
  if (!state.profile?.isAdmin && !state.profile?.isTeacher) return;

  state.unsubscribeCalls = observeTeacherCalls((calls) => {
    const previousIds = new Set(state.teacherCalls.map((c) => c.id));
    state.teacherCalls = calls;
    const newCall = calls.find((c) => !previousIds.has(c.id));
    if (newCall && state.audioReady) playAlarm();
    render();
  });
}

function enableAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  state.audioContext = state.audioContext || new AudioContext();
  state.audioReady = true;
  playAlarm(1);
  setMessage("Aviso activado. Ahora sonará cuando un estudiante te llame para pedir apoyo.");
}

function playAlarm(times = 3) {
  if (!state.audioContext) return;
  const ctx = state.audioContext;
  for (let i = 0; i < times; i += 1) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(740, ctx.currentTime + i * 0.22);
    osc.frequency.setValueAtTime(880, ctx.currentTime + i * 0.22 + 0.08);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.22 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.22);
    osc.stop(ctx.currentTime + i * 0.22 + 0.18);
  }
}

// ===== Temporizadores de seguimiento (rotación del docente) =====
const TIMERS_KEY = "musigym_followup_timers";
const TIMER_MAX_MIN = 15;

function loadFollowUpTimers() {
  try {
    const raw = localStorage.getItem(TIMERS_KEY);
    state.followUpTimers = raw ? JSON.parse(raw) : [];
  } catch (e) {
    state.followUpTimers = [];
  }
}

function saveFollowUpTimers() {
  try {
    localStorage.setItem(TIMERS_KEY, JSON.stringify(state.followUpTimers));
  } catch (e) {
    console.warn("No se pudieron guardar los temporizadores", e);
  }
}

function addFollowUpTimer(studentName, minutes) {
  const mins = Math.min(TIMER_MAX_MIN, Math.max(1, Number(minutes) || 10));
  state.followUpTimers.push({
    id: uid("timer"),
    studentName: safeText(studentName) || "Estudiante",
    durationMin: mins,
    endsAt: Date.now() + mins * 60000,
    status: "running",
  });
  saveFollowUpTimers();
  ensureTimerInterval();
}

function resetFollowUpTimer(id) {
  const t = state.followUpTimers.find((x) => x.id === id);
  if (!t) return;
  t.endsAt = Date.now() + t.durationMin * 60000;
  t.status = "running";
  saveFollowUpTimers();
}

function removeFollowUpTimer(id) {
  state.followUpTimers = state.followUpTimers.filter((t) => t.id !== id);
  saveFollowUpTimers();
}

function ensureTimerInterval() {
  if (state.timerStarted) return;
  state.timerStarted = true;
  setInterval(tickFollowUpTimers, 1000);
}

function tickFollowUpTimers() {
  if (!state.followUpTimers.length) return;
  const now = Date.now();
  let changed = false;
  state.followUpTimers.forEach((t) => {
    if (t.status === "running" && now >= t.endsAt) {
      t.status = "done";
      changed = true;
      if (state.audioReady) playAlarm(4);
    }
  });
  if (changed) saveFollowUpTimers();
  const list = document.getElementById("timerList");
  if (list) list.innerHTML = renderTimerList();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function renderFollowUpTimersPanel() {
  const prefill = state.bundle?.student?.name || "";
  return `
    <div class="followup-panel">
      <div class="followup-head">
        <p class="eyebrow">Seguimiento</p>
        <strong>Temporizadores de rotación</strong>
      </div>
      <p class="list-hint">Marca cada cuánto debes volver con un estudiante (máx ${TIMER_MAX_MIN} min). Suena y te recuerda pasar.</p>
      <form class="followup-form" data-form="add-timer">
        <input name="studentName" placeholder="Estudiante" value="${escapeHtml(prefill)}" />
        <input type="number" name="minutes" min="1" max="${TIMER_MAX_MIN}" value="10" title="Minutos (máx ${TIMER_MAX_MIN})" />
        <button type="submit" class="btn secondary">+ Temporizador</button>
      </form>
      <div id="timerList" class="timer-list">${renderTimerList()}</div>
    </div>
  `;
}

function renderTimerList() {
  const timers = state.followUpTimers || [];
  if (!timers.length) return `<p class="empty">Sin temporizadores activos.</p>`;
  const now = Date.now();
  return timers.map((t) => {
    const remaining = Math.max(0, t.endsAt - now);
    const done = t.status === "done" || remaining <= 0;
    const mm = Math.floor(remaining / 60000);
    const ss = Math.floor((remaining % 60000) / 1000);
    return `
      <article class="timer-card ${done ? "done" : ""}">
        <div class="timer-info">
          <strong>${escapeHtml(t.studentName)}</strong>
          ${done
            ? `<span class="timer-alert">⏰ Debes pasar con ${escapeHtml(t.studentName)}</span>`
            : `<span class="timer-count">${mm}:${pad2(ss)}</span>`}
        </div>
        <div class="timer-actions">
          <button class="btn tiny ${done ? "primary" : "secondary"}" data-action="timer-reset" data-id="${escapeHtml(t.id)}">${done ? "Ya pasé" : "Reiniciar"}</button>
          <button class="btn tiny ghost" data-action="timer-remove" data-id="${escapeHtml(t.id)}" title="Quitar">✕</button>
        </div>
      </article>
    `;
  }).join("");
}

function render() {
  appRoot.innerHTML = `
    ${renderShellHeader()}
    <main class="app-main">
      ${state.message ? `<div class="toast">${escapeHtml(state.message)}</div>` : ""}
      ${renderCurrentView()}
    </main>
  `;
}

function renderShellHeader() {
  const user = state.profile;
  return `
    <header class="topbar">
      <div class="brand">
        <img src="./assets/logo.png" alt="Musicala" />
        <div>
          <p class="eyebrow">${escapeHtml(CONFIG.app.subtitle)}</p>
          <h1>${escapeHtml(CONFIG.app.name)}</h1>
        </div>
      </div>
      <div class="topbar-actions">
        ${user ? `
          <div class="user-pill">
            <span>${escapeHtml(user.name || "Usuario")}</span>
            <small>${escapeHtml(user.role)}</small>
          </div>
          <button class="btn ghost" data-action="logout">Salir</button>
        ` : `<button class="btn primary" data-action="login">Entrar con Google</button>`}
      </div>
    </header>
  `;
}

function renderCurrentView() {
  if (state.booting) return renderLoading("Cargando MusiGym...");
  if (!state.user) return renderLogin();
  if (!state.profile) return renderLoading("Preparando perfil...");

  if (state.profile.isAdmin && state.currentViewMode === "studentPreview" && state.selectedStudentId) return renderStudentPreview();
  if (state.profile.isAdmin && state.currentViewMode === "teacher") return renderTeacher();
  if (state.profile.isAdmin && state.currentViewMode === "config") return renderConfig();
  if (state.profile.isAdmin) return renderAdmin();
  if (state.profile.isTeacher) return renderTeacher();
  return renderStudent();
}

function renderLoading(text) {
  return `<section class="center-card"><div class="spinner"></div><h2>${escapeHtml(text)}</h2><p>Afinando los detalles, dame un momento...</p></section>`;
}

function renderLogin() {
  return `
    <section class="hero-grid">
      <article class="hero-card">
        <p class="eyebrow">Entrenamiento artístico con seguimiento real</p>
        <h2>MusiGym no es una clase normal. Es práctica guiada con ruta, biblioteca, bitácoras, diagnósticos y autoevaluación.</h2>
        <p>El estudiante agenda su espacio, practica con material, llama al profe cuando necesita apoyo y deja registro de cómo va. Casi como un gimnasio, pero con menos proteína en polvo y más acordes.</p>
        <button class="btn primary large" data-action="login">Entrar con Google</button>
      </article>
      <aside class="feature-stack">
        ${["Rutinas de práctica", "Acompañante de práctica", "Llamado al profe", "Informes mensuales", "Biblioteca de práctica", "Proceso del estudiante"].map((x) => `<div class="mini-feature">${escapeHtml(x)}</div>`).join("")}
      </aside>
    </section>
  `;
}

function renderAdmin() {
  return `
    <section class="dashboard-grid">
      <aside class="side-panel">
        <div class="panel-title">
          <h2>Admin</h2>
          <p>Gestión de estudiantes, roles y procesos MusiGym.</p>
        </div>
        <button class="btn primary full" data-action="sync-students">Sincronizar estudiantes desde Sheets</button>
        <button class="btn secondary full" data-action="enter-teacher-view">Ver vista docente</button>
        <button class="btn secondary full" data-action="enter-config-view">Configuración</button>
        <button class="btn secondary full" data-action="enable-audio">${state.audioReady ? "Alarma activa" : "Activar alarma de llamados"}</button>
        ${renderMetrics()}
        ${renderCallsBox()}
      </aside>
      <section class="workspace">
        ${renderStudentList(true)}
        ${renderSelectedStudentWorkspace("admin")}
      </section>
    </section>
  `;
}

function renderConfig() {
  return `
    <section class="dashboard-grid">
      <aside class="side-panel">
        <div class="panel-title">
          <h2>Configuración</h2>
          <p>Docentes y plantillas de rutina.</p>
        </div>
        <button class="btn secondary full" data-action="exit-config-view">Volver a Admin</button>
        ${renderMetrics()}
      </aside>
      <section class="workspace">
        ${renderRolesManager()}
        ${renderRoutineTemplatesManager()}
      </section>
    </section>
  `;
}

function renderStudentPreview() {
  const name = state.bundle?.student?.name || "este estudiante";
  return `
    <section class="student-home">
      <div class="preview-banner">
        <strong>Estás viendo la app como la ve ${escapeHtml(name)}</strong>
        <button class="btn ghost" data-action="exit-student-preview">Volver a Admin</button>
      </div>
      ${renderSelectedStudentWorkspace("estudiante")}
    </section>
  `;
}

function renderTeacher() {
  const adminPreview = state.profile?.isAdmin && state.currentViewMode === "teacher";
  return `
    <section class="dashboard-grid">
      ${adminPreview ? `
        <div class="preview-banner span-all">
          <strong>Estás viendo la vista de docente</strong>
          <button class="btn ghost" data-action="exit-teacher-view">Volver a Admin</button>
        </div>
      ` : ""}
      <aside class="side-panel">
        <div class="panel-title">
          <h2>Docente</h2>
          <p>Tu clase de hoy: seguimiento, bitácoras y apoyo.</p>
        </div>
        ${renderTodayPanel()}
        ${renderFollowUpTimersPanel()}
        <button class="btn secondary full" data-action="enable-audio">${state.audioReady ? "Alarma activa" : "Activar alarma de llamados"}</button>
        ${renderCallsBox()}
      </aside>
      <section class="workspace">
        ${renderStudentList(false)}
        ${renderSelectedStudentWorkspace("docente")}
      </section>
    </section>
  `;
}

function renderTodayPanel() {
  const today = formatDate(new Date());
  const myStudents = state.students.length; // el docente ya recibe solo MusiGym
  const pendingCalls = (state.teacherCalls || []).length;
  const b = state.bundle;
  let snapshot = `<p class="empty">Selecciona un estudiante para ver su estado de hoy.</p>`;
  if (b?.student) {
    const lastSession = b.sessions?.[0];
    const lastEval = b.evaluations?.[0];
    const nextPractice = lastSession?.nextPractice || lastSession?.practiceRecommendations || "";
    const mood = lastEval?.mood || lastEval?.feeling || "";
    snapshot = `
      <div class="today-student">
        <strong>${escapeHtml(b.student.name)}</strong>
        <span>${escapeHtml(b.student.instrument || b.student.art || "Sin arte")} · ${escapeHtml(b.student.level || "Sin nivel")}</span>
        <ul class="today-facts">
          <li><b>Última sesión:</b> ${lastSession ? escapeHtml(formatDate(lastSession.date || lastSession.createdAt)) : "Sin registro"}</li>
          ${nextPractice ? `<li><b>Próxima práctica:</b> ${escapeHtml(nextPractice)}</li>` : ""}
          ${mood ? `<li><b>Última sensación:</b> ${escapeHtml(mood)}</li>` : ""}
        </ul>
        <button class="btn tiny secondary" data-action="scroll-to-sessions">Registrar sesión de hoy</button>
      </div>
    `;
  }
  return `
    <div class="today-panel">
      <div class="today-head">
        <p class="eyebrow">Clase de hoy</p>
        <strong>${escapeHtml(today)}</strong>
      </div>
      <div class="today-counters">
        <div><strong>${myStudents}</strong><span>Tus estudiantes</span></div>
        <div class="${pendingCalls ? "today-alert" : ""}"><strong>${pendingCalls}</strong><span>Llamados</span></div>
      </div>
      ${snapshot}
    </div>
  `;
}

function renderStudent() {
  if (!state.selectedStudentId) {
    return `
      <section class="center-card">
        <h2>Aún no encontramos tu perfil MusiGym</h2>
        <p>Entraste con <b>${escapeHtml(state.profile?.email || "tu correo")}</b>. Para ingresar, ese correo debe coincidir con el de tu ficha y tu estado MusiGym debe estar activo.</p>
        <p>Si crees que es un error, pídele al equipo Musicala que registre este correo como tu <b>correo de acceso</b> en tu ficha.</p>
      </section>
    `;
  }
  return `
    <section class="student-home">
      ${renderSelectedStudentWorkspace("estudiante")}
    </section>
  `;
}

function renderMetrics() {
  const active = state.students.filter((s) => s.isMusiGym).length;
  const guitar = state.students.filter((s) => normalizeText(s.instrument).includes("guitarra") && s.isMusiGym).length;
  return `
    <div class="metric-grid small">
      <div class="metric"><strong>${state.students.length}</strong><span>Sincronizados</span></div>
      <div class="metric"><strong>${active}</strong><span>MusiGym activos</span></div>
      <div class="metric"><strong>${guitar}</strong><span>Guitarra</span></div>
    </div>
  `;
}

function renderCallsBox() {
  const calls = state.teacherCalls || [];
  return `
    <div class="calls-box">
      <h3>Llamados al profe</h3>
      ${calls.length ? calls.map((call) => `
        <article class="call-card">
          <div>
            <strong>${escapeHtml(call.studentName || "Estudiante")}</strong>
            <p>${escapeHtml(call.message || "Necesita asesoría")}</p>
            <small>${formatDateTime(call.createdAt)}</small>
          </div>
          <button class="btn tiny" data-action="resolve-call" data-id="${escapeHtml(call.id)}">Atendido</button>
        </article>
      `).join("") : `<p class="empty">Por ahora nadie te ha llamado. Todo en calma.</p>`}
    </div>
  `;
}

function renderStudentList(showAllControls) {
  const q = state.studentSearch || "";
  const searching = !!q.trim();
  const showAll = showAllControls && state.showAllStudents;
  const filtered = state.students.filter((student) => {
    if (searching) {
      const hay = [student.name, student.email, student.emailOverride, student.instrument, student.art, student.emphasis].join(" ");
      return normalizeText(hay).includes(normalizeText(q));
    }
    // Panel admin: por defecto solo activos en MusiGym. Con "Ver todos"
    // activado se muestran todos los estudiantes sincronizados.
    if (showAllControls) return showAll ? true : !!student.isMusiGym;
    return true;
  });
  const totalActive = state.students.filter((s) => s.isMusiGym).length;
  const emptyMsg = showAllControls && !searching && !showAll
    ? `<p class="empty">Aún no hay estudiantes activos en MusiGym. Busca un estudiante por su nombre o usa "Ver todos".</p>`
    : `<p class="empty">No hay estudiantes para mostrar.</p>`;
  const heading = showAllControls
    ? (showAll ? `Todos los estudiantes (${state.students.length})` : `Activos en MusiGym (${totalActive})`)
    : "Tus estudiantes activos";
  return `
    <section class="card">
      <div class="section-header">
        <div>
          <p class="eyebrow">Estudiantes</p>
          <h2>${heading}</h2>
        </div>
        <input id="studentSearch" class="search" placeholder="${showAllControls ? "Buscar estudiante..." : "Buscar estudiante..."}" value="${escapeHtml(q)}" data-action="student-search" />
      </div>
      ${showAllControls ? `
        <div class="list-toolbar">
          <button class="btn tiny ${showAll ? "primary" : "secondary"}" data-action="toggle-all-students">${showAll ? "Mostrando todos" : "Ver todos los estudiantes"}</button>
          <span class="list-hint">${showAll ? `Mostrando los ${state.students.length} sincronizados. Toca de nuevo para ver solo activos.` : `Mostrando solo activos. Escribe un nombre o toca "Ver todos".`}</span>
        </div>` : ""}
      <div class="student-grid">
        ${filtered.map((student) => `
          <button class="student-card ${state.selectedStudentId === student.id ? "active" : ""}" data-action="select-student" data-id="${escapeHtml(student.id)}">
            <strong>${escapeHtml(student.name)}</strong>
            <span>${escapeHtml(student.instrument || student.art || "Sin arte")}</span>
            ${showAllControls ? `<small class="card-email">${escapeHtml(student.emailOverride || student.email || "Sin correo")}</small>` : ""}
            <small>${student.isMusiGym ? "Activo MusiGym" : "No activo"}</small>
          </button>
        `).join("") || emptyMsg}
      </div>
    </section>
  `;
}

function renderSelectedStudentWorkspace(mode) {
  if (!state.selectedStudentId) return "";
  if (!state.bundle) return renderLoading("Cargando proceso del estudiante...");
  const { student } = state.bundle;
  const roleCopy = {
    admin: { eyebrow: "Ficha del estudiante", routineButton: "Generar rutina sugerida", showCoach: false },
    docente: { eyebrow: "Seguimiento pedagogico", routineButton: "Preparar rutina", showCoach: false },
    estudiante: { eyebrow: student.art || "Mi proceso", routineButton: "", showCoach: true },
  }[mode] || {};
  return `
    <section class="student-workspace">
      <div class="profile-banner">
        <div>
          <p class="eyebrow">${escapeHtml(roleCopy.eyebrow)}</p>
          <h2>${escapeHtml(student.name)}</h2>
          <p>${escapeHtml(student.instrument || "Sin instrumento")} - ${escapeHtml(student.level || "Sin nivel")} - ${escapeHtml(student.emphasis || "Sin enfasis")}</p>
          <div class="student-meta-line">
            <span>Edad: ${escapeHtml(student.age || student.edad || "Sin dato")}</span>
            <span>Correo: ${escapeHtml(student.emailOverride || student.email || student.correo || "Sin correo")}</span>
          </div>
        </div>
        <div class="banner-actions">
          ${mode !== "estudiante" ? `<button class="btn secondary" data-action="generate-routine">${escapeHtml(roleCopy.routineButton)}</button>` : ""}
          ${mode === "admin" && student.isMusiGym ? `<button class="btn ghost" data-action="enter-student-preview">Ver como estudiante</button>` : ""}
          ${mode === "estudiante" ? `<button class="btn primary" data-action="call-teacher">Llamar al profe</button>` : ""}
        </div>
      </div>
      ${mode === "admin" ? renderStudentConfig(student) : ""}
      ${roleCopy.showCoach ? renderCoachBox() : ""}
      ${renderWorkspaceTabs(mode)}
    </section>
  `;
}

function renderWorkspaceTabs(mode) {
  const tabs = [
    {
      key: "hoy", label: "Hoy", icon: "🎯",
      modules: () => [
        renderRoutineModule(mode),
        mode !== "estudiante" ? renderPrepareNextSessionModule(mode) : "",
        renderNextQuestionsModule(mode),
      ],
    },
    {
      key: "plan", label: "Plan", icon: "🗺️",
      modules: () => [
        renderDiagnosticsModule(mode),
        renderObjectivesModule(mode),
        renderSongsModule(mode),
        renderRouteModule(mode),
      ],
    },
    {
      key: "seguimiento", label: "Seguimiento", icon: "📈",
      modules: () => [
        renderSessionsModule(mode),
        renderSelfEvaluationModule(mode),
        renderMonthlyReportModule(mode),
      ],
    },
    {
      key: "recursos", label: "Recursos", icon: "📚",
      modules: () => [renderLibraryModule(mode)],
    },
  ];
  const active = tabs.some((t) => t.key === state.activeTab) ? state.activeTab : "hoy";
  const tabBar = tabs
    .map((t) => `<button class="ws-tab ${t.key === active ? "active" : ""}" data-action="switch-tab" data-tab="${t.key}" role="tab" aria-selected="${t.key === active}"><span class="ws-tab-ico" aria-hidden="true">${t.icon}</span>${escapeHtml(t.label)}</button>`)
    .join("");
  const content = tabs.find((t) => t.key === active).modules().filter(Boolean).join("");
  return `
    <nav class="ws-tabs" role="tablist" aria-label="Secciones del proceso">${tabBar}</nav>
    <div class="module-grid">${content}</div>
  `;
}

function renderStudentConfig(student) {
  return `
    <section class="card compact">
      <div class="section-header"><h3>Configuracion MusiGym</h3><span class="badge ${student.isMusiGym ? "ok" : "warn"}">${student.isMusiGym ? "Activo" : "Inactivo"}</span></div>
      <form class="form-grid" data-form="student-config">
        <input type="hidden" name="studentId" value="${escapeHtml(student.id)}" />
        <label>Activo MusiGym <select name="isMusiGym"><option value="true" ${student.isMusiGym ? "selected" : ""}>Si</option><option value="false" ${!student.isMusiGym ? "selected" : ""}>No</option></select></label>
        <label>Arte <select name="art">${optionList(CATALOGS.arts, student.art)}</select></label>
        <label>Instrumento/area <select name="instrument">${optionList(CATALOGS.instruments, student.instrument)}</select></label>
        <label>Enfasis <select name="emphasis">${optionList(CATALOGS.emphases, student.emphasis)}</select></label>
        <label>Nivel <select name="level">${optionList(CATALOGS.levels, student.level)}</select></label>
        <label class="span-2">Correo de acceso (override)
          <input type="email" name="emailOverride" value="${escapeHtml(student.emailOverride || "")}" placeholder="${escapeHtml(student.email || "correo@ejemplo.com")}" />
          <small class="helper">Correo base de Sheets: <b>${escapeHtml(student.email || "sin correo")}</b>. Si el estudiante entra con otro correo de Google, escríbelo aquí. Esto NO se borra al sincronizar. Déjalo vacío para usar el de Sheets.</small>
        </label>
        <button class="btn primary" type="submit">Guardar configuracion</button>
      </form>
    </section>
  `;
}

function getCoachMessages(studentId) {
  return state.coachMessagesByStudent[studentId] || [];
}

function addLocalCoachMessages(studentId, messages = []) {
  state.coachMessagesByStudent[studentId] = [...getCoachMessages(studentId), ...messages].slice(-10);
}

function renderCoachText(text = "") {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function coachCharSvg(size = 48) {
  return `<img src="assets/musicoach.png" width="${size}" height="${size}" alt="MusiCoach" class="coach-avatar-img" loading="lazy" decoding="async" />`;
}

function renderCoachBox() {
  const b = state.bundle;
  const stored = (b.coachLogs || []).slice(0, 6).reverse();
  const local = getCoachMessages(b.student.id);
  const messages = local.length ? local : stored;

  if (!state.coachOpen) {
    return `
      <div class="coach-widget">
        <div class="coach-bubble-text" data-action="toggle-coach" role="button" tabindex="0">
          \u00bfTe ayudo a practicar? \ud83c\udfb5
        </div>
        <button class="coach-bubble-btn" data-action="toggle-coach" aria-label="Abrir MusiCoach, tu asistente de pr\u00e1ctica">
          ${coachCharSvg(44)}
        </button>
      </div>
    `;
  }

  return `
    <div class="coach-float-panel" role="dialog" aria-label="MusiCoach">
      <div class="coach-float-header">
        <div class="coach-float-title">
          <div class="coach-float-orb">${coachCharSvg(36)}</div>
          <div>
            <strong>MusiCoach</strong>
            <small>Tu asistente de pr\u00e1ctica</small>
          </div>
        </div>
        <button class="btn ghost coach-close-btn" data-action="toggle-coach" aria-label="Cerrar MusiCoach">\u2715</button>
      </div>

      <div class="coach-thread" id="coachThread">
        ${messages.length ? messages.map((m) => `
          <div class="coach-message ${m.role === "student" ? "student" : "coach"}">
            <small>${m.role === "student" ? "T\u00fa" : "MusiCoach"}</small>
            <p>${renderCoachText(m.text)}</p>
          </div>
        `).join("") : `
          <div class="coach-message coach">
            <small>MusiCoach</small>
            <p>Hola, soy MusiCoach \ud83d\udc4b Te puedo ayudar a saber qu\u00e9 practicar, resolver dudas o prepararte para tu pr\u00f3xima clase. \u00bfPor d\u00f3nde empezamos?</p>
          </div>
        `}
      </div>

      <div class="coach-chips">
        <button class="chip" data-action="coach-intent" data-intent="practice">\u00bfQu\u00e9 practico hoy?</button>
        <button class="chip" data-action="coach-intent" data-intent="objectives">Seg\u00fan mis objetivos</button>
        <button class="chip" data-action="coach-intent" data-intent="route">\u00bfQu\u00e9 sigue?</button>
        <button class="chip" data-action="coach-intent" data-intent="explain">No entiendo algo</button>
        <button class="chip" data-action="coach-intent" data-intent="motivation">Mot\u00edvame</button>
        <button class="chip" data-action="coach-intent" data-intent="easy">Estoy cansado/a</button>
      </div>

      <form class="coach-form" data-form="coach-chat">
        <input name="message" maxlength="500" placeholder="Escribe algo: qu\u00e9 practico, no entiendo afinaci\u00f3n..." autocomplete="off" />
        <button class="btn primary" type="submit">Enviar</button>
      </form>

      <div class="coach-footer-actions">
        <button class="btn tiny secondary" data-action="coach-create-routine">Crear rutina con esto</button>
        <button class="btn tiny ghost" data-action="coach-save-last-question">Guardar duda para mi profe</button>
        <button class="btn tiny ghost" data-action="call-teacher">Llamar al profe</button>
      </div>
    </div>
    <div class="coach-widget coach-widget-open">
      <button class="coach-bubble-btn coach-bubble-active" data-action="toggle-coach" aria-label="Cerrar MusiCoach">
        ${coachCharSvg(44)}
      </button>
    </div>
  `;
}


async function runCoachInteraction({ text = "", intent = "" } = {}) {
  const b = state.bundle;
  if (!b?.student) return null;
  const labelByIntent = {
    practice: "¿Qué practico hoy?",
    objectives: "Según mis objetivos",
    route: "¿Qué sigue en mi ruta?",
    explain: "No entiendo algo",
    motivation: "Motívame",
    easy: "Estoy cansado/a",
    challenge: "Dame un reto",
  };
  const userText = safeText(text) || labelByIntent[intent] || "Necesito ayuda con mi práctica";
  const response = buildCoachResponse({
    student: b.student,
    objectives: b.objectives,
    routine: b.activeRoutine,
    progress: b.progress,
    songs: b.songs,
    diagnostics: b.diagnostics,
    evaluations: b.evaluations,
    sessions: b.sessions,
    text: userText,
    intent,
  });
  const accessEmail = studentAccessEmail(b.student);
  const userMessage = { role: "student", intent: response.intent, text: userText, createdBy: state.profile?.email || "", studentEmail: accessEmail };
  const coachMessage = { role: "coach", intent: response.intent, text: `${response.title}\n${response.body}`, createdBy: "MusiCoach", studentEmail: accessEmail };
  addLocalCoachMessages(b.student.id, [userMessage, coachMessage]);
  b.coachLogs = [coachMessage, userMessage, ...(b.coachLogs || [])];
  try {
    await Promise.all([
      saveCoachLog(b.student.id, userMessage),
      saveCoachLog(b.student.id, coachMessage),
    ]);
  } catch (error) {
    console.warn("No se pudo guardar el chat de MusiCoach", error);
  }
  return response;
}

function studentRoutineText(value = "") {
  return safeText(value)
    .replace(/Cierre y dudas para el profe/gi, "Cierre de practica")
    .replace(/dudas para el profe/gi, "cierre de practica")
    .replace(/para el profe/gi, "para tu practica")
    .replace(/Nada de entrar a tocar como si la muÃ±eca fuera repuesto barato\./gi, "Toca lento al inicio y busca un sonido comodo y limpio.")
    .replace(/Nada de entrar a tocar como si la muñeca fuera repuesto barato\./gi, "Toca lento al inicio y busca un sonido comodo y limpio.")
    .replace(/antes de huir de la responsabilidad artÃ­stica\./gi, "y define un siguiente paso pequeno para tu proxima practica.")
    .replace(/antes de huir de la responsabilidad artística\./gi, "y define un siguiente paso pequeno para tu proxima practica.");
}

function renderRoutineModule(mode) {
  const { routines, activeRoutine } = state.bundle;
  const canEdit = mode !== "estudiante";
  const isEditing = canEdit && activeRoutine && state.editingRoutineId === activeRoutine.id;

  if (isEditing) {
    return `
      <section class="card module wide">
        <div class="section-header"><h3>Editando rutina</h3></div>
        ${renderRoutineEditor(activeRoutine)}
      </section>
    `;
  }

  return `
    <section class="card module wide">
      <div class="section-header">
        <h3>Rutina activa</h3>
        <div class="header-actions">
          <span class="badge">${routines.length} rutina(s)</span>
          ${canEdit && activeRoutine ? `<button class="btn tiny secondary" data-action="routine-edit-start" data-id="${escapeHtml(activeRoutine.id)}">Editar rutina</button>` : ""}
        </div>
      </div>
      ${activeRoutine ? `
        <h4>${escapeHtml(activeRoutine.title)}</h4>
        <div class="routine-blocks">
          ${(activeRoutine.blocks || []).map((block) => `
            <article class="routine-block">
              <strong>${escapeHtml(block.minutes || 5)} min · ${escapeHtml(studentRoutineText(block.name))}</strong>
              <span>${escapeHtml(block.component || "Práctica")}</span>
              <p>${escapeHtml(studentRoutineText(block.instructions || ""))}</p>
            </article>
          `).join("")}
        </div>
      ` : `<p class="empty">Todavía no hay una rutina de práctica. Tu profe te preparará una pronto.</p>`}
      ${mode !== "estudiante" && routines.length ? `
        <div class="chips">${routines.map((r) => `<button class="chip" data-action="set-routine" data-id="${escapeHtml(r.id)}">${escapeHtml(r.title)}</button>`).join("")}</div>
      ` : ""}
    </section>
  `;
}

function renderRoutineEditor(routine) {
  const blocks = state.routineDraft || routine.blocks || [];
  const totalMin = blocks.reduce((sum, b) => sum + Number(b.minutes || 0), 0);
  return `
    <form data-form="routine-edit" class="routine-editor">
      <label class="field">Título de la rutina
        <input name="title" value="${escapeHtml(routine.title || "")}" required />
      </label>
      <p class="list-hint">Total: ${totalMin} min · ${blocks.length} bloque(s)</p>
      <div class="routine-edit-blocks">
        ${blocks.map((block, i) => `
          <article class="routine-block-edit" data-block-index="${i}">
            <div class="rbe-row">
              <label class="rbe-min">Min
                <input type="number" min="1" max="120" name="minutes_${i}" value="${escapeHtml(block.minutes || 5)}" />
              </label>
              <label class="rbe-grow">Nombre del bloque
                <input name="name_${i}" value="${escapeHtml(block.name || "")}" />
              </label>
              <button type="button" class="btn tiny ghost rbe-del" data-action="routine-remove-block" data-index="${i}" title="Eliminar bloque">✕</button>
            </div>
            <label>Componente
              <input name="component_${i}" value="${escapeHtml(block.component || "")}" placeholder="Hábitos, Técnica, Repertorio..." />
            </label>
            <label>Instrucciones
              <textarea name="instructions_${i}" rows="2">${escapeHtml(block.instructions || "")}</textarea>
            </label>
          </article>
        `).join("")}
      </div>
      <div class="routine-editor-actions">
        <button type="button" class="btn secondary" data-action="routine-add-block">+ Agregar bloque</button>
        <div class="routine-editor-save">
          <button type="button" class="btn ghost" data-action="routine-cancel-edit">Cancelar</button>
          <button type="submit" class="btn primary">Guardar rutina</button>
        </div>
      </div>
    </form>
  `;
}

// ---- Plantillas de rutina predeterminadas (admin) ----
function renderRoutineTemplatesManager() {
  if (state.editingTemplateKey) {
    return `<section class="card module wide">${renderTemplateEditor()}</section>`;
  }
  const templates = state.routineTemplates || [];
  const instrumentOptions = CATALOGS.instruments
    .map((i) => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`)
    .join("");
  return `
    <section class="card module wide">
      <div class="section-header"><h3>Rutinas predeterminadas</h3><span class="badge">${templates.length} plantilla(s)</span></div>
      <p class="list-hint">Estas plantillas se usan al generar rutinas automáticamente. Placeholders disponibles: <code>{{instrumento}}</code> <code>{{nivel}}</code> <code>{{ruta}}</code> <code>{{objetivo}}</code> <code>{{cancion}}</code>.</p>
      <div class="template-list">
        ${templates.length ? templates.map((t) => `
          <article class="template-row">
            <div>
              <strong>${escapeHtml(t.instrument || t.id)}</strong>
              <span>${escapeHtml(t.title || "")} · ${(t.blocks || []).length} bloque(s)</span>
            </div>
            <div class="template-row-actions">
              <button class="btn tiny secondary" data-action="template-edit-start" data-key="${escapeHtml(t.id)}">Editar</button>
              <button class="btn tiny ghost" data-action="template-delete" data-key="${escapeHtml(t.id)}">Eliminar</button>
            </div>
          </article>
        `).join("") : `<p class="empty">Aún no hay plantillas guardadas. Mientras tanto, las rutinas usan la plantilla base automática. Crea una para personalizar.</p>`}
      </div>
      <form class="mini-form template-create" data-form="template-create">
        <label>Crear o editar plantilla para
          <select name="instrument">
            <option value="default">General (para cualquier instrumento sin plantilla propia)</option>
            ${instrumentOptions}
          </select>
        </label>
        <button type="submit" class="btn secondary">Abrir editor</button>
      </form>
    </section>
  `;
}

function renderTemplateEditor() {
  const draft = state.templateDraft || { instrument: "default", title: "", blocks: [] };
  const blocks = draft.blocks || [];
  const totalMin = blocks.reduce((sum, b) => sum + Number(b.minutes || 0), 0);
  return `
    <div class="section-header"><h3>Editando plantilla: ${escapeHtml(draft.instrument)}</h3></div>
    <form data-form="template-edit" class="routine-editor">
      <label class="field">Título de la rutina (acepta placeholders)
        <input name="title" value="${escapeHtml(draft.title || "")}" required />
      </label>
      <p class="list-hint">Total: ${totalMin} min · ${blocks.length} bloque(s) · Placeholders: <code>{{instrumento}}</code> <code>{{nivel}}</code> <code>{{ruta}}</code> <code>{{objetivo}}</code> <code>{{cancion}}</code></p>
      <div class="routine-edit-blocks">
        ${blocks.map((block, i) => `
          <article class="template-block-edit routine-block-edit" data-block-index="${i}">
            <div class="rbe-row">
              <label class="rbe-min">Min
                <input type="number" min="1" max="120" name="tmin_${i}" value="${escapeHtml(block.minutes || 5)}" />
              </label>
              <label class="rbe-grow">Nombre del bloque
                <input name="tname_${i}" value="${escapeHtml(block.name || "")}" />
              </label>
              <button type="button" class="btn tiny ghost rbe-del" data-action="template-remove-block" data-index="${i}" title="Eliminar bloque">✕</button>
            </div>
            <label>Componente
              <input name="tcomp_${i}" value="${escapeHtml(block.component || "")}" placeholder="Hábitos, Técnica, Repertorio..." />
            </label>
            <label>Instrucciones
              <textarea name="tinstr_${i}" rows="2">${escapeHtml(block.instructions || "")}</textarea>
            </label>
          </article>
        `).join("")}
      </div>
      <div class="routine-editor-actions">
        <button type="button" class="btn secondary" data-action="template-add-block">+ Agregar bloque</button>
        <div class="routine-editor-save">
          <button type="button" class="btn ghost" data-action="template-cancel-edit">Cancelar</button>
          <button type="submit" class="btn primary">Guardar plantilla</button>
        </div>
      </div>
    </form>
  `;
}

function captureTemplateDraft() {
  const form = appRoot.querySelector('form[data-form="template-edit"]');
  if (!form) return;
  const title = form.querySelector('[name="title"]')?.value || "";
  const blocks = [];
  form.querySelectorAll(".template-block-edit").forEach((el) => {
    const i = el.dataset.blockIndex;
    blocks.push({
      name: form.querySelector(`[name="tname_${i}"]`)?.value || "",
      component: form.querySelector(`[name="tcomp_${i}"]`)?.value || "",
      minutes: Number(form.querySelector(`[name="tmin_${i}"]`)?.value || 5),
      instructions: form.querySelector(`[name="tinstr_${i}"]`)?.value || "",
    });
  });
  state.templateDraft = { instrument: state.templateDraft?.instrument || "default", title, blocks };
}

// Lee el formulario de edición de rutina del DOM hacia state.routineDraft,
// para no perder cambios al re-renderizar (agregar/quitar bloques).
function captureRoutineDraft() {
  const form = appRoot.querySelector('form[data-form="routine-edit"]');
  if (!form) return;
  const blockEls = form.querySelectorAll(".routine-block-edit");
  const blocks = [];
  blockEls.forEach((el) => {
    const i = el.dataset.blockIndex;
    const prev = state.routineDraft?.[Number(i)] || {};
    blocks.push({
      id: prev.id || uid("block"),
      minutes: Number(form.querySelector(`[name="minutes_${i}"]`)?.value || 5),
      name: form.querySelector(`[name="name_${i}"]`)?.value || "",
      component: form.querySelector(`[name="component_${i}"]`)?.value || "",
      instructions: form.querySelector(`[name="instructions_${i}"]`)?.value || "",
    });
  });
  state.routineDraft = blocks;
}

function renderRouteModule(mode) {
  const { student, progress } = state.bundle;
  const route = getRouteForInstrument(student.instrument);
  const progressMap = new Map(progress.map((p) => [p.routeItemId, p]));
  const byComponent = getRouteProgressByComponent(student, progress);
  return `
    <section class="card module wide">
      <div class="section-header"><h3>Ruta de avance</h3><span class="badge">${escapeHtml(student.instrument || "General")}</span></div>
      <div class="progress-components">
        ${Object.entries(byComponent).map(([name, data]) => {
          const percent = data.total ? Math.round((data.achieved / data.total) * 100) : 0;
          return `<div><strong>${escapeHtml(name)}</strong><span>${percent}%</span><progress max="100" value="${percent}"></progress></div>`;
        }).join("")}
      </div>
      <div class="route-list">
        ${route.map((item) => {
          const saved = progressMap.get(item.id);
          const status = saved?.status || "pending";
          const isAchieved = status === "achieved" || status === "completed";
          return `
            <article class="route-item ${status}">
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.component)} · ${escapeHtml(item.level)}</span>
                <p>${escapeHtml(item.description)}</p>
              </div>
              ${mode !== "estudiante" ? `
                <select data-action="route-status" data-id="${escapeHtml(item.id)}">
                  <option value="pending" ${status === "pending" ? "selected" : ""}>Pendiente</option>
                  <option value="in_progress" ${status === "in_progress" ? "selected" : ""}>En proceso</option>
                  <option value="achieved" ${isAchieved ? "selected" : ""}>Logrado</option>
                </select>
              ` : `<span class="badge ${isAchieved ? "ok" : status === "in_progress" ? "info" : ""}">${isAchieved ? "Logrado" : status === "in_progress" ? "En proceso" : "Pendiente"}</span>`}
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

const OBJECTIVE_STATUS_LABELS = {
  active: "Por empezar",
  in_progress: "En proceso",
  achieved: "Logrado",
  archived: "Guardado",
};
const OBJECTIVE_PRIORITY_LABELS = { baja: "Tranquilo", media: "Importante", alta: "Prioritario" };

function objectiveStatusLabel(status) {
  return OBJECTIVE_STATUS_LABELS[status] || "Por empezar";
}
function objectivePriorityLabel(priority) {
  return OBJECTIVE_PRIORITY_LABELS[priority] || "Importante";
}

function renderObjectiveCard(o, mode) {
  // Vista estudiante: solo lectura, en tarjeta amable.
  if (mode === "estudiante") {
    return `
      <article class="objective-row status-${escapeHtml(o.status || "active")}">
        <div class="objective-row-main">
          <strong>${escapeHtml(o.title)}</strong>
          ${o.description ? `<p>${escapeHtml(o.description)}</p>` : ""}
        </div>
        <span class="chip chip-${escapeHtml(o.status || "active")}">${escapeHtml(objectiveStatusLabel(o.status))}</span>
      </article>
    `;
  }

  // Docente/Admin en modo edición de ESTE objetivo: formulario completo.
  if (state.editingObjectiveId === o.id) {
    return `
      <article class="list-item editable-item objective-editing" data-objective-id="${escapeHtml(o.id)}">
        <input name="title" value="${escapeHtml(o.title)}" placeholder="¿Qué quieres lograr?" />
        <textarea name="description" placeholder="Una nota breve (opcional)">${escapeHtml(o.description || "")}</textarea>
        <div class="edit-row">
          <label class="field-mini">Área<select name="component">${optionList(["Tecnica", "Teoria", "Repertorio", "Creatividad", "Habitos"], o.component || "Tecnica")}</select></label>
          <label class="field-mini">¿Cómo va?<select name="status">${optionList(["active", "in_progress", "achieved", "archived"], o.status || "active")}</select></label>
          <label class="field-mini">Foco<select name="priority">${optionList(["baja", "media", "alta"], o.priority || "media")}</select></label>
        </div>
        <div class="inline-actions">
          <button class="btn tiny" data-action="save-objective" data-id="${escapeHtml(o.id)}">Guardar</button>
          <button class="btn tiny ghost" data-action="cancel-edit-objective">Cancelar</button>
          <button class="btn tiny ghost" data-action="delete-objective" data-id="${escapeHtml(o.id)}">Quitar</button>
        </div>
      </article>
    `;
  }

  // Docente/Admin: fila bonita de solo lectura con botón para editar.
  return `
    <article class="objective-row status-${escapeHtml(o.status || "active")}">
      <div class="objective-row-main">
        <strong>${escapeHtml(o.title)}</strong>
        ${o.description ? `<p>${escapeHtml(o.description)}</p>` : ""}
      </div>
      <div class="objective-row-meta">
        <span class="chip chip-${escapeHtml(o.status || "active")}">${escapeHtml(objectiveStatusLabel(o.status))}</span>
        <span class="chip chip-soft">${escapeHtml(objectivePriorityLabel(o.priority))}</span>
        <button class="btn tiny ghost" data-action="edit-objective" data-id="${escapeHtml(o.id)}">Editar</button>
      </div>
    </article>
  `;
}

function renderObjectivesModule(mode) {
  const { objectives } = state.bundle;
  // Grupos siempre visibles + extras solo si tienen objetivos.
  const groups = [
    { key: "Tecnica", label: "Objetivos técnicos", always: true },
    { key: "Teoria", label: "Objetivos teóricos", always: true },
    { key: "Repertorio", label: "Objetivos de repertorio", always: false },
    { key: "Creatividad", label: "Objetivos de creatividad", always: false },
    { key: "Habitos", label: "Hábitos", always: false },
  ];
  const groupsHtml = groups.map((g) => {
    const items = objectives.filter((o) => (o.component || "Tecnica") === g.key);
    if (!items.length && !g.always) return "";
    return `
      <div class="objective-group">
        <h4 class="objective-group-title">${escapeHtml(g.label)} <span class="badge">${items.length}</span></h4>
        <div class="stack-list">
          ${items.map((o) => renderObjectiveCard(o, mode)).join("") || `<p class="empty">Sin objetivos en esta categoría.</p>`}
        </div>
      </div>
    `;
  }).join("");
  const addBlock = mode !== "estudiante" ? (
    state.objectiveFormOpen ? `
        <form class="mini-form objective-add-form" data-form="objective">
          <input name="title" placeholder="¿Qué quieres lograr?" required />
          <textarea name="description" placeholder="Una nota breve (opcional)"></textarea>
          <label class="field-mini">Área
            <select name="component"><option value="Tecnica">Técnica</option><option value="Teoria">Teoría</option><option value="Repertorio">Repertorio</option><option value="Creatividad">Creatividad</option><option value="Habitos">Hábitos</option></select>
          </label>
          <div class="inline-actions">
            <button class="btn primary" type="submit">Guardar objetivo</button>
            <button class="btn ghost" type="button" data-action="toggle-objective-form">Cancelar</button>
          </div>
        </form>
      ` : `
        <button class="btn secondary full" data-action="toggle-objective-form">+ Agregar un objetivo</button>
      `
  ) : "";
  return `
    <section class="card module">
      <div class="section-header"><h3>Objetivos</h3><span class="badge">${objectives.length}</span></div>
      ${groupsHtml}
      ${addBlock}
    </section>
  `;
}

const SONG_STATUS_LABELS = {
  requested: "Pedida",
  approved: "Aprobada",
  in_progress: "En montaje",
  learned: "Aprendida",
  archived: "Guardada",
};
function songStatusLabel(status) {
  return SONG_STATUS_LABELS[status] || "Pedida";
}
// Mapa de estado de canción a las clases de chip de objetivos (reutilizamos colores).
function songStatusChipClass(status) {
  if (status === "learned") return "achieved";
  if (status === "in_progress" || status === "approved") return "in_progress";
  if (status === "archived") return "archived";
  return "active";
}

function renderSongCard(s, mode) {
  // Edición (docente/admin) de ESTA canción.
  if (mode !== "estudiante" && state.editingSongId === s.id) {
    return `
      <article class="list-item editable-item" data-song-id="${escapeHtml(s.id)}">
        <input name="songName" value="${escapeHtml(s.songName)}" placeholder="Canción" />
        <input name="artist" value="${escapeHtml(s.artist || "")}" placeholder="Artista" />
        <textarea name="reason" placeholder="Motivo o interés">${escapeHtml(s.reason || "")}</textarea>
        <label class="field-mini">¿Cómo va?<select name="status">${optionList(["requested", "approved", "in_progress", "learned", "archived"], s.status || "requested")}</select></label>
        <div class="inline-actions">
          <button class="btn tiny" data-action="save-song" data-id="${escapeHtml(s.id)}">Guardar</button>
          <button class="btn tiny ghost" data-action="cancel-edit-song">Cancelar</button>
          <button class="btn tiny ghost" data-action="delete-song" data-id="${escapeHtml(s.id)}">Quitar</button>
        </div>
      </article>
    `;
  }
  const statusClass = songStatusChipClass(s.status);
  return `
    <article class="objective-row status-${statusClass}">
      <div class="objective-row-main">
        <strong>${escapeHtml(s.songName)}</strong>
        <p>${escapeHtml(s.artist || "Artista por definir")}${s.reason ? ` · ${escapeHtml(s.reason)}` : ""}</p>
      </div>
      <div class="objective-row-meta">
        <span class="chip chip-${statusClass}">${escapeHtml(songStatusLabel(s.status))}</span>
        ${mode !== "estudiante" ? `<button class="btn tiny ghost" data-action="edit-song" data-id="${escapeHtml(s.id)}">Editar</button>` : ""}
      </div>
    </article>
  `;
}

function renderSongsModule(mode) {
  const { songs } = state.bundle;
  const addBlock = state.songFormOpen ? `
        <form class="mini-form objective-add-form" data-form="song">
          <input name="songName" placeholder="Canción" required />
          <input name="artist" placeholder="Artista" />
          <textarea name="reason" placeholder="¿Por qué quieres aprenderla?"></textarea>
          <div class="inline-actions">
            <button class="btn primary" type="submit">Guardar canción</button>
            <button class="btn ghost" type="button" data-action="toggle-song-form">Cancelar</button>
          </div>
        </form>
      ` : `
        <button class="btn secondary full" data-action="toggle-song-form">+ Agregar una canción</button>
      `;
  return `
    <section class="card module">
      <div class="section-header"><h3>Canciones deseadas</h3><span class="badge">${songs.length}</span></div>
      <div class="stack-list">
        ${songs.map((s) => renderSongCard(s, mode)).join("") || `<p class="empty">Aún no has pedido canciones. ¿Cuál te gustaría aprender?</p>`}
      </div>
      ${addBlock}
    </section>
  `;
}

function renderNextQuestionsModule(mode) {
  const doc = state.bundle.nextQuestions || { questions: [] };
  const pending = getPendingQuestions(doc);
  const answered = (doc.questions || []).filter((q) => q.status === "answered");
  return `
    <section class="card module">
      <div class="section-header"><h3>Preguntas para la próxima sesión</h3><span class="badge">${pending.length}/3 preguntas usadas</span></div>
      <p class="helper">Puedes dejar hasta 3 preguntas para que tu profe las tenga presentes en tu próxima sesión.</p>
      <div class="stack-list">
        ${pending.map((q) => `
          <article class="list-item question-item">
            ${mode === "estudiante" ? `
              <textarea maxlength="300" data-action="question-edit" data-id="${escapeHtml(q.id)}">${escapeHtml(q.text)}</textarea>
              <div class="inline-actions">
                <button class="btn tiny" data-action="save-question-edit" data-id="${escapeHtml(q.id)}">Guardar</button>
                <button class="btn tiny ghost" data-action="delete-question" data-id="${escapeHtml(q.id)}">Eliminar</button>
              </div>
            ` : `
              <strong>${escapeHtml(q.text)}</strong>
              <small>Pendiente</small>
              <div class="inline-actions">
                <button class="btn tiny" data-action="answer-question" data-id="${escapeHtml(q.id)}">Marcar respondida</button>
                <button class="btn tiny ghost" data-action="archive-question" data-id="${escapeHtml(q.id)}">Archivar</button>
              </div>
            `}
          </article>
        `).join("") || `<p class="empty">No tienes preguntas guardadas para tu profe.</p>`}
      </div>
      ${mode === "estudiante" && pending.length < 3 ? `
        <form class="mini-form" data-form="next-question">
          <textarea name="text" maxlength="300" placeholder="Escribe una pregunta opcional para tu próxima sesión"></textarea>
          <button class="btn primary" type="submit">Guardar pregunta</button>
        </form>
      ` : ""}
      ${answered.length && mode !== "estudiante" ? `<details class="history-details"><summary>Historial respondido (${answered.length})</summary>${answered.map((q) => `<p>${escapeHtml(q.text)}</p>`).join("")}</details>` : ""}
    </section>
  `;
}

function toDateInputValue(value) {
  const d = value?.toDate ? value.toDate() : (value ? new Date(value) : new Date());
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  // Fecha local en formato YYYY-MM-DD (sin corrimiento de zona horaria).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function renderSessionEditForm(s) {
  return `
    <article class="timeline-item editable-item" data-session-id="${escapeHtml(s.id)}">
      <div class="edit-row">
        <label class="field-mini">Fecha<input type="date" name="date" value="${escapeHtml(toDateInputValue(s.date))}" /></label>
        <label class="field-mini">Tipo<select name="type">${optionList(CATALOGS.sessionTypes, s.type || "Práctica guiada")}</select></label>
        <label class="field-mini">Avance 0-100<input type="number" min="0" max="100" name="progressScore" value="${escapeHtml(s.progressScore || 0)}" /></label>
      </div>
      <label class="field-mini">Resumen<textarea name="summary">${escapeHtml(s.summary || "")}</textarea></label>
      <label class="field-mini">Recomendaciones<textarea name="practiceRecommendations">${escapeHtml(s.practiceRecommendations || "")}</textarea></label>
      <label class="field-mini">Próxima práctica<textarea name="nextPractice">${escapeHtml(s.nextPractice || "")}</textarea></label>
      <label class="field-mini">Notas internas<textarea name="teacherNotes">${escapeHtml(s.teacherNotes || "")}</textarea></label>
      <div class="inline-actions">
        <button class="btn tiny" data-action="save-session-edit" data-id="${escapeHtml(s.id)}">Guardar cambios</button>
        <button class="btn tiny ghost" data-action="cancel-edit-session">Cancelar</button>
        <button class="btn tiny ghost" data-action="delete-session" data-id="${escapeHtml(s.id)}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderSessionsModule(mode) {
  const { sessions, objectives } = state.bundle;
  const route = getRouteForInstrument(state.bundle.student.instrument);
  return `
    <section class="card module wide" id="sessionsModule">
      <div class="section-header"><h3>${mode === "estudiante" ? "Mis sesiones" : "Bitácoras de sesiones"}</h3><span class="badge">${sessions.length}</span></div>
      <div class="timeline">
        ${sessions.slice(0, 8).map((s) => {
          if (mode !== "estudiante" && state.editingSessionId === s.id) {
            return renderSessionEditForm(s);
          }
          const hasEvaluation = state.bundle.evaluations.some((e) => e.sessionId === s.id);
          const workedObjectives = (s.objectivesWorked || [])
            .map((id) => objectives.find((o) => o.id === id)?.title)
            .filter(Boolean);
          const workedRoute = (s.routeItemsWorked || [])
            .map((id) => { const it = route.find((r) => r.id === id); return it ? `${it.component} - ${it.title}` : null; })
            .filter(Boolean);
          const fullDetail = mode !== "estudiante" ? `
            <details class="history-details session-detail">
              <summary>Ver completo</summary>
              ${s.practiceRecommendations ? `<p><b>Recomendaciones:</b> ${escapeHtml(s.practiceRecommendations)}</p>` : ""}
              ${s.nextPractice ? `<p><b>Próxima práctica:</b> ${escapeHtml(s.nextPractice)}</p>` : ""}
              ${s.teacherNotes ? `<p><b>Notas internas:</b> ${escapeHtml(s.teacherNotes)}</p>` : ""}
              ${workedObjectives.length ? `<p><b>Objetivos trabajados:</b> ${escapeHtml(workedObjectives.join(", "))}</p>` : ""}
              ${workedRoute.length ? `<p><b>Puntos de ruta:</b> ${escapeHtml(workedRoute.join(", "))}</p>` : ""}
            </details>` : "";
          const teacherActions = mode !== "estudiante" ? `<div class="inline-actions"><button class="btn tiny ghost" data-action="edit-session" data-id="${escapeHtml(s.id)}">Editar</button><button class="btn tiny ghost" data-action="delete-session" data-id="${escapeHtml(s.id)}">Eliminar</button></div>` : "";
          return `<article class="timeline-item"><small>${formatDate(s.date)} - ${escapeHtml(s.type || "Sesion")}</small><strong>${escapeHtml(s.summary || "Sesion registrada")}</strong><p>${escapeHtml(s.nextPractice || s.practiceRecommendations || "")}</p><span class="badge">Avance ${escapeHtml(s.progressScore || 0)}/100</span>${fullDetail}${mode === "estudiante" ? `<button class="btn tiny ${hasEvaluation ? "ghost" : ""}" data-action="select-evaluation-session" data-id="${escapeHtml(s.id)}">${hasEvaluation ? "Autoevaluacion enviada" : "Hacer autoevaluacion"}</button>` : ""}${teacherActions}</article>`;
        }).join("") || `<p class="empty">Aún no hay sesiones registradas en tu proceso.</p>`}
      </div>
      ${mode !== "estudiante" ? (state.sessionFormOpen ? `
        <form class="form-grid objective-add-form" data-form="session">
          <label>Fecha <input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" /></label>
          <label>Tipo <select name="type">${optionList(CATALOGS.sessionTypes, "Practica guiada")}</select></label>
          <label>Avance 0-100 <input type="number" min="0" max="100" name="progressScore" value="50" /></label>
          <label class="span-2">Resumen <textarea name="summary" required placeholder="Que se trabajo, que se observo, que mejoro..."></textarea></label>
          <label class="span-2">Recomendaciones <textarea name="practiceRecommendations" placeholder="Recomendaciones de practica"></textarea></label>
          <label class="span-2">Proxima practica <textarea name="nextPractice" placeholder="Que debe hacer antes de volver"></textarea></label>
          <label class="span-2">Notas internas <textarea name="teacherNotes" placeholder="Observaciones para el equipo"></textarea></label>
          <label class="span-2">Objetivos trabajados <select name="objectivesWorked" multiple>${objectives.map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.title)}</option>`).join("")}</select></label>
          <label class="span-2">Puntos de ruta trabajados <select name="routeItemsWorked" multiple>${route.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.component)} - ${escapeHtml(item.title)}</option>`).join("")}</select></label>
          <div class="span-2 inline-actions">
            <button class="btn primary" type="submit">Guardar bitácora</button>
            <button class="btn ghost" type="button" data-action="toggle-session-form">Cancelar</button>
          </div>
        </form>
      ` : `
        <button class="btn secondary full" data-action="toggle-session-form">+ Agregar una bitácora</button>
      `) : ""}
    </section>
  `;
}

function renderDiagnosticsModule(mode) {
  const { diagnostics } = state.bundle;
  return `
    <section class="card module wide">
      <div class="section-header"><h3>Diagnóstico inicial</h3><span class="badge">${diagnostics.length}</span></div>
      ${diagnostics[0] ? (() => {
        const d = diagnostics[0];
        const extra = [
          d.interests ? `<p><b>Intereses:</b> ${escapeHtml(d.interests)}</p>` : "",
          d.technique ? `<p><b>Técnica:</b> ${escapeHtml(d.technique)}</p>` : "",
          d.theory ? `<p><b>Teoría:</b> ${escapeHtml(d.theory)}</p>` : "",
          d.repertoire ? `<p><b>Repertorio:</b> ${escapeHtml(d.repertoire)}</p>` : "",
        ].filter(Boolean).join("");
        return `<article class="diagnostic-summary"><strong>${formatDate(d.date || d.createdAt)}</strong><p><b>Fortalezas:</b> ${escapeHtml(d.strengths || "")}</p><p><b>Retos:</b> ${escapeHtml(d.challenges || "")}</p><p><b>Recomendación:</b> ${escapeHtml(d.recommendation || "")}</p>${extra ? `<details class="history-details"><summary>Ver diagnóstico completo</summary>${extra}</details>` : ""}</article>`;
      })() : `<p class="empty">Aún no hay un diagnóstico inicial. Será el punto de partida del proceso.</p>`}
      ${mode !== "estudiante" ? (state.diagnosticFormOpen ? `
        <form class="form-grid" data-form="diagnostic">
          <label>Fecha <input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" /></label>
          <label class="span-2">Fortalezas <textarea name="strengths" placeholder="Qué se ve fuerte desde el inicio"></textarea></label>
          <label class="span-2">Retos <textarea name="challenges" placeholder="Qué necesita trabajar"></textarea></label>
          <label>Intereses <textarea name="interests" placeholder="Gustos, canciones, referentes"></textarea></label>
          <label>Técnica <textarea name="technique" placeholder="Postura, coordinación, control"></textarea></label>
          <label>Teoría <textarea name="theory" placeholder="Lectura, ritmo, conceptos"></textarea></label>
          <label>Repertorio <textarea name="repertoire" placeholder="Canciones o piezas"></textarea></label>
          <label class="span-2">Hábitos y recomendación <textarea name="recommendation" placeholder="Ruta inicial sugerida"></textarea></label>
          <div class="span-2 form-actions">
            <button class="btn primary" type="submit">Guardar diagnóstico</button>
            <button class="btn ghost" type="button" data-action="toggle-diagnostic-form">Cancelar</button>
          </div>
        </form>
      ` : `
        <button class="btn secondary" data-action="toggle-diagnostic-form">${diagnostics[0] ? "Agregar / editar diagnóstico" : "Agregar diagnóstico"}</button>
      `) : ""}
    </section>
  `;
}

function renderSelfEvaluationModule(mode) {
  const { evaluations, sessions } = state.bundle;
  const selectedSessionId = state.selectedEvaluationSessionId || sessions[0]?.id || "";
  return `
    <section class="card module">
      <div class="section-header"><h3>¿Cómo me sentí al practicar?</h3><span class="badge">${evaluations.length}</span></div>
      <div class="stack-list">
        ${evaluations.slice(0, 4).map((e) => `<article class="list-item"><strong>${escapeHtml(e.feeling || e.mood || "Mi sesión")}</strong><p>${escapeHtml(e.whatWentWell || e.learned || "")}</p><small>Energía ${escapeHtml(e.energyLevel || e.energy || 3)}/5 · Dificultad ${escapeHtml(e.difficultyLevel || e.difficulty || 3)}/5</small></article>`).join("") || `<p class="empty">Todavía no has registrado cómo te sentiste. Cuéntanos después de practicar.</p>`}
      </div>
      ${mode === "estudiante" ? `
        <form class="mini-form" data-form="self-evaluation">
          <select name="sessionId">${sessions.map((s) => `<option value="${escapeHtml(s.id)}" ${selectedSessionId === s.id ? "selected" : ""}>${formatDate(s.date)} - ${escapeHtml(s.type || "Sesion")}</option>`).join("")}</select>
          <select name="feeling">${optionList(CATALOGS.moodOptions, "Bien")}</select>
          <label>Energia <input type="range" name="energyLevel" min="1" max="5" value="3" /></label>
          <label>Dificultad <input type="range" name="difficultyLevel" min="1" max="5" value="3" /></label>
          <textarea name="whatWentWell" placeholder="Que salio bien en esta sesion"></textarea>
          <textarea name="whatWasDifficult" placeholder="Que fue dificil"></textarea>
          <textarea name="whatDoIWantNext" placeholder="Que quieres trabajar despues"></textarea>
          <button class="btn primary" type="submit">Guardar autoevaluacion</button>
        </form>
      ` : ""}
    </section>
  `;
}

function renderMonthlyReportModule(mode) {
  const { reports } = state.bundle;
  return `
    <section class="card module wide">
      <div class="section-header"><h3>Informes mensuales</h3><span class="badge">${reports.length}</span></div>
      ${mode !== "estudiante" ? `
        <div class="inline-actions">
          <input type="month" id="reportMonth" value="${monthKey()}" />
          <button class="btn primary" data-action="generate-report">Generar informe del mes</button>
        </div>
      ` : ""}
      <div class="stack-list">
        ${reports.slice(0, 3).map((r) => `<article class="report-card"><strong>${escapeHtml(r.month)}</strong><pre>${escapeHtml(r.generatedText || "")}</pre></article>`).join("") || `<p class="empty">Aún no hay informes de tu proceso.</p>`}
      </div>
    </section>
  `;
}

function renderPrepareNextSessionModule() {
  const b = state.bundle;
  const pending = getPendingQuestions(b.nextQuestions);
  const lastEval = b.evaluations[0];
  const lastSession = b.sessions[0];
  const activeObjectives = b.objectives.filter((o) => (o.status || "active") === "active").slice(0, 3);
  return `
    <section class="card module wide">
      <div class="section-header"><h3>Preparar próxima sesión</h3><span class="badge">Guía docente</span></div>
      <div class="prep-grid">
        <article><strong>Objetivos activos</strong><p>${activeObjectives.map((o) => escapeHtml(o.title)).join(", ") || "Sin objetivos activos."}</p></article>
        <article><strong>Rutina</strong><p>${escapeHtml(b.activeRoutine?.title || "Sin rutina activa.")}</p></article>
        <article><strong>Preguntas pendientes</strong><p>${pending.map((q) => escapeHtml(q.text)).join(" | ") || "Sin preguntas pendientes."}</p></article>
        <article><strong>Última autoevaluación</strong><p>${lastEval ? `${escapeHtml(lastEval.feeling || lastEval.mood || "")} - ${escapeHtml(lastEval.whatWasDifficult || lastEval.doubt || "")}` : "Sin autoevaluación."}</p></article>
        <article><strong>Última bitácora</strong><p>${lastSession ? escapeHtml(lastSession.summary || lastSession.practiceRecommendations || "") : "Sin bitácora."}</p></article>
      </div>
    </section>
  `;
}

function renderLibraryModule() {
  const student = state.bundle?.student || {};
  // Recursos del instrumento del estudiante + (en Música) teoría musical.
  const forStudent = resourcesForStudent(state.library, student);
  const areas = unique(forStudent.map((r) => r.area));      // p. ej. Guitarra, Teoría musical
  const types = unique(forStudent.map((r) => r.category));  // tipo de recurso
  const q = state.libraryFilter.q;
  const area = state.libraryFilter.category;                // reusa el slot "category" para el área
  const type = state.libraryFilter.level;                   // reusa el slot "level" para el tipo
  const filtered = forStudent.filter((r) => {
    const hay = [r.name, r.area, r.category, r.topic, r.tags?.join(" ")].join(" ");
    return (!q || normalizeText(hay).includes(normalizeText(q)))
      && (!area || r.area === area)
      && (!type || r.category === type);
  });
  const instrumentLabel = escapeHtml(student.instrument || student.art || "tu proceso");
  return `
    <section class="card module wide library-module">
      <div class="section-header"><h3>Biblioteca de recursos</h3><span class="badge">${filtered.length}/${forStudent.length}</span></div>
      <p class="helper">Recursos de <b>${instrumentLabel}</b>${forStudent.some((r) => r.areaKey === "teoria musical") ? " y <b>teoría musical</b>" : ""}.</p>
      <div class="library-filters">
        <input id="librarySearch" placeholder="Buscar recurso" value="${escapeHtml(q)}" data-action="library-filter" data-field="q" />
        <select data-action="library-filter" data-field="category"><option value="">Todas las áreas</option>${optionList(areas, area)}</select>
        <select data-action="library-filter" data-field="level"><option value="">Todos los tipos</option>${optionList(types, type)}</select>
      </div>
      <div class="library-grid">
        ${filtered.slice(0, 60).map((r) => `
          <article class="resource-card">
            <small>${escapeHtml(r.area)}${r.topic ? ` · ${escapeHtml(r.topic)}` : ""}</small>
            <strong>${escapeHtml(r.name)}</strong>
            <p>${escapeHtml(r.notes || "Recurso Musicala")}</p>
            ${r.link ? `<button class="btn tiny" data-action="preview-resource" data-link="${escapeHtml(r.link)}">Abrir dentro</button>` : `<span class="badge warn">Sin enlace</span>`}
          </article>
        `).join("") || `<p class="empty">Aún no hay recursos para ${instrumentLabel} en la biblioteca.</p>`}
      </div>
      <div id="libraryFrameHost" class="library-frame-host"></div>
    </section>
  `;
}

function renderRolesManager() {
  const teachers = state.users.filter((user) => (user.role || "") === "docente" || user.isMusiGymTeacher === true);
  return `
    <section class="card">
      <div class="section-header"><h2>Docentes MusiGym</h2><span class="badge">${teachers.length} docente(s)</span></div>
      <p class="helper">Agrega aqui los docentes autorizados para ingresar y atender estudiantes en MusiGym.</p>
      <form class="form-grid" data-form="teacher-access">
        <label>Nombre <input name="name" placeholder="Nombre del docente" required /></label>
        <label>Correo <input type="email" name="email" placeholder="docente@correo.com" required /></label>
        <button class="btn primary" type="submit">Guardar docente</button>
      </form>
      <div class="user-list">
        ${teachers.map((u) => `<div><strong>${escapeHtml(u.name || u.email)}</strong><span>Docente MusiGym</span><small>${escapeHtml(u.email || "")}</small></div>`).join("") || `<p class="empty">Aun no hay docentes MusiGym registrados.</p>`}
      </div>
    </section>
  `;
}

async function refreshSelected() {
  await loadBaseData();
  await openStudent(state.selectedStudentId, false);
  render();
}


function scrollCoachThread() {
  setTimeout(() => {
    const t = document.getElementById("coachThread");
    if (t) t.scrollTop = t.scrollHeight;
  }, 40);
}

async function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const type = form.dataset.form;
  const data = getFormData(form);
  const student = state.bundle?.student;

  try {
    if (type === "add-timer") {
      addFollowUpTimer(data.studentName, data.minutes);
      setMessage(`Temporizador para ${safeText(data.studentName) || "estudiante"} iniciado.`);
      render();
      return;
    }

    if (type === "template-create") {
      const instrument = data.instrument || "default";
      const isDefault = instrument === "default";
      const key = isDefault ? "default" : templateKeyForInstrument(instrument);
      const existing = (state.routineTemplates || []).find((t) => t.id === key);
      const seed = existing || defaultRoutineTemplate(isDefault ? "" : instrument);
      state.editingTemplateKey = key;
      state.templateDraft = {
        instrument: isDefault ? "default" : instrument,
        title: seed.title || "",
        blocks: (seed.blocks || []).map((b) => ({ ...b })),
      };
      render();
      return;
    }

    if (type === "template-edit") {
      captureTemplateDraft();
      const draft = state.templateDraft;
      const blocks = (draft.blocks || []).filter((b) => (b.name || "").trim());
      if (!blocks.length) throw new Error("La plantilla necesita al menos un bloque con nombre.");
      await saveRoutineTemplate(state.editingTemplateKey, { instrument: draft.instrument, title: draft.title, blocks });
      state.routineTemplates = await listRoutineTemplates().catch(() => []);
      state.editingTemplateKey = "";
      state.templateDraft = null;
      setMessage("Plantilla guardada. Las próximas rutinas de ese instrumento la usarán.");
      render();
      return;
    }

    if (type === "routine-edit") {
      captureRoutineDraft();
      const blocks = (state.routineDraft || []).filter((b) => (b.name || "").trim());
      if (!blocks.length) throw new Error("La rutina necesita al menos un bloque con nombre.");
      const title = data.title || state.bundle.activeRoutine?.title || "Rutina";
      await updateRoutine(state.editingRoutineId, { title, blocks });
      state.editingRoutineId = "";
      state.routineDraft = null;
      setMessage("Rutina actualizada.");
      await openStudent(state.bundle.student.id);
      return;
    }

    if (type === "student-config") {
      const newOverride = safeText(data.emailOverride).toLowerCase();
      await updateStudent(data.studentId, {
        isMusiGym: data.isMusiGym === "true",
        art: data.art,
        instrument: data.instrument,
        emphasis: data.emphasis,
        level: data.level,
        emailOverride: newOverride,
      });
      // Re-estampa el correo de acceso en todo el proceso del estudiante para
      // que pueda leer su historial (rutinas, bitácoras, ruta, etc.) sin get().
      // Cubre backfill de datos antiguos y cambios de correo de acceso.
      const accessEmail = newOverride || safeText(student.email).toLowerCase();
      try {
        const { total, updated } = await restampStudentAccessEmail(data.studentId, accessEmail);
        setMessage(`Configuración guardada. Proceso del estudiante: ${total} registro(s), ${updated} actualizado(s) al correo de acceso.`);
      } catch (err) {
        console.warn("No se pudo re-estampar el acceso del estudiante", err);
        setMessage("Configuración guardada, pero no se pudo sincronizar el acceso al historial. Revisa las reglas.");
      }
      await refreshSelected();
    }

    if (type === "teacher-access") {
      if (!data.name) throw new Error("Escribe el nombre del docente.");
      if (!data.email || !data.email.includes("@")) throw new Error("Escribe un correo válido para el docente.");
      await saveUserRole(data.email.toLowerCase(), {
        name: data.name,
        email: data.email.toLowerCase(),
        role: "docente",
        active: true,
        isMusiGymTeacher: true,
      });
      setMessage("Docente MusiGym guardado.");
      state.users = await listUsers();
      form.reset();
      render();
    }

    if (type === "objective") {
      await createObjective({ ...data, studentId: student.id, studentEmail: studentAccessEmail(student), art: student.art, instrument: student.instrument, createdBy: state.profile.email });
      state.objectiveFormOpen = false;
      setMessage("Objetivo creado.");
      await openStudent(student.id);
    }

    if (type === "diagnostic") {
      await saveDiagnostic({ ...data, studentId: student.id, studentEmail: studentAccessEmail(student), evaluatorEmail: state.profile.email, art: student.art, instrument: student.instrument });
      state.diagnosticFormOpen = false;
      setMessage("Diagnóstico guardado.");
      await openStudent(student.id);
    }

    if (type === "session") {
      const selectedObjectives = [...form.querySelector('select[name="objectivesWorked"]').selectedOptions].map((o) => o.value);
      const routeSelect = form.querySelector('select[name="routeItemsWorked"]');
      const selectedRouteItems = routeSelect ? [...routeSelect.selectedOptions].map((o) => o.value) : [];
      await saveSession({ ...data, studentId: student.id, studentEmail: studentAccessEmail(student), teacherEmail: state.profile.email, objectivesWorked: selectedObjectives, routeItemsWorked: selectedRouteItems, instrument: student.instrument });
      state.sessionFormOpen = false;
      setMessage("Bitácora guardada.");
      await openStudent(student.id);
    }

    if (type === "self-evaluation") {
      await saveSelfEvaluation({ ...data, studentId: student.id, studentEmail: studentAccessEmail(student) });
      setMessage("Autoevaluación guardada.");
      await openStudent(student.id);
    }

    if (type === "song") {
      await saveSongRequest({ ...data, studentId: student.id, studentEmail: studentAccessEmail(student) });
      state.songFormOpen = false;
      setMessage("Canción agregada.");
      await openStudent(student.id);
    }

    if (type === "next-question") {
      const current = state.bundle.nextQuestions?.questions || [];
      await saveNextQuestions(student.id, [...current, { text: data.text, status: "pending" }]);
      setMessage("Pregunta guardada para la proxima sesion.");
      await openStudent(student.id);
    }


    if (type === "coach-chat") {
      if (!data.message) throw new Error("Escribe algo para MusiCoach.");
      await runCoachInteraction({ text: data.message });
      form.reset();
      render();
      scrollCoachThread();
    }
  } catch (error) {
    console.error(error);
    setMessage(error.message || "No se pudo guardar. Revisa la conexion e intenta nuevamente.");
  }
}

async function handleClick(event) {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;

  try {
    if (action === "login") await loginWithGoogle();
    if (action === "logout") await logout();
    if (action === "enable-audio") enableAudio();

    if (action === "sync-students") {
      setMessage("Sincronizando estudiantes...");
      await syncStudentsFromScript();
      await loadBaseData();
      setMessage("Estudiantes sincronizados desde Sheets.");
      render();
    }

    if (action === "enter-student-preview") {
      if (!state.selectedStudentId) {
        setMessage("Selecciona primero un estudiante activo.");
        return;
      }
      state.currentViewMode = "studentPreview";
      render();
    }

    if (action === "exit-student-preview") {
      state.currentViewMode = "admin";
      render();
    }

    if (action === "select-student") await openStudent(btn.dataset.id);

    if (action === "toggle-all-students") {
      state.showAllStudents = !state.showAllStudents;
      render();
    }

    if (action === "toggle-objective-form") {
      state.objectiveFormOpen = !state.objectiveFormOpen;
      render();
    }

    if (action === "edit-objective") {
      state.editingObjectiveId = btn.dataset.id;
      render();
    }

    if (action === "cancel-edit-objective") {
      state.editingObjectiveId = "";
      render();
    }

    if (action === "save-objective") {
      const card = btn.closest("[data-objective-id]");
      await updateObjective(btn.dataset.id, {
        title: card.querySelector('[name="title"]')?.value || "",
        description: card.querySelector('[name="description"]')?.value || "",
        component: card.querySelector('[name="component"]')?.value || "",
        status: card.querySelector('[name="status"]')?.value || "active",
        priority: card.querySelector('[name="priority"]')?.value || "media",
      });
      state.editingObjectiveId = "";
      setMessage("Objetivo guardado.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "delete-objective") {
      if (!confirm("¿Quitar este objetivo?")) return;
      await deleteObjective(btn.dataset.id);
      state.editingObjectiveId = "";
      setMessage("Objetivo quitado.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "toggle-song-form") {
      state.songFormOpen = !state.songFormOpen;
      render();
    }

    if (action === "edit-song") {
      state.editingSongId = btn.dataset.id;
      render();
    }

    if (action === "cancel-edit-song") {
      state.editingSongId = "";
      render();
    }

    if (action === "save-song") {
      const card = btn.closest("[data-song-id]");
      await updateSongRequest(btn.dataset.id, {
        songName: card.querySelector('[name="songName"]')?.value || "",
        artist: card.querySelector('[name="artist"]')?.value || "",
        reason: card.querySelector('[name="reason"]')?.value || "",
        status: card.querySelector('[name="status"]')?.value || "requested",
      });
      state.editingSongId = "";
      setMessage("Canción guardada.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "delete-song") {
      if (!confirm("¿Quitar esta canción?")) return;
      await deleteSongRequest(btn.dataset.id);
      state.editingSongId = "";
      setMessage("Canción quitada.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "toggle-session-form") {
      state.sessionFormOpen = !state.sessionFormOpen;
      render();
    }

    if (action === "edit-session") {
      state.editingSessionId = btn.dataset.id;
      render();
    }

    if (action === "cancel-edit-session") {
      state.editingSessionId = "";
      render();
    }

    if (action === "save-session-edit") {
      const card = btn.closest("[data-session-id]");
      await updateSession(btn.dataset.id, {
        date: card.querySelector('[name="date"]')?.value || "",
        type: card.querySelector('[name="type"]')?.value || "",
        progressScore: card.querySelector('[name="progressScore"]')?.value || 0,
        summary: card.querySelector('[name="summary"]')?.value || "",
        practiceRecommendations: card.querySelector('[name="practiceRecommendations"]')?.value || "",
        nextPractice: card.querySelector('[name="nextPractice"]')?.value || "",
        teacherNotes: card.querySelector('[name="teacherNotes"]')?.value || "",
      });
      state.editingSessionId = "";
      setMessage("Bitácora actualizada.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "delete-session") {
      if (!confirm("¿Eliminar esta bitácora? No se puede deshacer.")) return;
      await deleteSession(btn.dataset.id);
      state.editingSessionId = "";
      setMessage("Bitácora eliminada.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "select-evaluation-session") {
      state.selectedEvaluationSessionId = btn.dataset.id;
      render();
    }

    if (action === "save-question-edit") {
      const questions = state.bundle.nextQuestions?.questions || [];
      const textarea = appRoot.querySelector(`textarea[data-action="question-edit"][data-id="${CSS.escape(btn.dataset.id)}"]`);
      await saveNextQuestions(state.bundle.student.id, questions.map((q) => q.id === btn.dataset.id ? { ...q, text: textarea?.value || q.text } : q));
      setMessage("Pregunta actualizada.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "delete-question") {
      const questions = (state.bundle.nextQuestions?.questions || []).filter((q) => q.id !== btn.dataset.id);
      await saveNextQuestions(state.bundle.student.id, questions);
      setMessage("Pregunta eliminada.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "answer-question" || action === "archive-question") {
      await updateNextQuestionStatus(state.bundle.student.id, btn.dataset.id, action === "answer-question" ? "answered" : "archived");
      setMessage(action === "answer-question" ? "Pregunta marcada como respondida." : "Pregunta archivada.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "generate-routine") {
      const b = state.bundle;
      // Buscar plantilla editable: por instrumento, luego "default".
      const templates = state.routineTemplates || (await listRoutineTemplates().catch(() => []));
      const keyForInstrument = templateKeyForInstrument(b.student.instrument);
      const template = templates.find((t) => t.id === keyForInstrument) || templates.find((t) => t.id === "default");
      const routine = template
        ? buildRoutineFromTemplate(b.student, template, b.objectives, b.progress, b.songs)
        : generateRoutine(b.student, b.objectives, b.progress, b.songs);
      await saveGeneratedRoutine(b.student, routine, state.profile.email);
      setMessage(template ? "Rutina creada desde plantilla." : "Rutina automática creada.");
      await openStudent(b.student.id);
    }

    if (action === "set-routine") {
      await setRoutineActive(state.bundle.student.id, btn.dataset.id);
      setMessage("Rutina activa actualizada.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "timer-reset") {
      resetFollowUpTimer(btn.dataset.id);
      render();
      return;
    }

    if (action === "timer-remove") {
      removeFollowUpTimer(btn.dataset.id);
      render();
      return;
    }

    if (action === "enter-teacher-view") {
      state.currentViewMode = "teacher";
      render();
      return;
    }

    if (action === "exit-teacher-view") {
      state.currentViewMode = "admin";
      render();
      return;
    }

    if (action === "enter-config-view") {
      state.currentViewMode = "config";
      render();
      return;
    }

    if (action === "exit-config-view") {
      state.currentViewMode = "admin";
      render();
      return;
    }

    if (action === "scroll-to-sessions") {
      document.getElementById("sessionsModule")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (action === "template-edit-start") {
      const existing = (state.routineTemplates || []).find((t) => t.id === btn.dataset.key);
      if (!existing) return;
      state.editingTemplateKey = existing.id;
      state.templateDraft = {
        instrument: existing.instrument || "default",
        title: existing.title || "",
        blocks: (existing.blocks || []).map((b) => ({ ...b })),
      };
      render();
      return;
    }

    if (action === "template-cancel-edit") {
      state.editingTemplateKey = "";
      state.templateDraft = null;
      render();
      return;
    }

    if (action === "template-add-block") {
      captureTemplateDraft();
      state.templateDraft.blocks = [
        ...(state.templateDraft.blocks || []),
        { name: "Nuevo bloque", component: "Práctica", minutes: 5, instructions: "" },
      ];
      render();
      return;
    }

    if (action === "template-remove-block") {
      captureTemplateDraft();
      const idx = Number(btn.dataset.index);
      state.templateDraft.blocks = (state.templateDraft.blocks || []).filter((_, i) => i !== idx);
      render();
      return;
    }

    if (action === "template-delete") {
      await deleteRoutineTemplate(btn.dataset.key);
      state.routineTemplates = await listRoutineTemplates().catch(() => []);
      setMessage("Plantilla eliminada.");
      render();
      return;
    }

    if (action === "routine-edit-start") {
      const routine = state.bundle.activeRoutine;
      if (!routine) return;
      state.editingRoutineId = routine.id;
      state.routineDraft = (routine.blocks || []).map((b) => ({ ...b }));
      render();
      return;
    }

    if (action === "routine-cancel-edit") {
      state.editingRoutineId = "";
      state.routineDraft = null;
      render();
      return;
    }

    if (action === "routine-add-block") {
      captureRoutineDraft();
      state.routineDraft = [
        ...(state.routineDraft || []),
        { id: uid("block"), minutes: 5, name: "Nuevo bloque", component: "Práctica", instructions: "" },
      ];
      render();
      return;
    }

    if (action === "routine-remove-block") {
      captureRoutineDraft();
      const idx = Number(btn.dataset.index);
      state.routineDraft = (state.routineDraft || []).filter((_, i) => i !== idx);
      render();
      return;
    }

    if (action === "switch-tab") {
      state.activeTab = btn.dataset.tab || "hoy";
      render();
      return;
    }

    if (action === "toggle-diagnostic-form") {
      state.diagnosticFormOpen = !state.diagnosticFormOpen;
      render();
      return;
    }

    if (action === "toggle-coach") {
      state.coachOpen = !state.coachOpen;
      render();
      if (state.coachOpen) scrollCoachThread();
      return;
    }

        if (action === "coach-intent") {
      await runCoachInteraction({ intent: btn.dataset.intent || "practice" });
      render();
      scrollCoachThread();
    }

    if (action === "coach-create-routine") {
      const b = state.bundle;
      const routine = generateRoutine(b.student, b.objectives, b.progress, b.songs);
      await saveGeneratedRoutine(b.student, routine, state.profile.email);
      await runCoachInteraction({ intent: "practice", text: "Crea una rutina con mi foco de hoy" });
      setMessage("Rutina creada desde MusiCoach.");
      await openStudent(b.student.id);
    }

    if (action === "coach-save-last-question") {
      const b = state.bundle;
      const messages = getCoachMessages(b.student.id);
      const lastStudentMessage = [...messages].reverse().find((message) => message.role === "student")?.text || "Quiero revisar mi práctica de hoy con el profe.";
      const current = b.nextQuestions?.questions || [];
      await saveNextQuestions(b.student.id, [...current, { text: lastStudentMessage, status: "pending" }]);
      setMessage("Última duda guardada para la próxima sesión.");
      await openStudent(b.student.id);
    }

    if (action === "call-teacher") {
      const message = prompt("¿Qué necesitas preguntarle al profe?") || "Necesito asesoría del profe.";
      await requestTeacherHelp(state.bundle.student, message);
      setMessage("Listo. Llamado enviado al profe.");
    }

    if (action === "resolve-call") {
      await resolveTeacherCall(btn.dataset.id, state.profile.email);
      setMessage("Llamado marcado como atendido.");
    }

    if (action === "advance-song") {
      const order = ["requested", "approved", "in_progress", "learned"];
      const current = btn.dataset.status || "requested";
      const next = order[Math.min(order.indexOf(current) + 1, order.length - 1)] || "approved";
      await updateSongRequest(btn.dataset.id, { status: next });
      setMessage("Estado de canción actualizado.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "generate-report") {
      const key = document.getElementById("reportMonth")?.value || monthKey();
      await generateMonthlyReport(state.bundle.student, key);
      setMessage("Informe mensual generado.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "preview-resource") {
      const host = document.getElementById("libraryFrameHost");
      if (host) {
        host.innerHTML = `
          <div class="frame-toolbar"><strong>Recurso seleccionado</strong><a class="btn tiny" href="${escapeHtml(btn.dataset.link)}" target="_blank" rel="noopener">Abrir en otra pestaña</a></div>
          <iframe src="${escapeHtml(btn.dataset.link)}" title="Recurso de biblioteca"></iframe>
        `;
        host.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  } catch (error) {
    console.error(error);
    setMessage(error.message || "Algo falló. La tecnología, siendo tecnología.");
  }
}

async function handleChange(event) {
  const el = event.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  if (action === "route-status") {
    const item = getRouteForInstrument(state.bundle.student.instrument).find((routeItem) => routeItem.id === el.dataset.id);
    if (!item) return;
    await setRouteItemProgress(state.bundle.student.id, item, el.value, "", studentAccessEmail(state.bundle.student));
    setMessage("Ruta actualizada.");
    await openStudent(state.bundle.student.id);
  }

  if (action === "library-filter") {
    state.libraryFilter[el.dataset.field] = el.value;
    render();
  }
}

function handleInput(event) {
  const el = event.target.closest("[data-action]");
  if (!el) return;

  if (el.dataset.action === "library-filter") {
    state.libraryFilter[el.dataset.field] = el.value;
    render();
    if (el.dataset.field === "q") {
      const input = document.getElementById("librarySearch");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }

  if (el.dataset.action === "student-search") {
    state.studentSearch = el.value;
    render();
    const input = document.getElementById("studentSearch");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

appRoot.addEventListener("click", handleClick);
appRoot.addEventListener("submit", handleSubmit);
appRoot.addEventListener("change", handleChange);
appRoot.addEventListener("input", handleInput);

loadFollowUpTimers();
if (state.followUpTimers.length) ensureTimerInterval();

observeAuth(async (firebaseUser) => {
  state.booting = true;
  render();
  state.user = firebaseUser;

  if (!firebaseUser) {
    state.profile = null;
    state.students = [];
    state.bundle = null;
    state.booting = false;
    if (state.unsubscribeCalls) state.unsubscribeCalls();
    render();
    return;
  }

  try {
    state.profile = await getUserProfile(firebaseUser);
    await loadBaseData();
    startTeacherCallListener();
  } catch (error) {
    console.error(error);
    state.profile = null;
    setMessage(error.message || "No se pudo cargar el perfil.");
  } finally {
    state.booting = false;
    render();
  }

  // Sincronizacion automatica en segundo plano (admins, una vez por sesion).
  autoSyncStudents();
});

render();
