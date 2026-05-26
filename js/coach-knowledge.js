// Motor de conocimiento de MusiCoach.
// Esta base alimenta las respuestas sin necesidad de IA real.
// Fuente: base pedagógica oficial de Musicala (metodología CREA).

export const CREA = {
  C: "Concentración: estar presente, escuchar, repetir con intención.",
  R: "Recursos: ejercicios, materiales, repertorio y estrategias.",
  E: "Exploración: probar, equivocarse, improvisar, crear.",
  A: "Adaptabilidad: ajustar al ritmo, edad, intereses y nivel del estudiante.",
};

export const IDENTITY =
  "MusiCoach acompaña con mirada humana, creativa y cercana. Acá la técnica no es una meta fría: es una herramienta para que cada estudiante se exprese mejor.";

export const LEVELS = {
  0: {
    name: "Exploración / Diagnóstico",
    focus: "Conocer el instrumento, identificar intereses y punto de partida.",
    hito: "Reconocer postura, cuidados y primeros ejercicios guiados.",
  },
  1: {
    name: "Iniciación",
    focus: "Construir bases técnicas y hábitos de práctica con seguridad.",
    hito: "Tocar/cantar/bailar una pieza sencilla y practicar en casa con guía.",
  },
  2: {
    name: "Básico consolidado",
    focus: "Practicar con más autonomía y reconocer errores propios.",
    hito: "Sostener una rutina corta sola y preparar una muestra sencilla.",
  },
  3: {
    name: "Intermedio",
    focus: "Unir técnica, expresión, teoría y repertorio con intención.",
    hito: "Interpretar repertorio medio y participar en ensambles.",
  },
  4: {
    name: "Intermedio avanzado",
    focus: "Desarrollar criterio artístico: interpretar, no solo ejecutar.",
    hito: "Sostener práctica estructurada y montar proyectos exigentes.",
  },
  5: {
    name: "Avanzado / Proyecto artístico",
    focus: "Trabajar objetivos personales de alto alcance y estilo propio.",
    hito: "Liderar montajes, componer/improvisar, prepararse para audiciones.",
  },
};

export function levelInfo(raw = "") {
  const n = String(raw).match(/\d/);
  if (n) return LEVELS[Number(n[0])] || LEVELS[1];
  const norm = String(raw).toLowerCase();
  if (norm.includes("avanz")) return LEVELS[5];
  if (norm.includes("interm")) return LEVELS[3];
  if (norm.includes("básico") || norm.includes("basico") || norm.includes("consol")) return LEVELS[2];
  if (norm.includes("inicia")) return LEVELS[1];
  if (norm.includes("diagn") || norm.includes("explor")) return LEVELS[0];
  return LEVELS[1];
}

// Estructura sugerida de sesión según duración total
export function sessionShape(totalMin = 30) {
  if (totalMin <= 12) {
    return [
      { name: "Llegada", minutes: 2, instructions: "Respira, recuerda en qué quedaste y elige UNA cosa que quieres mejorar hoy." },
      { name: "Calentamiento exprés", minutes: 3, instructions: "Activa cuerpo y atención con un ejercicio muy corto." },
      { name: "Foco del día", minutes: 5, instructions: "Repite el fragmento difícil lento, sin afán, y con atención." },
      { name: "Cierre", minutes: 2, instructions: "Escribe en una frase qué salió mejor y qué sigue costando." },
    ];
  }
  if (totalMin <= 22) {
    return [
      { name: "Llegada", minutes: 3, instructions: "¿Cómo llegas hoy? ¿Qué quieres lograr en esta práctica?" },
      { name: "Calentamiento", minutes: 5, instructions: "Movilidad, postura y un ejercicio técnico corto." },
      { name: "Foco del día", minutes: 10, instructions: "Trabaja UN fragmento del foco lento y con intención." },
      { name: "Cierre", minutes: 4, instructions: "Aplica el foco en algo que ya conozcas y escribe la mini-meta." },
    ];
  }
  if (totalMin <= 35) {
    return [
      { name: "Llegada", minutes: 3, instructions: "Conecta con el cuerpo y elige una intención clara." },
      { name: "Calentamiento", minutes: 6, instructions: "Ejercicios técnicos cortos, sin tensión." },
      { name: "Técnica", minutes: 10, instructions: "Trabaja el 'cómo': digitación, postura, ritmo o coordinación." },
      { name: "Repertorio", minutes: 8, instructions: "Aplica lo trabajado en una pieza o sección concreta." },
      { name: "Cierre", minutes: 3, instructions: "Escribe qué salió, qué sigue y qué pregunta llevas al profe." },
    ];
  }
  return [
    { name: "Llegada", minutes: 5, instructions: "Conecta con el cuerpo, repasa la sesión anterior, elige una intención." },
    { name: "Calentamiento", minutes: 8, instructions: "Movilidad, técnica básica y respiración. Sin prisa." },
    { name: "Técnica", minutes: 12, instructions: "Mejora una habilidad pequeña, medible y repetible." },
    { name: "Teoría / comprensión", minutes: 7, instructions: "Conecta lo que tocas con lo que entiendes: ritmo, acordes, estructura." },
    { name: "Repertorio / proyecto", minutes: 18, instructions: "Trabaja el reto principal por fragmentos, no por la canción entera." },
    { name: "Exploración", minutes: 5, instructions: "Improvisa, varía o crea una mini-versión propia." },
    { name: "Cierre", minutes: 5, instructions: "¿Qué mejoró? ¿Qué sigue costando? ¿Cuál es la micro-meta hasta la próxima clase?" },
  ];
}

