/*******************************************************
 * API Bitacoras Musicala
 * Lectura de estudiantes y procesos
 * Proyecto independiente
 *
 * Este script está pensado para instalarse como proyecto independiente
 * de Apps Script. No debe pegarse encima del Apps Script principal de
 * Bitácoras si ese proyecto ya tiene su propio doGet(e).
 *
 * Su función principal es LEER estudiantes desde Google Sheets y
 * exponerlos como JSON para MusiGym.
 *
 * Garantía no destructiva sobre Google Sheets:
 * - No modifica datos del Google Sheet.
 * - No borra hojas.
 * - No inserta filas.
 * - No elimina filas.
 * - No cambia fórmulas.
 * - No altera el sistema existente de Bitácoras.
 *
 * Las funciones de sincronización a Firestore son OPCIONALES y deben
 * ejecutarse manualmente por un admin/desarrollador que configure las
 * Script Properties de Firebase. No se activan triggers automáticamente.
 *******************************************************/

const CONFIG = {
  SPREADSHEET_ID: "1MsWABlj_LdhWKzVq_u-1M6S5zEJ2yQ72oiusvzzQZAI",

  STUDENTS_SHEET_NAME: "Inscripcion estudiantes",
  STUDENTS_SHEET_CANDIDATES: [
    "Inscripcion estudiantes",
    "Inscripción estudiantes",
    "Estudiantes",
    "students",
  ],

  HEADER_ROW: 1,
  DATA_START_ROW: 2,
  TIMEZONE: "America/Bogota",

  COLS: {
    NOMBRE: 1,
    ESTADO: 2,
    EDAD: 5,
    EMAIL: 8,
    CURSO: 12,
    INSTRUMENTO: 13,
    ESTILO: 14,
    ENFASIS: 15,
    INTERESES: 16,
  },
};

