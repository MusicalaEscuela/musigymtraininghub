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
  ensureAdminPreviewStudent,
  findStudentByEmail,
  getStudent,
  listByStudent,
  createObjective,
  saveDiagnostic,
  saveSession,
  saveSelfEvaluation,
  getNextQuestions,
  getPendingQuestions,
  saveNextQuestions,
  updateNextQuestionStatus,
  getRouteProgressByComponent,
  saveSongRequest,
  updateSongRequest,
  getRouteForInstrument,
  listRouteProgress,
  setRouteItemProgress,
  generateRoutine,
  saveGeneratedRoutine,
  setRoutineActive,
  loadGuitarLibrary,
  observeTeacherCalls,
  requestTeacherHelp,
  resolveTeacherCall,
  buildCoachSuggestion,
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
  currentViewMode: "admin",
  previewStudentId: "",
  selectedEvaluationSessionId: "",
  bundle: null,
  library: [],
  libraryFilter: { q: "", category: "", level: "" },
  teacherCalls: [],
  message: "",
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
    state.library.length ? Promise.resolve(state.library) : loadGuitarLibrary().catch(() => []),
  ]);
  state.students = students;
  state.users = users;
  state.library = library;

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
    state.selectedStudentId = students[0].id;
  }

  if (state.selectedStudentId) await openStudent(state.selectedStudentId, false);
}

async function openStudent(studentId, shouldRender = true) {
  state.selectedStudentId = studentId;
  state.bundle = null;
  if (shouldRender) render();

  const student = await getStudent(studentId);
  if (!student) return;
  const [objectives, routines, sessions, diagnostics, evaluations, songs, progress, reports] = await Promise.all([
    listByStudent(C.objectives, studentId).catch(() => []),
    listByStudent(C.routines, studentId).catch(() => []),
    listByStudent(C.sessions, studentId, "date", "desc").catch(() => []),
    listByStudent(C.diagnostics, studentId).catch(() => []),
    listByStudent(C.selfEvaluations, studentId).catch(() => []),
    listByStudent(C.songRequests, studentId).catch(() => []),
    listRouteProgress(studentId).catch(() => []),
    listByStudent(C.monthlyReports, studentId, "generatedAt", "desc").catch(() => []),
  ]);
  const nextQuestions = await getNextQuestions(studentId).catch(() => ({ studentId, questions: [] }));

  const activeRoutine = routines.find((r) => r.active) || routines[0] || null;
  state.bundle = { student, objectives, routines, activeRoutine, sessions, diagnostics, evaluations, songs, progress, reports, nextQuestions };
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
  setMessage("Alarma activada. Ya puede sonar cuando un estudiante pida ayuda. Los navegadores son una belleza bloqueando sonidos útiles, por eso tocaba este botón.");
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

  if (state.profile.isAdmin && state.currentViewMode === "studentPreview") return renderStudentPreview();
  if (state.profile.isAdmin) return renderAdmin();
  if (state.profile.isTeacher) return renderTeacher();
  return renderStudent();
}