// Conocimiento detallado por instrumento/arte
export const INSTRUMENT_KNOWLEDGE = {
  piano: {
    warmup: "Siéntate cómodo/a, relaja hombros y muñecas, y toca lento con dedos curvos antes de subir velocidad.",
    technique: "Trabaja manos por separado, luego une lentamente. Claridad antes que velocidad.",
    explain: "En piano conviene separar coordinación, lectura y sonido. Si juntas todo de una, el cerebro hace motín.",
    commonErrors: ["Tocar con dedos planos", "Subir los hombros", "Mirar solo las manos", "Perder pulso al cambiar de mano", "Tocar rápido antes de entender"],
    fixes: ["Practicar lento", "Separar manos", "Marcar digitación", "Metrónomo suave en fragmentos de 2-4 compases", "Cantar la melodía antes de tocarla"],
    keywords: ["piano", "teclado", "keyboard"],
  },
  guitarraAcustica: {
    warmup: "Revisa afinación, postura y movilidad suave de manos. Toca lento y escucha si cada nota sale limpia.",
    technique: "Cambios de acordes lentos, mano izquierda relajada, rasgueo constante en cuerdas apagadas antes de sonar.",
    explain: "Si suena feo no siempre es que toques mal: puede ser afinación, presión, postura o ritmo. La guitarra exige revisar todo a la vez.",
    commonErrors: ["Presionar demasiado fuerte", "Dedos lejos del traste", "Cambios de acordes lentos", "Rasgueo rígido", "Perder pulso al cambiar acordes"],
    fixes: ["Revisar posición del pulgar atrás del mástil", "Practicar cambios entre solo dos acordes", "Separar mano izquierda y derecha", "Rasgueo en cuerdas apagadas para fijar el ritmo", "Canciones de pocos acordes con metrónomo lento"],
    keywords: ["guitarra acustica", "guitarra acústica", "acustica", "acústica"],
  },
  guitarraElectrica: {
    warmup: "Cuerpo relajado, púa suelta, ejercicios cortos en una sola cuerda antes de moverte por todo el diapasón.",
    technique: "Sincroniza púa con mano izquierda en escalas cortas, controla silencios y trabaja con sonido limpio antes de meter efectos.",
    explain: "Los efectos no arreglan errores: los amplifican. Primero precisión, después distorsión.",
    commonErrors: ["Exceso de fuerza en la púa", "Ruido de cuerdas no controladas", "Tocar riffs demasiado rápido", "Depender del efecto"],
    fixes: ["Practicar con sonido limpio", "Apagar cuerdas con palma y dedos", "Riffs por células de 2-4 notas", "Alternar púa abajo/arriba con metrónomo"],
    keywords: ["guitarra electrica", "guitarra eléctrica", "electrica", "eléctrica"],
  },
  bajo: {
    warmup: "Postura, pulso firme y digitación cómoda. Mano derecha relajada, sin clavar los dedos.",
    technique: "Pulso primero, groove después. Practica con pista o batería para sentir dónde van los acentos.",
    explain: "El bajo no se trata de muchas notas: se trata de SOSTENER el tiempo y conectar armonía y ritmo.",
    commonErrors: ["No sostener el pulso", "Tocar como guitarra sin pensar en groove", "No apagar cuerdas", "Tocar muchas notas sin intención"],
    fixes: ["Practicar con batería o pista", "Patrones simples enfatizando tiempos fuertes", "Escuchar canciones enfocándose solo en el bajo", "Practicar silencios"],
    keywords: ["bajo"],
  },
  canto: {
    warmup: "Respiración suave, vocalizaciones cómodas, escucha tu cuerpo antes de exigir volumen.",
    technique: "Trabaja una frase corta cuidando respiración, apoyo, afinación y claridad del texto.",
    explain: "En canto el cuerpo es el instrumento. Postura, respiración y escucha NO son accesorios: son el sonido.",
    commonErrors: ["Tensión en cuello o mandíbula", "Forzar volumen", "Respirar muy arriba (clavicular)", "Imitar voces sin conocer tu propio registro", "Cantar 'hacia adentro' por pena"],
    fixes: ["Respiración diafragmática guiada", "Vocalizaciones suaves de 5 minutos", "Trabajar afinación por intervalos cortos", "Cantar frases pequeñas y grabarte sin juicio", "Elegir repertorio adecuado al rango"],
    keywords: ["canto", "voz", "vocal", "cantar"],
  },
  bateria: {
    warmup: "Postura, baquetas relajadas, ejercicios de rebote en una sola superficie antes de moverte por el set.",
    technique: "Patrones repetitivos con metrónomo. Cantar el ritmo en voz alta antes de tocarlo.",
    explain: "La batería no es golpear más fuerte: es controlar dinámicas y tempo. Una batería bien tocada se siente como un latido.",
    commonErrors: ["Acelerar sin notarlo", "Perder independencia entre extremidades", "Golpear demasiado fuerte", "Hacer fills fuera de tiempo"],
    fixes: ["Practicar lento con metrónomo", "Separar extremidades", "Cantar el ritmo antes de tocarlo", "Fills de un tiempo antes de fills largos", "Controlar volumen conscientemente"],
    keywords: ["bateria", "batería", "drums"],
  },
  violin: {
    warmup: "Postura, agarre suave del arco, cuerdas al aire con sonido limpio antes de meter notas.",
    technique: "Afinación nota por nota, mano derecha relajada, frases cortas y melódicas.",
    explain: "El violín es paciente: primero suena raro, después suena. Lo importante es no tensionarse.",
    commonErrors: ["Tensión en hombro y cuello", "Arco torcido", "Mala afinación", "Sonido raspado", "Agarre del arco muy fuerte"],
    fixes: ["Revisar postura sin instrumento primero", "Arco solo en cuerdas al aire", "Afinación nota por nota con referencia", "Frases melódicas cortas", "Escuchar referencias del repertorio"],
    keywords: ["violin", "violín"],
  },
  ukelele: {
    warmup: "Postura cómoda, afinación, rasgueo en cuerdas apagadas para sentir el pulso.",
    technique: "Cambios entre dos acordes a la vez, cantar antes de tocar.",
    explain: "El ukelele es accesible pero pide intención: ritmo claro y cambios limpios hacen la diferencia.",
    commonErrors: ["Rasguear con tensión", "Cambios de acordes lentos", "Perder ritmo al cantar", "Tocar siempre igual sin dinámica"],
    fixes: ["Rasgueo sin acordes para fijar el ritmo", "Cambios entre solo dos acordes", "Cantar con palmas antes de tocar", "Variar intensidad en estrofa vs coro"],
    keywords: ["ukelele", "ukulele"],
  },
  flauta: {
    warmup: "Respiración relajada, notas largas sostenidas, sin forzar aire.",
    technique: "Dedos curvos, frases cortas, control de sonido antes que velocidad.",
    explain: "En flauta el aire es el sonido: si soplas demasiado, pierdes calidad. Menos es más.",
    commonErrors: ["Soplar demasiado fuerte", "Mala postura", "Dedos tensos", "Sonido inestable"],
    fixes: ["Ejercicios de respiración antes de tocar", "Notas largas sostenidas", "Frases cortas con pausa", "Descansar entre repeticiones"],
    keywords: ["flauta"],
  },
  danza: {
    warmup: "Activa articulaciones, postura y respiración. Conciencia del espacio antes de movimientos grandes.",
    technique: "Una secuencia corta con control, dirección, memoria corporal y musicalidad.",
    explain: "Bailar no es solo memorizar pasos: es cuerpo, ritmo, intención, espacio y energía a la vez.",
    commonErrors: ["Rigidez corporal", "Falta de memoria coreográfica", "No escuchar la música", "Mirar al piso", "Compararse con otros"],
    fixes: ["Dividir coreografía en bloques", "Marcar primero sin música", "Después música lenta", "Trabajar transiciones aisladas", "Reforzar confianza con repeticiones cortas"],
    keywords: ["danza", "baile", "ballet", "cheer", "porras"],
  },
  artesPlasticas: {
    warmup: "Soltura de mano: líneas, espirales, formas básicas. Sin presionar el lápiz.",
    technique: "Formas grandes antes de detalles. Observa proporciones, no copies puntos sueltos.",
    explain: "Dibujar no es 'pegarle' al detalle: es construir desde lo grande hacia lo pequeño.",
    commonErrors: ["Apretar el lápiz", "Empezar por detalles", "No observar proporciones", "Borrar demasiado", "Miedo a dañar la hoja"],
    fixes: ["Ejercicios de soltura 3-5 minutos", "Bocetos rápidos sin borrar", "Trabajo por capas", "Comparar proporciones antes de detalles", "Enfocar el proceso, no el resultado"],
    keywords: ["dibujo", "pintura", "plastica", "plástica", "manualidades", "visual"],
  },
  teatro: {
    warmup: "Respiración, voz, cuerpo y atención. Juegos cortos para conectar con el grupo o contigo.",
    technique: "Construir personaje desde la intención, no desde la forma.",
    explain: "Actuar no es 'fingir bien': es escuchar, reaccionar y comprometerte con la situación.",
    commonErrors: ["Hablar muy bajito", "Bloquear el cuerpo", "Memorizar sin intención", "No escuchar al compañero", "Sobreactuar o quedarse plano"],
    fixes: ["Juegos de confianza", "Ejercicios de voz proyectada", "Improvisación corta", "Trabajo de intención línea por línea", "Respiración antes de escena"],
    keywords: ["teatro", "actuacion", "actuación", "escenico", "escénico"],
  },
};

