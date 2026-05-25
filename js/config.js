export const CONFIG = Object.freeze({
  app: {
    name: "MusiGym Musicala",
    subtitle: "Centro de práctica, rutas y acompañamiento artístico",
    version: "0.1.0",
  },

  firebase: {
    apiKey: "AIzaSyDFt6RdGxW8vIy6pO0egTZrD0MF21osM3o",
    authDomain: "musigym-training-hub.firebaseapp.com",
    projectId: "musigym-training-hub",
    storageBucket: "musigym-training-hub.firebasestorage.app",
    messagingSenderId: "129695050633",
    appId: "1:129695050633:web:dfe60b76bc76f7e2900f58"
  },

  appsScript: {
    studentsUrl:
      "https://script.google.com/macros/s/AKfycbyUAseB3vjBz3uBPc2gXQkjd6temDaDkZShXVVUZpKfATrN8A8czpdloTcz0YxBd7Y7LQ/exec",
  },

  access: {
    bootstrapAdminEmails: [
      "alekcaballeromusic@gmail.com",
      "catalina.medina.leal@gmail.com",
      "catalina.medina.lea@gmail.com",
      "imusicala@gmail.com",
    ],
  },

  collections: {
    users: "musigym_users",
    students: "musigym_students",
    objectives: "musigym_objectives",
    routines: "musigym_routines",
    sessions: "musigym_sessions",
    diagnostics: "musigym_diagnostics",
    selfEvaluations: "musigym_self_evaluations",
    songRequests: "musigym_song_requests",
    teacherCalls: "musigym_teacher_calls",
    routeProgress: "musigym_route_progress",
    monthlyReports: "musigym_monthly_reports",
    nextQuestions: "musigym_next_questions",
  },
});

export const CATALOGS = Object.freeze({
  roles: ["admin", "docente", "estudiante"],
  arts: ["Música", "Danza", "Teatro", "Artes plásticas"],
  instruments: [
    "Guitarra",
    "Piano",
    "Canto",
    "Bajo",
    "Batería",
    "Violín",
    "Ukelele",
    "Danza urbana",
    "Ballet",
    "Teatro",
    "Dibujo",
    "Pintura",
  ],
  levels: ["Inicial", "Básico", "Intermedio", "Avanzado"],
  emphases: [
    "Técnica",
    "Teoría",
    "Repertorio",
    "Creatividad",
    "Improvisación",
    "Montaje",
    "Expresión corporal",
    "Composición",
  ],
  sessionTypes: ["Práctica guiada", "Asesoría", "Diagnóstico", "Seguimiento", "Montaje"],
  moodOptions: ["Muy bien", "Bien", "Regular", "Me costó", "Me sentí bloqueado/a"],
});

export const DEFAULT_ROUTES = Object.freeze({
  guitarra: [
    {
      id: "gt-postura-afinacion",
      component: "Fundamentos",
      level: "Inicial",
      title: "Postura, agarre y afinación",
      description:
        "Reconoce la postura corporal, ubicación de la guitarra, digitación básica y afinación estándar.",
    },
    {
      id: "gt-mano-derecha-ritmo",
      component: "Técnica",
      level: "Inicial",
      title: "Pulso y mano derecha",
      description:
        "Mantiene pulso estable con rasgueos sencillos, alternando patrones básicos con metrónomo.",
    },
    {
      id: "gt-acordes-abiertos",
      component: "Armonía práctica",
      level: "Inicial",
      title: "Acordes abiertos esenciales",
      description:
        "Construye cambios fluidos entre acordes abiertos mayores y menores frecuentes.",
    },
    {
      id: "gt-lectura-cifrado",
      component: "Teoría",
      level: "Inicial",
      title: "Cifrado y lectura básica",
      description:
        "Interpreta cifrado americano, diagramas de acordes y tablaturas sencillas.",
    },
    {
      id: "gt-repertorio-1",
      component: "Repertorio",
      level: "Inicial",
      title: "Primera canción acompañada",
      description:
        "Monta una canción completa con acordes, ritmo estable y estructura formal reconocible.",
    },
    {
      id: "gt-patrones-0123",
      component: "Técnica",
      level: "Básico",
      title: "Patrones 0123 y coordinación",
      description:
        "Fortalece independencia de dedos, coordinación bilateral y limpieza sonora.",
    },
    {
      id: "gt-escalas-pentatonica",
      component: "Escalas",
      level: "Básico",
      title: "Pentatónica menor y frases cortas",
      description:
        "Usa la escala pentatónica menor para crear pequeñas respuestas melódicas e improvisar.",
    },
    {
      id: "gt-cejilla",
      component: "Técnica",
      level: "Intermedio",
      title: "Cejilla y movilidad armónica",
      description:
        "Aplica acordes con cejilla de forma progresiva, cuidando presión, sonido y relajación.",
    },
  ],
  general: [
    {
      id: "gen-diagnostico",
      component: "Diagnóstico",
      level: "Inicial",
      title: "Diagnóstico artístico inicial",
      description:
        "Identifica fortalezas, intereses, retos y hábitos de práctica del estudiante.",
    },
    {
      id: "gen-rutina",
      component: "Hábitos",
      level: "Inicial",
      title: "Rutina personal de práctica",
      description:
        "Construye una rutina sostenible y medible según el arte, nivel y objetivos.",
    },
    {
      id: "gen-proceso",
      component: "Proceso",
      level: "Básico",
      title: "Registro de avance",
      description:
        "Registra avances, dificultades y próximos pasos después de cada sesión.",
    },
  ],
});