function renderLoading(text) {
  return `<section class="center-card"><div class="spinner"></div><h2>${escapeHtml(text)}</h2><p>La humanidad sigue dependiendo de ruedas girando para sentir progreso.</p></section>`;
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
        ${["Rutinas automáticas", "Bot de práctica", "Llamado al profe", "Informes mensuales", "Biblioteca de practica", "Proceso del estudiante"].map((x) => `<div class="mini-feature">${escapeHtml(x)}</div>`).join("")}
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
        ${renderAdminStudentPreviewControls()}
        <button class="btn secondary full" data-action="enable-audio">${state.audioReady ? "Alarma activa" : "Activar alarma de llamados"}</button>
        ${renderMetrics()}
        ${renderCallsBox()}
      </aside>
      <section class="workspace">
        ${renderStudentList(true)}
        ${renderSelectedStudentWorkspace("admin")}
        ${renderRolesManager()}
      </section>
    </section>
  `;
}

function renderAdminStudentPreviewControls() {
  const options = state.students
    .filter((student) => student.isMusiGym)
    .map((student) => `<option value="${escapeHtml(student.id)}" ${state.previewStudentId === student.id ? "selected" : ""}>${escapeHtml(student.name)}</option>`)
    .join("");
  return `
    <div class="preview-switcher">
      <label>Previsualizar estudiante
        <select data-action="preview-student-select">
          <option value="">Usar perfil espejo Admin</option>
          ${options}
        </select>
      </label>
      <button class="btn secondary full" data-action="enter-student-preview">Ver como estudiante</button>
    </div>
  `;
}

function renderStudentPreview() {
  return `
    <section class="student-home">
      <div class="preview-banner">
        <strong>Vista estudiante - modo admin</strong>
        <button class="btn ghost" data-action="exit-student-preview">Volver a Admin</button>
      </div>
      ${renderSelectedStudentWorkspace("estudiante")}
    </section>
  `;
}

function renderTeacher() {
  return `
    <section class="dashboard-grid">
      <aside class="side-panel">
        <div class="panel-title">
          <h2>Docente</h2>
          <p>Sesiones, apoyo, bitácoras y seguimiento.</p>
        </div>
        <button class="btn secondary full" data-action="enable-audio">${state.audioReady ? "Alarma activa" : "Activar alarma de llamados"}</button>
        ${renderMetrics()}
        ${renderCallsBox()}
      </aside>
      <section class="workspace">
        ${renderStudentList(false)}
        ${renderSelectedStudentWorkspace("docente")}
      </section>
    </section>
  `;
}

function renderStudent() {
  if (!state.selectedStudentId) {
    return `
      <section class="center-card">
        <h2>Aún no encontramos tu perfil MusiGym</h2>
        <p>Revisa que el correo de ingreso sea el mismo que aparece en tu ficha y que tu estado MusiGym este activo.</p>
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
      `).join("") : `<p class="empty">Sin llamados pendientes. Sospechoso, pero agradable.</p>`}
    </div>
  `;
}

function renderStudentList(showAllControls) {
  const q = state.studentSearch || "";
  const filtered = state.students.filter((student) => {
    if (!q.trim()) return true;
    const hay = [student.name, student.email, student.instrument, student.art, student.emphasis].join(" ");
    return normalizeText(hay).includes(normalizeText(q));
  });
  return `
    <section class="card">
      <div class="section-header">
        <div>
          <p class="eyebrow">Estudiantes</p>
          <h2>${showAllControls ? "Gestión MusiGym" : "Tus estudiantes activos"}</h2>
        </div>
        <input id="studentSearch" class="search" placeholder="Buscar estudiante..." value="${escapeHtml(q)}" data-action="student-search" />
      </div>
      <div class="student-grid">
        ${filtered.map((student) => `
          <button class="student-card ${state.selectedStudentId === student.id ? "active" : ""}" data-action="select-student" data-id="${escapeHtml(student.id)}">
            <strong>${escapeHtml(student.name)}</strong>
            <span>${escapeHtml(student.instrument || student.art || "Sin arte")}</span>
            <small>${student.isMusiGym ? "Activo MusiGym" : "No activo"}</small>
          </button>
        `).join("") || `<p class="empty">No hay estudiantes para mostrar.</p>`}
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
            <span>Correo: ${escapeHtml(student.email || student.correo || "Sin correo")}</span>
          </div>
        </div>
        <div class="banner-actions">
          ${mode !== "estudiante" ? `<button class="btn secondary" data-action="generate-routine">${escapeHtml(roleCopy.routineButton)}</button>` : ""}
          ${mode === "estudiante" ? `<button class="btn primary" data-action="call-teacher">Llamar al profe</button>` : ""}
          ${mode === "estudiante" ? `<button class="btn ghost" data-action="coach-suggestion">Que practico hoy</button>` : ""}
        </div>
      </div>
      ${mode === "admin" ? renderStudentConfig(student) : ""}
      ${roleCopy.showCoach ? renderCoachBox() : ""}
      <div class="module-grid">
        ${renderRoutineModule(mode)}
        ${renderRouteModule(mode)}
        ${renderObjectivesModule(mode)}
        ${renderSongsModule(mode)}
        ${renderNextQuestionsModule(mode)}
        ${renderSessionsModule(mode)}
        ${renderDiagnosticsModule(mode)}
        ${renderSelfEvaluationModule(mode)}
        ${mode !== "estudiante" ? renderPrepareNextSessionModule(mode) : ""}
        ${renderMonthlyReportModule(mode)}
        ${renderLibraryModule(mode)}
      </div>
    </section>
  `;
}