/* =====================================================
 * ENTRYPOINTS
 * ===================================================== */

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || "students").trim().toLowerCase();

    let payload;

    switch (action) {
      case "health":
        payload = {
          ok: true,
          message: "API Bitacoras Musicala activa",
          timestamp: new Date().toISOString(),
          availableActions: ["health", "students", "student", "processes", "teachers"],
          deprecatedActions: ["teachers"],
          timezone: CONFIG.TIMEZONE,
        };
        break;

      case "students":
        payload = handleGetStudents_(params);
        break;

      case "student":
        payload = handleGetStudent_(params);
        break;

      case "processes":
        payload = handleGetProcesses_(params);
        break;

      case "teachers":
        payload = handleGetTeachers_(params);
        break;

      default:
        payload = {
          ok: false,
          error: 'Accion no valida: "' + action + '"',
          availableActions: ["health", "students", "student", "processes", "teachers"],
          deprecatedActions: ["teachers"],
        };
        break;
    }

    return jsonOutput_(payload);
  } catch (error) {
    return jsonOutput_({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}

/* =====================================================
 * ACTION HANDLERS
 * ===================================================== */

function handleGetStudents_(params) {
  const q = normalizeText_(params.q || params.query || params.search || "");
  const estado = normalizeText_(params.estado || "activo");
  const arte = normalizeText_(params.arte || params.area || "");
  const includeInactive = toBoolean_(params.includeInactive, false);

  const rows = getStudentRows_();
  const students = [];

  rows.forEach(function (rowObj) {
    const student = mapRowToStudent_(rowObj);
    if (!student) return;

    if (!includeInactive) {
      if (!isActiveStatus_(student.estado)) return;
    } else if (estado && estado !== "todos" && normalizeText_(student.estado) !== estado) {
      return;
    }

    if (q) {
      const hayMatch =
        normalizeText_(student.nombre).indexOf(q) !== -1 ||
        normalizeText_(student.interesesMusicales).indexOf(q) !== -1 ||
        student.processes.some(function (p) {
          return (
            normalizeText_(p.arte).indexOf(q) !== -1 ||
            normalizeText_(p.detalle).indexOf(q) !== -1 ||
            normalizeText_(p.label).indexOf(q) !== -1
          );
        });

      if (!hayMatch) return;
    }

    if (arte) {
      const filteredProcesses = student.processes.filter(function (p) {
        return normalizeText_(p.arte) === arte;
      });

      if (!filteredProcesses.length) return;
      student.processes = filteredProcesses;
    }

    students.push(student);
  });

  students.sort(function (a, b) {
    return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
  });

  return {
    ok: true,
    total: students.length,
    data: students,
    students: students,
  };
}

function handleGetStudent_(params) {
  const studentKey = String(params.studentKey || params.id || "").trim();
  const email = String(params.email || params.correo || "").trim().toLowerCase();

  if (!studentKey && !email) {
    return {
      ok: false,
      error: "Falta studentKey o email",
    };
  }

  const rows = getStudentRows_();
  const students = rows.map(mapRowToStudent_).filter(Boolean);

  const student = students.find(function (item) {
    if (studentKey && item.studentKey === studentKey) return true;

    if (email) {
      const candidates = [
        item.email,
        item.correo,
        item.correoElectronico,
      ]
        .map(function (value) {
          return String(value || "").trim().toLowerCase();
        })
        .filter(Boolean);

      return candidates.indexOf(email) !== -1;
    }

    return false;
  });

  if (!student) {
    if (email) {
      return {
        ok: true,
        data: null,
        student: null,
        profile: null,
        result: null,
      };
    }

    return {
      ok: false,
      error: "Estudiante no encontrado",
    };
  }

  return {
    ok: true,
    data: student,
    student: student,
    profile: student,
    result: student,
  };
}

function handleGetProcesses_(params) {
  const q = normalizeText_(params.q || params.query || params.search || "");
  const estado = normalizeText_(params.estado || "activo");
  const arte = normalizeText_(params.arte || params.area || "");
  const includeInactive = toBoolean_(params.includeInactive, false);

  const rows = getStudentRows_();
  const processes = [];

  rows.forEach(function (rowObj) {
    const student = mapRowToStudent_(rowObj);
    if (!student) return;

    if (!includeInactive) {
      if (!isActiveStatus_(student.estado)) return;
    } else if (estado && estado !== "todos" && normalizeText_(student.estado) !== estado) {
      return;
    }

    student.processes.forEach(function (process) {
      if (arte && normalizeText_(process.arte) !== arte) return;

      if (q) {
        const hayMatch =
          normalizeText_(student.nombre).indexOf(q) !== -1 ||
          normalizeText_(student.interesesMusicales).indexOf(q) !== -1 ||
          normalizeText_(process.arte).indexOf(q) !== -1 ||
          normalizeText_(process.detalle).indexOf(q) !== -1 ||
          normalizeText_(process.label).indexOf(q) !== -1;

        if (!hayMatch) return;
      }

      processes.push({
        processKey: process.processKey,
        studentKey: student.studentKey,
        nombre: student.nombre,
        estado: student.estado,
        edad: student.edad,
        interesesMusicales: student.interesesMusicales,
        arte: process.arte,
        detalle: process.detalle,
        label: process.label,
        sourceRow: student.sourceRow,
      });
    });
  });

  processes.sort(function (a, b) {
    const byName = a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
    if (byName !== 0) return byName;
    return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
  });

  return {
    ok: true,
    total: processes.length,
    data: processes,
    results: processes,
  };
}

function handleGetTeachers_() {
  return {
    ok: true,
    total: 0,
    data: [],
    teachers: [],
    results: [],
    message: "Los docentes ya no se consultan desde Apps Script. Usa Firebase/catalogos.",
    deprecated: true,
  };
}

/* =====================================================
 * CORE DATA
 * ===================================================== */

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheetByCandidates_(primaryName, candidates) {
  const ss = getSpreadsheet_();

  if (primaryName) {
    const exact = ss.getSheetByName(primaryName);
    if (exact) return exact;
  }

  const normalizedCandidates = (candidates || []).map(normalizeText_);
  const sheets = ss.getSheets();

  for (let i = 0; i < sheets.length; i += 1) {
    const sheet = sheets[i];
    if (normalizedCandidates.indexOf(normalizeText_(sheet.getName())) !== -1) {
      return sheet;
    }
  }

  throw new Error(
    'No se encontro la pestaña "' +
      primaryName +
      '"' +
      (normalizedCandidates.length
        ? ". Candidatas: " + normalizedCandidates.join(", ")
        : "")
  );
}

function getSheetRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < CONFIG.DATA_START_ROW || lastCol < 1) return [];

  const range = sheet.getRange(
    CONFIG.DATA_START_ROW,
    1,
    lastRow - CONFIG.HEADER_ROW,
    lastCol
  );

  return range.getValues().map(function (row, index) {
    return {
      rowNumber: CONFIG.DATA_START_ROW + index,
      values: row,
    };
  });
}