const DEFAULT_TIPS = {
  warmup: "Prepara cuerpo, atención y materiales. Define una intención concreta para esta práctica.",
  technique: "Trabaja una habilidad pequeña, medible y repetible. Mejor poco y claro que mucho y borroso.",
  explain: "Cuando algo no sale, divide el reto en partes: técnica, comprensión, ritmo, memoria y confianza.",
  commonErrors: ["Querer hacer todo de una", "Practicar sin objetivo", "Compararse con otros"],
  fixes: ["Definir una micro-meta", "Trabajar fragmentos cortos", "Celebrar el avance pequeño"],
  keywords: [],
};

export function getInstrumentKnowledge(instrument = "") {
  const strip = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const norm = strip(instrument);
  for (const key of Object.keys(INSTRUMENT_KNOWLEDGE)) {
    const data = INSTRUMENT_KNOWLEDGE[key];
    if (data.keywords.some((k) => norm.includes(strip(k)))) {
      return { key, ...data };
    }
  }
  return { key: "general", ...DEFAULT_TIPS };
}

// Frases distintivas — se rotan para que MusiCoach no suene canned
export const PHRASES = {
  validate: [
    "Tiene sentido. Esto que sientes pasa cuando estás trabajando algo que todavía no está automatizado.",
    "Te escucho. Lo que describes es exactamente la parte donde el cerebro está armando el puente.",
    "Eso que cuentas es señal de que estás en un punto real de práctica, no de que vayas mal.",
    "Eso pasa, y es buena señal: significa que algo te importa lo suficiente como para que cueste.",
  ],
  diagnose: [
    "Probablemente el reto no es toda la pieza: es UN punto específico dentro de ella.",
    "Apuesto a que el problema está en una transición chiquita, no en todo lo que estás intentando.",
    "Suele pasar que un detalle (postura, pulso, respiración o digitación) está disparando todo lo demás.",
    "Lo más probable es que el cerebro esté pidiendo separar componentes antes de unirlos.",
  ],
  microMeta: [
    "Tu meta de hoy: lograrlo 3 veces seguidas LENTO y sin parar.",
    "Mini-meta: hacerlo limpio 5 veces antes de pensar en velocidad.",
    "Hoy basta con que el fragmento salga bien dos veces seguidas.",
    "Tu meta no es la canción completa: es que UN compás quede más claro.",
  ],
  motivate: [
    "Cuando eso salga, lo volvemos a unir con el resto. Paso a paso.",
    "Si sale lento, va bien. La velocidad llega sola después.",
    "Esto que te cuesta es justo lo que te está haciendo avanzar.",
    "No estás fallando: estás encontrando el punto exacto donde practicar.",
  ],
  closingQuestion: [
    "¿Quieres que arme una rutina con esto o lo trabajamos suelto?",
    "¿Te lo dejo como mini-meta para la semana?",
    "¿Lo guardamos como duda para el profe en la próxima clase?",
    "¿Quieres una versión más corta o más retadora de este foco?",
  ],
};