function renderStudentConfig(student) {
  const teacherUsers = state.users.filter((user) => (user.role || "") === "docente" || user.isMusiGymTeacher === true);
  const teacherOptions = teacherUsers
    .map((teacher) => `<option value="${escapeHtml(teacher.email || teacher.id)}" ${safeText(student.teacherEmail).toLowerCase() === safeText(teacher.email || teacher.id).toLowerCase() ? "selected" : ""}>${escapeHtml(teacher.name || teacher.email)}</option>`)
    .join("");
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
        <label>Docente asignado
          <select name="teacherEmail">
            <option value="">Sin docente asignado</option>
            ${teacherOptions}
          </select>
          <small class="field-help">Elige un docente registrado en Docentes MusiGym.</small>
        </label>
        <button class="btn primary" type="submit">Guardar configuracion</button>
      </form>
    </section>
  `;
}

function renderCoachBox() {
  const b = state.bundle;
  const suggestion = b?.coachSuggestion || "Pide una recomendacion para organizar tu practica de hoy con tus objetivos, rutina, canciones y avances.";
  return `
    <section class="coach-box">
      <div class="musi-orb">M</div>
      <div>
        <p class="eyebrow">MusiCoach</p>
        <p>${escapeHtml(suggestion)}</p>
      </div>
    </section>
  `;
}

function renderRoutineModule(mode) {
  const { routines, activeRoutine } = state.bundle;
  return `
    <section class="card module wide">
      <div class="section-header"><h3>Rutina activa</h3><span class="badge">${routines.length} rutina(s)</span></div>
      ${activeRoutine ? `
        <h4>${escapeHtml(activeRoutine.title)}</h4>
        <div class="routine-blocks">
          ${(activeRoutine.blocks || []).map((block) => `
            <article class="routine-block">
              <strong>${escapeHtml(block.minutes || 5)} min · ${escapeHtml(block.name)}</strong>
              <span>${escapeHtml(block.component || "Práctica")}</span>
              <p>${escapeHtml(block.instructions || "")}</p>
            </article>
          `).join("")}
        </div>
      ` : `<p class="empty">Aún no hay rutina. Crear una a mano da pereza; por eso hay botón automático.</p>`}
      ${mode !== "estudiante" && routines.length ? `
        <div class="chips">${routines.map((r) => `<button class="chip" data-action="set-routine" data-id="${escapeHtml(r.id)}">${escapeHtml(r.title)}</button>`).join("")}</div>
      ` : ""}
    </section>
  `;
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

function renderObjectivesModule(mode) {
  const { objectives } = state.bundle;
  return `
    <section class="card module">
      <div class="section-header"><h3>Objetivos</h3><span class="badge">${objectives.length}</span></div>
      <div class="stack-list">
        ${objectives.map((o) => `<article class="list-item"><strong>${escapeHtml(o.title)}</strong><p>${escapeHtml(o.description || "")}</p><small>${escapeHtml(o.status || "active")} · ${escapeHtml(o.priority || "media")}</small></article>`).join("") || `<p class="empty">Sin objetivos todavía.</p>`}
      </div>
      ${mode !== "estudiante" ? `
        <form class="mini-form" data-form="objective">
          <input name="title" placeholder="Nuevo objetivo" required />
          <textarea name="description" placeholder="Descripción breve"></textarea>
          <select name="component"><option>Técnica</option><option>Teoría</option><option>Repertorio</option><option>Creatividad</option><option>Hábitos</option></select>
          <button class="btn primary" type="submit">Agregar objetivo</button>
        </form>
      ` : ""}
    </section>
  `;
}

function renderSongsModule(mode) {
  const { songs } = state.bundle;
  return `
    <section class="card module">
      <div class="section-header"><h3>Canciones deseadas</h3><span class="badge">${songs.length}</span></div>
      <div class="stack-list">
        ${songs.map((s) => `
          <article class="list-item">
            <strong>${escapeHtml(s.songName)}</strong>
            <p>${escapeHtml(s.artist || "Artista no registrado")} · ${escapeHtml(s.reason || "")}</p>
            <small>${escapeHtml(s.status || "requested")}</small>
            ${mode !== "estudiante" ? `<button class="btn tiny" data-action="advance-song" data-id="${escapeHtml(s.id)}" data-status="${escapeHtml(s.status || "requested")}">Avanzar estado</button>` : ""}
          </article>
        `).join("") || `<p class="empty">Todavía no hay canciones soñadas. Grave, pero corregible.</p>`}
      </div>
      <form class="mini-form" data-form="song">
        <input name="songName" placeholder="Canción" required />
        <input name="artist" placeholder="Artista" />
        <textarea name="reason" placeholder="¿Por qué quieres aprenderla?"></textarea>
        <button class="btn primary" type="submit">Agregar canción</button>
      </form>
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
        `).join("") || `<p class="empty">Sin preguntas pendientes.</p>`}
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

function renderSessionsModule(mode) {
  const { sessions, objectives } = state.bundle;
  const route = getRouteForInstrument(state.bundle.student.instrument);
  return `
    <section class="card module wide">
      <div class="section-header"><h3>Bitacoras de sesiones</h3><span class="badge">${sessions.length}</span></div>
      <div class="timeline">
        ${sessions.slice(0, 8).map((s) => {
          const hasEvaluation = state.bundle.evaluations.some((e) => e.sessionId === s.id);
          return `<article class="timeline-item"><small>${formatDate(s.date)} - ${escapeHtml(s.type || "Sesion")}</small><strong>${escapeHtml(s.summary || "Sesion registrada")}</strong><p>${escapeHtml(s.nextPractice || s.practiceRecommendations || "")}</p><span class="badge">Avance ${escapeHtml(s.progressScore || 0)}/100</span>${mode === "estudiante" ? `<button class="btn tiny ${hasEvaluation ? "ghost" : ""}" data-action="select-evaluation-session" data-id="${escapeHtml(s.id)}">${hasEvaluation ? "Autoevaluacion enviada" : "Hacer autoevaluacion"}</button>` : ""}</article>`;
        }).join("") || `<p class="empty">Sin sesiones registradas.</p>`}
      </div>
      ${mode !== "estudiante" ? `
        <form class="form-grid" data-form="session">
          <label>Fecha <input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" /></label>
          <label>Tipo <select name="type">${optionList(CATALOGS.sessionTypes, "Practica guiada")}</select></label>
          <label>Avance 0-100 <input type="number" min="0" max="100" name="progressScore" value="50" /></label>
          <label class="span-2">Resumen <textarea name="summary" required placeholder="Que se trabajo, que se observo, que mejoro..."></textarea></label>
          <label class="span-2">Recomendaciones <textarea name="practiceRecommendations" placeholder="Recomendaciones de practica"></textarea></label>
          <label class="span-2">Proxima practica <textarea name="nextPractice" placeholder="Que debe hacer antes de volver"></textarea></label>
          <label class="span-2">Notas internas <textarea name="teacherNotes" placeholder="Observaciones para el equipo"></textarea></label>
          <label class="span-2">Objetivos trabajados <select name="objectivesWorked" multiple>${objectives.map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.title)}</option>`).join("")}</select></label>
          <label class="span-2">Puntos de ruta trabajados <select name="routeItemsWorked" multiple>${route.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.component)} - ${escapeHtml(item.title)}</option>`).join("")}</select></label>
          <button class="btn primary" type="submit">Guardar bitacora</button>
        </form>
      ` : ""}
    </section>
  `;
}

function renderDiagnosticsModule(mode) {
  const { diagnostics } = state.bundle;
  return `
    <section class="card module wide">
      <div class="section-header"><h3>Diagnóstico inicial</h3><span class="badge">${diagnostics.length}</span></div>
      ${diagnostics[0] ? `<article class="diagnostic-summary"><strong>${formatDate(diagnostics[0].date || diagnostics[0].createdAt)}</strong><p><b>Fortalezas:</b> ${escapeHtml(diagnostics[0].strengths || "")}</p><p><b>Retos:</b> ${escapeHtml(diagnostics[0].challenges || "")}</p><p><b>Recomendación:</b> ${escapeHtml(diagnostics[0].recommendation || "")}</p></article>` : `<p class="empty">Primera sesión sin diagnóstico. El caos sonríe.</p>`}
      ${mode !== "estudiante" ? `
        <form class="form-grid" data-form="diagnostic">
          <label>Fecha <input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" /></label>
          <label class="span-2">Fortalezas <textarea name="strengths" placeholder="Qué se ve fuerte desde el inicio"></textarea></label>
          <label class="span-2">Retos <textarea name="challenges" placeholder="Qué necesita trabajar"></textarea></label>
          <label>Intereses <textarea name="interests" placeholder="Gustos, canciones, referentes"></textarea></label>
          <label>Técnica <textarea name="technique" placeholder="Postura, coordinación, control"></textarea></label>
          <label>Teoría <textarea name="theory" placeholder="Lectura, ritmo, conceptos"></textarea></label>
          <label>Repertorio <textarea name="repertoire" placeholder="Canciones o piezas"></textarea></label>
          <label class="span-2">Hábitos y recomendación <textarea name="recommendation" placeholder="Ruta inicial sugerida"></textarea></label>
          <button class="btn primary" type="submit">Guardar diagnóstico</button>
        </form>
      ` : ""}
    </section>
  `;
}

function renderSelfEvaluationModule(mode) {
  const { evaluations, sessions } = state.bundle;
  const selectedSessionId = state.selectedEvaluationSessionId || sessions[0]?.id || "";
  return `
    <section class="card module">
      <div class="section-header"><h3>Autoevaluacion post-sesion</h3><span class="badge">${evaluations.length}</span></div>
      <div class="stack-list">
        ${evaluations.slice(0, 4).map((e) => `<article class="list-item"><strong>${escapeHtml(e.feeling || e.mood || "Sesion")}</strong><p>${escapeHtml(e.whatWentWell || e.learned || "")}</p><small>Sesion ${escapeHtml(e.sessionId || "sin vincular")} - Energia ${escapeHtml(e.energyLevel || e.energy || 3)}/5 - Dificultad ${escapeHtml(e.difficultyLevel || e.difficulty || 3)}/5</small></article>`).join("") || `<p class="empty">Sin autoevaluaciones registradas.</p>`}
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
        ${reports.slice(0, 3).map((r) => `<article class="report-card"><strong>${escapeHtml(r.month)}</strong><pre>${escapeHtml(r.generatedText || "")}</pre></article>`).join("") || `<p class="empty">No hay informes generados.</p>`}
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
  const categories = unique(state.library.map((r) => r.category));
  const levels = unique(state.library.map((r) => r.level));
  const q = state.libraryFilter.q;
  const category = state.libraryFilter.category;
  const level = state.libraryFilter.level;
  const filtered = state.library.filter((r) => {
    const hay = [r.name, r.category, r.level, r.tags?.join(" ")].join(" ");
    return (!q || normalizeText(hay).includes(normalizeText(q))) && (!category || r.category === category) && (!level || r.level === level);
  });
  return `
    <section class="card module wide library-module">
      <div class="section-header"><h3>Biblioteca de guitarra</h3><span class="badge">${filtered.length}/${state.library.length}</span></div>
      <div class="library-filters">
        <input placeholder="Buscar recurso" value="${escapeHtml(q)}" data-action="library-filter" data-field="q" />
        <select data-action="library-filter" data-field="category"><option value="">Todas las categorías</option>${optionList(categories, category)}</select>
        <select data-action="library-filter" data-field="level"><option value="">Todos los niveles</option>${optionList(levels, level)}</select>
      </div>
      <div class="library-grid">
        ${filtered.slice(0, 36).map((r) => `
          <article class="resource-card">
            <small>${escapeHtml(r.category)} · ${escapeHtml(r.level || "Nivel libre")}</small>
            <strong>${escapeHtml(r.name)}</strong>
            <p>${escapeHtml(r.notes || r.author || "Recurso Musicala")}</p>
            ${r.link ? `<button class="btn tiny" data-action="preview-resource" data-link="${escapeHtml(r.link)}">Abrir dentro</button>` : `<span class="badge warn">Sin enlace</span>`}
          </article>
        `).join("") || `<p class="empty">No encontré recursos con esos filtros.</p>`}
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

async function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const type = form.dataset.form;
  const data = getFormData(form);
  const student = state.bundle?.student;

  try {
    if (type === "student-config") {
      await updateStudent(data.studentId, {
        isMusiGym: data.isMusiGym === "true",
        art: data.art,
        instrument: data.instrument,
        emphasis: data.emphasis,
        level: data.level,
        teacherEmail: data.teacherEmail.toLowerCase(),
        teacherName: state.users.find((user) => safeText(user.email).toLowerCase() === data.teacherEmail.toLowerCase())?.name || "",
      });
      setMessage("Configuración guardada.");
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
      await createObjective({ ...data, studentId: student.id, art: student.art, instrument: student.instrument, createdBy: state.profile.email });
      setMessage("Objetivo creado.");
      await openStudent(student.id);
    }

    if (type === "diagnostic") {
      await saveDiagnostic({ ...data, studentId: student.id, evaluatorEmail: state.profile.email, art: student.art, instrument: student.instrument });
      setMessage("Diagnóstico guardado.");
      await openStudent(student.id);
    }

    if (type === "session") {
      const selectedObjectives = [...form.querySelector('select[name="objectivesWorked"]').selectedOptions].map((o) => o.value);
      const routeSelect = form.querySelector('select[name="routeItemsWorked"]');
      const selectedRouteItems = routeSelect ? [...routeSelect.selectedOptions].map((o) => o.value) : [];
      await saveSession({ ...data, studentId: student.id, teacherEmail: state.profile.email, objectivesWorked: selectedObjectives, routeItemsWorked: selectedRouteItems, instrument: student.instrument });
      setMessage("Bitacora de sesion guardada.");
      await openStudent(student.id);
    }

    if (type === "self-evaluation") {
      await saveSelfEvaluation({ ...data, studentId: student.id });
      setMessage("Autoevaluación guardada.");
      await openStudent(student.id);
    }

    if (type === "song") {
      await saveSongRequest({ ...data, studentId: student.id });
      setMessage("Cancion agregada.");
      await openStudent(student.id);
    }

    if (type === "next-question") {
      const current = state.bundle.nextQuestions?.questions || [];
      await saveNextQuestions(student.id, [...current, { text: data.text, status: "pending" }]);
      setMessage("Pregunta guardada para la proxima sesion.");
      await openStudent(student.id);
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
      const id = state.previewStudentId || await ensureAdminPreviewStudent(state.profile);
      state.previewStudentId = id;
      state.currentViewMode = "studentPreview";
      await openStudent(id);
    }

    if (action === "exit-student-preview") {
      state.currentViewMode = "admin";
      await loadBaseData();
      render();
    }

    if (action === "select-student") await openStudent(btn.dataset.id);

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
      const routine = generateRoutine(b.student, b.objectives, b.progress, b.songs);
      await saveGeneratedRoutine(b.student, routine, state.profile.email);
      setMessage("Rutina automática creada.");
      await openStudent(b.student.id);
    }

    if (action === "set-routine") {
      await setRoutineActive(state.bundle.student.id, btn.dataset.id);
      setMessage("Rutina activa actualizada.");
      await openStudent(state.bundle.student.id);
    }

    if (action === "coach-suggestion") {
      const b = state.bundle;
      b.coachSuggestion = buildCoachSuggestion({
        student: b.student,
        objectives: b.objectives,
        routine: b.activeRoutine,
        progress: b.progress,
        songs: b.songs,
        diagnostics: b.diagnostics,
        evaluations: b.evaluations,
      });
      render();
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
          <div class="frame-toolbar"><strong>Recurso seleccionado</strong><a class="btn tiny" href="${escapeHtml(btn.dataset.link)}" target="_blank" rel="noopener">Abrir en otra pesta?a</a></div>
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

  if (action === "preview-student-select") {
    state.previewStudentId = el.value;
    return;
  }

  if (action === "route-status") {
    const item = getRouteForInstrument(state.bundle.student.instrument).find((routeItem) => routeItem.id === el.dataset.id);
    if (!item) return;
    await setRouteItemProgress(state.bundle.student.id, item, el.value);
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
});

render();