function getStudentRows_() {
  const sheet = getSheetByCandidates_(
    CONFIG.STUDENTS_SHEET_NAME,
    CONFIG.STUDENTS_SHEET_CANDIDATES
  );
  return getSheetRows_(sheet);
}

/* =====================================================
 * MAPPERS
 * ===================================================== */

function mapRowToStudent_(rowObj) {
  const row = rowObj.values;

  const nombre = safeCell_(row, CONFIG.COLS.NOMBRE);
  const estado = safeCell_(row, CONFIG.COLS.ESTADO);
  const edadRaw = safeCell_(row, CONFIG.COLS.EDAD);
  const email = safeCell_(row, CONFIG.COLS.EMAIL).toLowerCase();
  const cursoRaw = safeCell_(row, CONFIG.COLS.CURSO);
  const instrumento = safeCell_(row, CONFIG.COLS.INSTRUMENTO);
  const estilo = safeCell_(row, CONFIG.COLS.ESTILO);
  const enfasis = safeCell_(row, CONFIG.COLS.ENFASIS);
  const intereses = safeCell_(row, CONFIG.COLS.INTERESES);

  if (!nombre) return null;

  const processes = buildProcesses_(
    nombre,
    cursoRaw,
    instrumento,
    estilo,
    enfasis,
    rowObj.rowNumber
  );

  return {
    studentKey: buildStudentKey_(nombre, rowObj.rowNumber),
    id: buildStudentKey_(nombre, rowObj.rowNumber),
    nombre: nombre,
    name: nombre,
    estado: estado || "",
    edad: parseAge_(edadRaw),
    email: email,
    correo: email,
    correoElectronico: email,
    interesesMusicales: intereses || "",
    intereses: intereses || "",
    processes: processes,
    sourceRow: rowObj.rowNumber,
  };
}

/* =====================================================
 * STUDENT PROCESSES
 * ===================================================== */

function buildProcesses_(nombre, cursoRaw, instrumento, estilo, enfasis, rowNumber) {
  const cursos = splitCursos_(cursoRaw);
  const processes = [];

  cursos.forEach(function (curso) {
    const cursoNorm = normalizeCourse_(curso);
    if (!cursoNorm) return;

    let detalles = [];

    if (cursoNorm === "MÚSICA") {
      detalles = splitProcessDetails_(instrumento, "Sin instrumento");
    }
    if (cursoNorm === "BAILE") {
      detalles = splitProcessDetails_(estilo, "Sin estilo");
    }
    if (cursoNorm === "ARTES PLÁSTICAS") {
      detalles = splitProcessDetails_(enfasis, "Sin enfasis");
    }

    if (!detalles.length) {
      detalles = [""];
    }

    detalles.forEach(function (detalle) {
      const processKey = buildProcessKey_(nombre, cursoNorm, detalle, rowNumber);

      processes.push({
        processKey: processKey,
        arte: cursoNorm,
        detalle: detalle,
        label: cursoNorm + " - " + detalle,
      });
    });
  });

  return dedupeProcesses_(processes);
}