export const UNBLOCK_STRATEGIES = [
  { name: "Bajar velocidad", how: "Practica a la mitad del tempo. Si sigue costando, baja otra mitad." },
  { name: "Reducir el fragmento", how: "Trabaja UN compás, UNA frase, UN cambio. Nada más." },
  { name: "Separar componentes", how: "Aisla ritmo, notas, manos, letra o respiración. Únelos después." },
  { name: "Cambiar el formato", how: "Cántalo, palméalo, dilo en voz alta, dibújalo o camínalo antes de tocarlo." },
  { name: "Meta mínima", how: "Define algo concreto: '3 veces limpio', '1 minuto sin parar', '2 compases seguidos'." },
  { name: "Volver a algo que ya sale", how: "Toca algo cómodo 2 minutos para recordarle al cerebro que SÍ puedes." },
];

export function pickUnblock(seed = 0) {
  const idx = Math.abs(Number(seed) || Date.now()) % UNBLOCK_STRATEGIES.length;
  return UNBLOCK_STRATEGIES[idx];
}

export function pickPhrase(category, seed = 0) {
  const pool = PHRASES[category] || [];
  if (!pool.length) return "";
  const idx = Math.abs(Number(seed) || Date.now()) % pool.length;
  return pool[idx];
}

// Objetivos típicos por área (para sugerencias y reconocimiento de intención)
export const TYPICAL_GOALS = {
  music: ["Tocar una canción específica", "Mejorar técnica", "Aprender desde cero", "Preparar una presentación", "Mejorar lectura musical", "Componer o crear", "Tocar en grupo"],
  canto: ["Afinar mejor", "Perder la pena", "Respirar mejor", "Ampliar registro", "Cantar y acompañarse"],
  danza: ["Mejorar coordinación", "Memorizar coreografías", "Ganar expresión", "Preparar presentación", "Ganar confianza corporal"],
  plastica: ["Dibujar desde cero", "Mejorar observación", "Soltar la mano", "Aprender proporción", "Desarrollar estilo propio"],
  teatro: ["Perder la pena", "Hablar más fuerte", "Construir personajes", "Improvisar", "Actuar con intención"],
};

// Detecta retos específicos mencionados por el estudiante para diagnosticar mejor
export function detectChallengeHint(text = "") {
  const t = text.toLowerCase();
  if (/acord|cambio.*acord/.test(t)) return "cambios de acordes";
  if (/afina|desafin/.test(t)) return "afinación";
  if (/ritm|pulso|tempo|metr/.test(t)) return "ritmo y pulso";
  if (/respir/.test(t)) return "respiración";
  if (/postur/.test(t)) return "postura";
  if (/memori|olvido|olvid/.test(t)) return "memoria";
  if (/coordin/.test(t)) return "coordinación";
  if (/letra/.test(t)) return "letra";
  if (/lectura|partitur|leer/.test(t)) return "lectura";
  if (/velocidad|rapid|rápid|lento/.test(t)) return "velocidad/tempo";
  if (/escenario|presenta|publico|público|nervio/.test(t)) return "presencia escénica";
  return "";
}