/* =====================================================
 * HELPERS
 * ===================================================== */

function safeCell_(row, colNumber) {
  const value = row[colNumber - 1];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseAge_(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? String(value).trim() : n;
}

function parseNumberOrNull_(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function isFiniteNumber_(value) {
  return typeof value === "number" && isFinite(value);
}

function splitCursos_(cursoRaw) {
  const text = String(cursoRaw || "").trim();
  if (!text) return [];

  return text
    .split(/,|;|\n|\//g)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

function splitProcessDetails_(rawValue, fallback) {
  const text = String(rawValue || "").trim();

  if (!text) {
    return [fallback];
  }

  const values = text
    .split(/,|;|\n/g)
    .map(function (s) {
      return String(s || "").trim();
    })
    .filter(Boolean);

  if (!values.length) {
    return [fallback];
  }

  const deduped = {};
  values.forEach(function (value) {
    deduped[value] = true;
  });

  return Object.keys(deduped);
}

function normalizeCourse_(text) {
  const t = normalizeText_(text);

  if (!t) return "";

  if (t.indexOf("musica") !== -1) return "MÚSICA";
  if (t.indexOf("baile") !== -1 || t.indexOf("danza") !== -1) return "BAILE";
  if (t.indexOf("plast") !== -1) return "ARTES PLÁSTICAS";

  return String(text || "").trim().toUpperCase();
}

function normalizeText_(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function slugify_(text) {
  return normalizeText_(text)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildStudentKey_(nombre, rowNumber) {
  return "stu_" + slugify_(nombre) + "_" + rowNumber;
}

function buildProcessKey_(nombre, arte, detalle, rowNumber) {
  return (
    "proc_" +
    slugify_(nombre) +
    "_" +
    slugify_(arte) +
    "_" +
    slugify_(detalle) +
    "_" +
    rowNumber
  );
}

function dedupeProcesses_(processes) {
  const map = {};
  processes.forEach(function (p) {
    map[p.processKey] = p;
  });
  return Object.keys(map).map(function (k) {
    return map[k];
  });
}

function isActiveStatus_(estado) {
  const e = normalizeText_(estado);
  if (!e) return true;

  return (
    e === "activo" ||
    e === "activa" ||
    e === "en proceso" ||
    e === "vigente" ||
    e.indexOf("activo ") === 0
  );
}

function toBoolean_(value, defaultValue) {
  if (value === true || value === false) return value;
  const v = String(value || "").trim().toLowerCase();
  if (!v) return defaultValue;
  return ["1", "true", "si", "sí", "yes"].indexOf(v) !== -1;
}

/* =====================================================
 * FIRESTORE SYNC
 * ===================================================== */

function syncMusiGymStudentsToFirestore() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("Ya hay una sincronizacion de estudiantes en curso.");
  }

  const startedAt = new Date();
  const report = createSyncReport_(startedAt);

  try {
    const studentsReport = syncMusiGymStudentsSheetToFirestore_({ report: report });
    const usersReport = syncMusiGymStudentAccessUsersToFirestore_({
      report: report,
      students: studentsReport.students,
    });

    report.students = stripInternalSyncReport_(studentsReport);
    report.users = stripInternalSyncReport_(usersReport);
    report.synced = report.created + report.updated;
    report.finishedAt = new Date().toISOString();
    report.ok = true;

    saveSyncReportToFirestore_(report);
    return report;
  } catch (error) {
    report.ok = false;
    report.error = error && error.message ? error.message : String(error);
    report.finishedAt = new Date().toISOString();

    try {
      saveSyncReportToFirestore_(report);
    } catch (saveError) {
      console.error("No se pudo guardar el reporte de sincronizacion:", saveError);
    }

    throw error;
  } finally {
    lock.releaseLock();
  }
}

// Alias de compatibilidad para instalaciones anteriores. No lo uses en triggers nuevos.
function syncAllSheetsToFirestore() {
  return syncMusiGymStudentsToFirestore();
}

function syncMusiGymStudentsSheetToFirestore_(options) {
  options = options || {};
  const report = options.report || createSyncReport_(new Date());
  const students = getStudentRows_().map(mapRowToStudent_).filter(Boolean);
  const existingDocs = listFirestoreCollection_("students");
  const existingById = {};
  const operations = [];
  const ownReport = {
    totalStudentsRead: students.length,
    validStudents: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    skippedInvalid: 0,
    students: students,
  };

  existingDocs.forEach(function (doc) {
    if (doc && doc.id) existingById[doc.id] = doc.data || {};
  });

  report.totalStudentsRead = students.length;

  students.forEach(function (student) {
    const normalized = normalizeStudentForFirestore_(student);

    if (!normalized.studentKey) {
      report.skippedInvalid += 1;
      ownReport.skippedInvalid += 1;
      return;
    }

    report.validStudents += 1;
    ownReport.validStudents += 1;

    const existing = existingById[normalized.studentKey] || null;
    if (!hasStudentFirestoreChanges_(existing, normalized)) {
      report.unchanged += 1;
      ownReport.unchanged += 1;
      return;
    }

    const now = new Date().toISOString();
    const payload = Object.assign({}, normalized, {
      source: "students_sheet_sync",
      syncOrigin: "apps_script_trigger",
      updatedAt: now,
    });

    if (!existing) payload.createdAt = now;

    operations.push({
      collectionName: "students",
      docId: normalized.studentKey,
      payload: payload,
    });

    if (existing) {
      report.updated += 1;
      ownReport.updated += 1;
    } else {
      report.created += 1;
      ownReport.created += 1;
    }
  });

  commitFirestoreOperations_(operations);
  return ownReport;
}

function syncMusiGymStudentAccessUsersToFirestore_(options) {
  options = options || {};
  const report = options.report || createSyncReport_(new Date());
  const students = Array.isArray(options.students)
    ? options.students
    : getStudentRows_().map(mapRowToStudent_).filter(Boolean);
  const existingUsers = listFirestoreCollection_("users");
  const existingByEmail = {};
  const existingByStudentId = {};
  const seenEmails = {};
  const operations = [];
  const ownReport = {
    totalStudentsRead: students.length,
    validStudents: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    skippedMissingEmail: 0,
    skippedDuplicateEmail: 0,
    conflicts: 0,
  };

  existingUsers.forEach(function (user) {
    const data = user.data || {};
    const email = normalizeEmail_(data.email || (user.id.indexOf("@") !== -1 ? user.id : ""));
    const studentId = String(data.studentId || data.studentKey || data.estudianteId || "").trim();
    if (email) existingByEmail[email] = Object.assign({ id: user.id }, data);
    if (studentId) existingByStudentId[studentId] = Object.assign({ id: user.id }, data);
  });

  students.forEach(function (student) {
    const email = normalizeEmail_(student.email || student.correo || student.correoElectronico);
    const studentKey = String(student.studentKey || student.id || student.studentId || "").trim();

    if (!email) {
      report.skippedMissingEmail += 1;
      ownReport.skippedMissingEmail += 1;
      return;
    }

    if (seenEmails[email]) {
      report.skippedDuplicateEmail += 1;
      ownReport.skippedDuplicateEmail += 1;
      return;
    }

    seenEmails[email] = true;
    report.validStudents += 1;
    ownReport.validStudents += 1;

    const existing = existingByStudentId[studentKey] || existingByEmail[email] || null;
    const role = normalizeText_(existing && (existing.role || existing.rol));

    if (existing && role && role !== "student" && role !== "estudiante") {
      report.conflicts += 1;
      ownReport.conflicts += 1;
      return;
    }

    const now = new Date().toISOString();
    const payload = {
      email: email,
      role: "student",
      studentId: studentKey,
      studentKey: studentKey,
      displayName: String(student.nombre || student.name || student.nombreCompleto || "").trim(),
      studentStatus: String(student.estado || student.status || student.estadoActual || "").trim(),
      active: isStudentAllowedToLogInForSync_(student),
      source: "students_sheet_sync",
      sourceRow: student.sourceRow || null,
      syncOrigin: "apps_script_trigger",
      updatedAt: now,
    };

    if (!hasUserAccessChanges_(existing, payload)) {
      report.unchanged += 1;
      ownReport.unchanged += 1;
      return;
    }

    if (!existing) payload.createdAt = now;

    operations.push({
      collectionName: "users",
      docId: email,
      payload: payload,
    });

    if (existing) {
      report.updated += 1;
      ownReport.updated += 1;
    } else {
      report.created += 1;
      ownReport.created += 1;
    }
  });

  commitFirestoreOperations_(operations);
  return ownReport;
}

function setupMusiGymAutoSyncTrigger() {
  // Crea un trigger horario SOLO para syncMusiGymStudentsToFirestore.
  // Debe ejecutarse manualmente si el admin/desarrollador decide activar la sincronización.
  deleteMusiGymAutoSyncTriggers();

  return ScriptApp.newTrigger("syncMusiGymStudentsToFirestore")
    .timeBased()
    .everyHours(1)
    .create();
}

function deleteMusiGymAutoSyncTriggers() {
  // Elimina únicamente triggers cuyo handler sea de MusiGym.
  // No toca otros triggers del proyecto de Apps Script.
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (
      trigger.getHandlerFunction() === "syncMusiGymStudentsToFirestore" ||
      trigger.getHandlerFunction() === "syncAllSheetsToFirestore"
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

// Alias de compatibilidad. Preferir setupMusiGymAutoSyncTrigger().
function setupAutoSyncTrigger() {
  return setupMusiGymAutoSyncTrigger();
}

// Alias de compatibilidad. Preferir deleteMusiGymAutoSyncTriggers().
function deleteAutoSyncTriggers() {
  return deleteMusiGymAutoSyncTriggers();
}

function diagnoseFirestoreRestAuth() {
  const projectId = getRequiredScriptProperty_("FIREBASE_PROJECT_ID");
  const clientEmail = getRequiredScriptProperty_("FIREBASE_CLIENT_EMAIL");
  getRequiredScriptProperty_("FIREBASE_PRIVATE_KEY");

  const report = {
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_CLIENT_EMAIL: clientEmail,
    hasPrivateKey: true,
    accessTokenGenerated: false,
    studentsReadUrl:
      firestoreBaseUrl_() + "/documents/students?pageSize=1",
    studentsReadStatus: null,
    firestoreResponse: null,
  };

  try {
    const accessToken = getFirestoreAccessToken_({ forceRefresh: true });
    report.accessTokenGenerated = Boolean(accessToken);

    const response = UrlFetchApp.fetch(report.studentsReadUrl, {
      method: "get",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      muteHttpExceptions: true,
    });

    report.studentsReadStatus = response.getResponseCode();
    report.firestoreResponse = safeParseJson_(response.getContentText());
  } catch (error) {
    report.error = error && error.message ? error.message : String(error);
  }

  console.log(JSON.stringify(report, null, 2));
  return report;
}

function createSyncReport_(startedAt) {
  return {
    totalStudentsRead: 0,
    validStudents: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    skippedInvalid: 0,
    skippedMissingEmail: 0,
    skippedDuplicateEmail: 0,
    conflicts: 0,
    synced: 0,
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    source: "apps_script_trigger",
  };
}

function stripInternalSyncReport_(report) {
  const copy = Object.assign({}, report || {});
  delete copy.students;
  return copy;
}

function normalizeStudentForFirestore_(student) {
  const studentKey = String(student.studentKey || student.id || student.studentId || "").trim();
  return {
    studentKey: studentKey,
    id: studentKey,
    nombre: String(student.nombre || student.name || "").trim(),
    name: String(student.name || student.nombre || "").trim(),
    estado: String(student.estado || student.status || "").trim(),
    edad: student.edad === undefined ? null : student.edad,
    email: normalizeEmail_(student.email || student.correo || student.correoElectronico),
    correo: normalizeEmail_(student.correo || student.email || student.correoElectronico),
    correoElectronico: normalizeEmail_(student.correoElectronico || student.email || student.correo),
    interesesMusicales: String(student.interesesMusicales || student.intereses || "").trim(),
    intereses: String(student.intereses || student.interesesMusicales || "").trim(),
    processes: Array.isArray(student.processes) ? student.processes : [],
    sourceRow: student.sourceRow || null,
  };
}

function hasStudentFirestoreChanges_(existing, next) {
  if (!existing) return true;

  const keys = [
    "nombre",
    "email",
    "correo",
    "correoElectronico",
    "edad",
    "estado",
    "interesesMusicales",
    "curso",
    "area",
    "programa",
    "instrumento",
    "modalidad",
    "sede",
    "docente",
    "acudiente",
    "sourceRow",
  ];

  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const currentValue = existing[key] === undefined || existing[key] === null ? "" : existing[key];
    const nextValue = next[key] === undefined || next[key] === null ? "" : next[key];
    if (String(currentValue) !== String(nextValue)) return true;
  }

  return JSON.stringify(existing.processes || []) !== JSON.stringify(next.processes || []);
}

function hasUserAccessChanges_(existing, next) {
  if (!existing) return true;

  const keys = [
    "email",
    "role",
    "studentId",
    "studentKey",
    "displayName",
    "studentStatus",
    "active",
    "source",
    "sourceRow",
    "syncOrigin",
  ];

  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const currentValue = existing[key] === undefined || existing[key] === null ? "" : existing[key];
    const nextValue = next[key] === undefined || next[key] === null ? "" : next[key];
    if (String(currentValue) !== String(nextValue)) return true;
  }

  return false;
}

function isStudentAllowedToLogInForSync_(student) {
  const status = normalizeText_(student && (student.estado || student.status || student.estadoActual));
  return (
    status === "activo" ||
    status.indexOf("activo no registro") === 0 ||
    status.indexOf("activo en pausa") === 0 ||
    status.indexOf("inactivo en pausa") === 0
  );
}

function normalizeEmail_(value) {
  return String(value || "").trim().toLowerCase();
}

function saveSyncReportToFirestore_(report) {
  setFirestoreDocument_("app_config", "sync_students_last_report", report);
}

function commitFirestoreOperations_(operations) {
  (operations || []).forEach(function (operation) {
    setFirestoreDocument_(operation.collectionName, operation.docId, operation.payload);
  });
}

function setFirestoreDocument_(collectionName, docId, payload) {
  const url = firestoreDocumentUrl_(collectionName, docId, Object.keys(payload || {}));
  const accessToken = getFirestoreAccessToken_();
  const response = UrlFetchApp.fetch(url, {
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    payload: JSON.stringify({ fields: encodeFirestoreFields_(payload || {}) }),
    muteHttpExceptions: true,
  });

  assertFirestoreResponse_(response, "guardar " + collectionName + "/" + docId);
}

function listFirestoreCollection_(collectionName) {
  const docs = [];
  let pageToken = "";

  do {
    let url =
      firestoreBaseUrl_() +
      "/documents/" +
      encodeURIComponent(collectionName) +
      "?pageSize=1000";

    if (pageToken) {
      url += "&pageToken=" + encodeURIComponent(pageToken);
    }

    const response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: {
        Authorization: "Bearer " + getFirestoreAccessToken_(),
        "Content-Type": "application/json",
      },
      muteHttpExceptions: true,
    });

    assertFirestoreResponse_(response, "leer coleccion " + collectionName);

    const payload = JSON.parse(response.getContentText() || "{}");
    (payload.documents || []).forEach(function (doc) {
      const parts = String(doc.name || "").split("/");
      docs.push({
        id: parts[parts.length - 1],
        data: decodeFirestoreFields_(doc.fields || {}),
      });
    });
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return docs;
}

function firestoreDocumentUrl_(collectionName, docId, updateMaskFields) {
  let url =
    firestoreBaseUrl_() +
    "/documents/" +
    encodeURIComponent(collectionName) +
    "/" +
    encodeURIComponent(docId);

  (updateMaskFields || []).forEach(function (field) {
    url += (url.indexOf("?") === -1 ? "?" : "&") + "updateMask.fieldPaths=" + encodeURIComponent(field);
  });

  return url;
}

function firestoreBaseUrl_() {
  return "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(getFirebaseProjectId_()) + "/databases/(default)";
}

function getFirebaseProjectId_() {
  return getRequiredScriptProperty_("FIREBASE_PROJECT_ID");
}

function getFirestoreAccessToken_(options) {
  options = options || {};
  const projectId = getFirebaseProjectId_();
  const clientEmail = getRequiredScriptProperty_("FIREBASE_CLIENT_EMAIL");
  const cacheKey = "firestore_access_token_" + slugify_(projectId + "_" + clientEmail).slice(0, 180);
  const cache = CacheService.getScriptCache();
  const cached = options.forceRefresh ? "" : cache.get(cacheKey);
  if (cached) return cached;

  const privateKey = getRequiredScriptProperty_("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsignedJwt =
    base64UrlEncode_(JSON.stringify(header)) + "." + base64UrlEncode_(JSON.stringify(claim));
  const signature = Utilities.computeRsaSha256Signature(unsignedJwt, privateKey);
  const jwt = unsignedJwt + "." + base64UrlEncode_(signature);
  const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    },
    muteHttpExceptions: true,
  });

  assertFirestoreResponse_(response, "obtener token OAuth");

  const payload = JSON.parse(response.getContentText() || "{}");
  if (!payload.access_token) {
    throw new Error("Firebase no devolvio access_token.");
  }

  cache.put(cacheKey, payload.access_token, 3300);
  return payload.access_token;
}

function getRequiredScriptProperty_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error("Falta configurar Script Property: " + key);
  }
  return value;
}

function assertFirestoreResponse_(response, action) {
  const code = response.getResponseCode();
  if (code >= 200 && code < 300) return;

  throw new Error(
    "Error al " +
      action +
      " en Firestore. HTTP " +
      code +
      ": " +
      response.getContentText()
  );
}

function safeParseJson_(text) {
  const safeText = String(text || "");
  if (!safeText) return null;

  try {
    return JSON.parse(safeText);
  } catch (error) {
    return safeText;
  }
}

function encodeFirestoreFields_(obj) {
  const fields = {};
  Object.keys(obj || {}).forEach(function (key) {
    if (obj[key] !== undefined) {
      fields[key] = encodeFirestoreValue_(obj[key]);
    }
  });
  return fields;
}

function encodeFirestoreValue_(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Math.floor(value) === value) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(encodeFirestoreValue_),
      },
    };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: encodeFirestoreFields_(value),
      },
    };
  }
  return { stringValue: String(value) };
}

function decodeFirestoreFields_(fields) {
  const obj = {};
  Object.keys(fields || {}).forEach(function (key) {
    obj[key] = decodeFirestoreValue_(fields[key]);
  });
  return obj;
}

function decodeFirestoreValue_(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(decodeFirestoreValue_);
  }
  if ("mapValue" in value) {
    return decodeFirestoreFields_(value.mapValue.fields || {});
  }
  return null;
}

function base64UrlEncode_(value) {
  const bytes = typeof value === "string" ? Utilities.newBlob(value).getBytes() : value;
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
