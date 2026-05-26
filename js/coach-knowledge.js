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

const strip = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function getInstrumentKnowledge(instrument = "") {
  const norm = strip(instrument);
  for (const key of Object.keys(INSTRUMENT_KNOWLEDGE)) {
    const data = INSTRUMENT_KNOWLEDGE[key];
    if (data.keywords.some((k) => norm.includes(strip(k)))) {
      return { key, ...data };
    }
  }
  // Fallback: "Guitarra" sola → acústica; "guitarra eléctrica" ya matchea arriba.
  if (norm.includes("guitarra")) return { key: "guitarraAcustica", ...INSTRUMENT_KNOWLEDGE.guitarraAcustica };
  return { key: "general", ...DEFAULT_TIPS };
}

// ============================================================
// SMALL-TALK: saludos, identidad, despedidas, agradecimientos.
// ============================================================

export function detectSmalltalk(text = "") {
  const t = strip(text).trim();
  if (!t) return "";
  if (/^(hola|holi|holis|buen[oa]s|saludos|que tal|ey|hey|hi+|hello)\b/.test(t)) return "greeting";
  if (/(como te llamas|quien eres|que eres|tu nombre|cual es tu nombre|de donde vienes|que haces aqui)/.test(t)) return "identity";
  if (/^(gracias|grax|thanks|thx|muchas gracias|mil gracias|te agradezco)\b/.test(t)) return "thanks";
  if (/^(adios|chao|chau|nos vemos|hasta luego|hasta pronto|me voy|bye)\b/.test(t)) return "bye";
  if (/(como estas|que tal estas|todo bien)/.test(t)) return "howareyou";
  return "";
}

export const SMALLTALK_RESPONSES = {
  greeting: {
    title: "¡Hola!",
    body: "Hola 👋 Soy MusiCoach. ¿En qué te ayudo hoy?\n\nPuedo:\n• Armarte una rutina de práctica.\n• Explicarte un concepto musical.\n• Darte ejercicios para algo específico (velocidad, acordes, ritmo, afinación...).\n• Ayudarte si algo no te sale o estás bloqueado/a.\n\nTambién puedes contarme qué te está costando y vemos juntos.",
  },
  identity: {
    title: "Te cuento quién soy",
    body: "Soy **MusiCoach**, el asistente pedagógico de práctica de **Musicala**. Mi trabajo es acompañarte entre clase y clase: organizar tu práctica, explicarte cosas, proponerte ejercicios y ayudarte cuando algo se traba.\n\nUso lo que sabemos de ti (instrumento, nivel, ruta, objetivos, sesiones y autoevaluaciones) para darte respuestas que tengan sentido en TU proceso, no recetas genéricas.",
  },
  thanks: {
    title: "Con gusto",
    body: "Con gusto 🎵 Cuando quieras seguir, aquí estoy. Recuerda: un minuto de práctica con intención vale más que una hora distraída.",
  },
  bye: {
    title: "Nos vemos",
    body: "Nos vemos. Antes de cerrar, hazte una pregunta corta: ¿qué UNA cosa quieres haber mejorado para la próxima clase? Escríbela y vuelve a ella mañana.",
  },
  howareyou: {
    title: "Aquí estamos",
    body: "Aquí estoy, listo para acompañarte. ¿Cómo llegas tú? ¿Con energía, cansado/a, con dudas, con ganas de retarte? Cuéntame y ajustamos la práctica de hoy a eso.",
  },
};

// ============================================================
// TOPICS: contenido pedagógico real por concepto musical.
// Aquí MusiCoach se vuelve útil de verdad cuando preguntan
// "explícame X" o "cómo mejoro Y" o "ejercicios para Z".
// ============================================================

export const TOPICS = {
  velocidad: {
    keywords: ["velocidad", "rapidez", "rapido", "tempo", "speed", "agilidad"],
    title: "Cómo mejorar velocidad",
    short: "La velocidad NO se entrena tocando rápido. Se entrena tocando LENTO y limpio, y subiendo BPM solo cuando ya sale sin error.",
    explanation: "Si tocas rápido lo que aún no dominas, repites el error a más velocidad y el cerebro lo memoriza mal. La velocidad limpia es consecuencia de la precisión sostenida, no del esfuerzo.",
    exercises: [
      "Metrónomo a 60 BPM. Toca el pasaje LIMPIO 5 veces seguidas. Si fallas, NO subes BPM.",
      "Cuando logres las 5 limpias, sube 4 BPM y repite.",
      "Trabaja por células de 2-4 notas, no la frase entera.",
      "Alterna: 1 min muy lento + 30 seg al tempo objetivo + 1 min lento otra vez.",
      "Grábate al tempo objetivo y escucha si suena LIMPIO o solo rápido.",
    ],
    rule: "Si suena sucio al tempo, baja BPM. Punto.",
  },
  patrones: {
    keywords: ["patron", "patrones", "pattern", "secuencia"],
    title: "Cómo aprender patrones",
    short: "Un patrón se domina entendiendo su lógica primero, no memorizándolo de oído.",
    explanation: "Un patrón es una secuencia que se repite. Para internalizarlo: identifica el orden, cántalo o dilo en voz alta, hazlo MUY lento separando partes, y luego únelas. Solo cuando tu cuerpo lo conoce, agregas velocidad y variaciones.",
    exercises: [
      "Escribe el patrón en una hoja (notas, números o golpes).",
      "Cántalo o dilo en voz alta sin tocar.",
      "Tócalo en partes (primera mitad sola, segunda mitad sola).",
      "Únelo MUY lento, sin metrónomo, sintiendo cada paso.",
      "Cuando salga 3 veces seguidas limpio, métele metrónomo a 60 BPM.",
      "Aplícalo en una canción que conozcas para que no se quede en ejercicio aislado.",
    ],
    rule: "Si no lo puedes cantar, no lo puedes tocar bien.",
  },
  acordes: {
    keywords: ["acorde", "acordes", "chord"],
    title: "Cómo trabajar acordes",
    short: "Un acorde no es solo poner los dedos: es que SUENEN las cuerdas correctas con claridad.",
    explanation: "Un acorde bien tocado se reconoce porque cada nota suena limpia, ninguna queda apagada y los dedos no presionan más de lo necesario. La forma se aprende; la limpieza se entrena.",
    exercises: [
      "Pisa el acorde y rasguea cuerda por cuerda. Si una suena apagada, ajusta ese dedo.",
      "Mantén el acorde 10 segundos sin tocar y revisa que no haya tensión en la mano.",
      "Quita los dedos y vuelve a ponerlos, buscando aterrizar todos a la vez.",
      "Practica el acorde aislado 10 veces antes de meterlo a una canción.",
    ],
    rule: "Si suena sucio, el problema casi nunca es 'falta de fuerza': suele ser posición del dedo o pulgar mal puesto detrás del mástil.",
  },
  cambiosAcordes: {
    keywords: ["cambio de acorde", "cambios de acorde", "cambiar acorde", "transicion entre acordes"],
    title: "Cómo agilizar cambios de acordes",
    short: "Los cambios mejoran cuando entrenas la TRANSICIÓN, no los acordes por separado.",
    explanation: "El problema rara vez es el acorde A o el acorde B: es el medio segundo entre ellos. Esa transición se entrena aislada, lenta y con muchas repeticiones.",
    exercises: [
      "Toma solo DOS acordes. Cámbialos sin rasguear, lento, 20 veces seguidas.",
      "Busca el 'dedo guía': uno que se pueda mantener o moverse en línea recta entre los dos acordes.",
      "Cambia al ritmo de un metrónomo lento (60 BPM): rasgueo - cambio en 1 tiempo - rasgueo.",
      "Aumenta velocidad solo cuando el cambio salga limpio 8-10 veces sin falla.",
      "Después agrega un tercer acorde y repite el proceso.",
    ],
    rule: "Mejor 2 acordes que cambien limpios que 5 que cambien sucios.",
  },
  escalas: {
    keywords: ["escala", "escalas", "scale"],
    title: "Cómo practicar escalas",
    short: "Las escalas no son ejercicio aburrido: son el vocabulario musical. Sin escalas no hay improvisación ni comprensión melódica.",
    explanation: "Una escala se interioriza cuando puedes (1) tocarla sin pensar, (2) cantarla, (3) reconocerla cuando suena y (4) usarla para crear una frase corta.",
    exercises: [
      "Toca la escala lenta, dos veces seguidas, sin parar entre subida y bajada.",
      "Cántala mientras la tocas.",
      "Toca en tercios: 1-3, 2-4, 3-5, 4-6... entrena el oído melódico.",
      "Crea una frase corta de 4-6 notas usando solo las notas de la escala.",
      "Tócala con metrónomo a 60 BPM, una nota por click. Luego dos notas por click.",
    ],
    rule: "Una escala que no puedes cantar todavía no está aprendida.",
  },
  rasgueo: {
    keywords: ["rasgueo", "rasguear", "strumming", "punteo de rasgueo"],
    title: "Cómo mejorar el rasgueo",
    short: "El rasgueo es ritmo + muñeca relajada, no fuerza del brazo.",
    explanation: "Un buen rasgueo se siente: la muñeca va suelta como un péndulo, el brazo apenas se mueve, y el patrón se mantiene aunque cambies de acorde.",
    exercises: [
      "Apaga las cuerdas con la mano izquierda y rasguea solo el patrón rítmico, sin acordes.",
      "Cuenta en voz alta: '1 y 2 y 3 y 4 y' mientras rasgueas.",
      "Mantén la mano derecha en movimiento constante (péndulo), aunque no toques todas las pasadas.",
      "Cuando el patrón salga sin pensar, súmale UN acorde fijo.",
      "Después agrega cambios de acordes manteniendo el patrón.",
    ],
    rule: "Si pierdes el patrón al cambiar de acorde, simplifica el ritmo antes de añadir más acordes.",
  },
  digitacion: {
    keywords: ["digitacion", "fingering", "dedos"],
    title: "Cómo trabajar digitación",
    short: "La digitación correcta ahorra movimiento y previene tensión.",
    explanation: "Cada dedo tiene un rol; cambiar la digitación cada vez genera caos. Define una digitación, márcala y practícala siempre igual hasta que sea automática.",
    exercises: [
      "Escribe los números de dedos sobre la partitura o tablatura.",
      "Toca muy lento revisando que cada dedo cae donde decidiste.",
      "Si un dedo se cansa o se traba, revisa si el codo o muñeca están torcidos.",
      "Repite el fragmento 5 veces con la misma digitación, sin cambiar.",
    ],
    rule: "Digitación clara hoy = velocidad limpia mañana.",
  },
  pua: {
    keywords: ["pua", "plumilla", "pick", "pajuela"],
    title: "Cómo trabajar la púa",
    short: "Sostén la púa firme pero relajado: ni floja ni tensa.",
    explanation: "La púa se toma entre el pulgar y el lado del índice, sale poco material (3-5 mm), y el movimiento viene de la muñeca, no del codo.",
    exercises: [
      "Toca una sola cuerda alternando abajo-arriba con metrónomo lento.",
      "Apóyate ligeramente con el meñique en la guitarra para tener punto fijo.",
      "Practica triadas de 3 notas alternando púa.",
      "Si la púa se te resbala, no la aprietes más; revisa el ángulo de la mano.",
    ],
    rule: "Si los dedos se tensan, la culpa suele ser la púa.",
  },
  afinacion: {
    keywords: ["afina", "afinacion", "desafin", "tuning"],
    title: "Cómo trabajar la afinación",
    short: "La afinación es 50% del instrumento y 100% de la escucha.",
    explanation: "Afinar bien no es solo usar el afinador: es entrenar el oído para reconocer cuándo algo está alto o bajo. En canto y violín además depende de cómo apoyas y colocas.",
    exercises: [
      "Afina con afinador y luego intenta afinar de oído comparando con la 5a cuerda.",
      "Toca una nota, ciérrate los ojos y reprodúcela con la voz.",
      "En canto/violín: empieza por intervalos pequeños (segundas, terceras) antes de saltos grandes.",
      "Grábate y escucha sin juicio: ¿dónde te subes o bajas?",
    ],
    rule: "Tu oído mejora cuando lo entrenas a propósito, no solo tocando.",
  },
  lectura: {
    keywords: ["leer", "lectura", "partitura", "leer musica", "lectura musical"],
    title: "Cómo mejorar la lectura musical",
    short: "Leer música es como leer letras: empieza por sílabas (figuras y notas), luego frases, luego canciones.",
    explanation: "La lectura mejora con poco-pero-diario. 10 minutos al día durante 30 días valen más que 2 horas el domingo.",
    exercises: [
      "Reconoce 5 notas sin instrumento, solo mirando partitura, en menos de 10 segundos cada una.",
      "Lee SOLO el ritmo (palmas) antes de tocar las notas.",
      "Lee piezas un nivel por DEBAJO del tuyo: la lectura se entrena con cantidad, no con dificultad.",
      "No mires las manos. Mira la partitura. Si fallas, vuelve atrás.",
    ],
    rule: "La lectura se entrena leyendo cosas fáciles, no peleando con cosas difíciles.",
  },
  improvisacion: {
    keywords: ["improvis", "solo", "improvisar"],
    title: "Cómo empezar a improvisar",
    short: "Improvisar no es 'tocar cualquier cosa': es decir algo con un vocabulario que ya conoces.",
    explanation: "Improvisar limpio empieza con poco material: una escala, un par de ritmos, una intención. La libertad viene después.",
    exercises: [
      "Toma 3 notas de una escala y crea 10 frases distintas con SOLO esas 3 notas.",
      "Improvisa sobre un acorde (1 minuto) usando solo blancas y negras.",
      "Imita un solo corto de tu artista favorito, nota por nota, antes de inventar el tuyo.",
      "Graba 30 segundos tuyos improvisando y escucha qué te gusta para repetirlo.",
    ],
    rule: "Menos notas con intención > muchas notas al azar.",
  },
  postura: {
    keywords: ["postura", "posicion", "como sentarme", "como pararme"],
    title: "Postura correcta",
    short: "Buena postura = menos tensión, mejor sonido, menos dolor.",
    explanation: "La postura no es estética: es eficiencia. Cuello relajado, hombros bajos, espalda apoyada (si estás sentado), peso distribuido.",
    exercises: [
      "Antes de tocar, haz una revisión: cuello, hombros, codos, muñecas, espalda. ¿Algo está tenso? Suéltalo.",
      "Cada 5 minutos de práctica, suelta hombros y respira hondo.",
      "Grábate de perfil practicando. Verás si te encorvas o levantas los hombros.",
    ],
    rule: "Si te duele algo después de practicar, no es 'normal': revisa postura.",
  },
  respiracion: {
    keywords: ["respiracion", "respirar", "aire", "fuelle", "diafragm"],
    title: "Cómo trabajar la respiración",
    short: "Respirar bien no es 'inflar mucho': es controlar y sostener el aire.",
    explanation: "La respiración diafragmática (abdomen se expande, no los hombros) sostiene mejor el sonido y reduce tensión, sea cantando, tocando flauta o controlando los nervios.",
    exercises: [
      "Acostado/a, pon un libro en el abdomen. Inhala lento subiéndolo. Exhala despacio bajándolo.",
      "Inhala 4 segundos, retén 2, exhala 6. Repite 5 veces antes de cantar/tocar.",
      "Lee una frase en voz alta sin tomar aire en el medio. Si no alcanza, vuelve a empezar.",
    ],
    rule: "Si te quedas sin aire al final de la frase, planifica respiraciones antes, no después.",
  },
  ritmo: {
    keywords: ["ritmo", "pulso", "metronomo", "metrónomo", "tiempo", "compas"],
    title: "Cómo trabajar el ritmo",
    short: "El ritmo se siente primero en el cuerpo, después en el instrumento.",
    explanation: "Si no puedes palmear un ritmo, no podrás tocarlo bien. El metrónomo es tu mejor profesor de pulso (también el más honesto).",
    exercises: [
      "Palmea el ritmo antes de tocarlo. Si fallas palmeando, no lo intentes en el instrumento aún.",
      "Camina al pulso del metrónomo a 60 BPM.",
      "Subdivide en voz alta: '1 y 2 y 3 y 4 y' mientras tocas.",
      "Practica con el metrónomo en tiempos DÉBILES (2 y 4) para sentir mejor el groove.",
    ],
    rule: "Un buen ritmo lento es mejor que un ritmo rápido acelerado.",
  },
  memoria: {
    keywords: ["memori", "olvid", "no me acuerdo", "memorizar"],
    title: "Cómo memorizar una pieza",
    short: "Memorizar no es repetir muchas veces: es construir 'agarraderas' mentales.",
    explanation: "Memoria muscular + memoria visual + memoria auditiva + memoria estructural. Si solo tienes una, te quedas en blanco. Si tienes las cuatro, la pieza es tuya.",
    exercises: [
      "Divide la pieza en secciones cortas. Aprende cada una por separado.",
      "Toca sin mirar las manos.",
      "Toca con los ojos cerrados.",
      "Empieza la pieza desde compases distintos (no siempre desde el principio).",
      "Cántala o tararea entera sin tocar.",
    ],
    rule: "Si solo puedes empezar desde el inicio, no la tienes memorizada.",
  },
  oido: {
    keywords: ["oido", "sacar de oido", "transcribir", "oido musical"],
    title: "Cómo entrenar el oído",
    short: "El oído mejora cuando lo usas a propósito, no solo escuchando música de fondo.",
    explanation: "Entrenar el oído es comparar lo que oyes con lo que sabes nombrar. Empieza con intervalos pequeños y canciones simples.",
    exercises: [
      "Saca de oído canciones de tu artista favorito, una nota a la vez.",
      "Compara intervalos: do-re, do-mi, do-sol. Aprende a reconocerlos.",
      "Canta una nota, tócala en el instrumento. ¿Coincidieron?",
      "Identifica el primer acorde de canciones que escuches en tu día.",
    ],
    rule: "El oído musical no es talento: es horas de comparar con atención.",
  },
  nervios: {
    keywords: ["nervio", "miedo escenico", "presenta", "publico", "ansiedad"],
    title: "Cómo manejar nervios escénicos",
    short: "Los nervios no se quitan: se entrenan. La meta no es no sentirlos, es saber tocar A PESAR de sentirlos.",
    explanation: "El cuerpo activa adrenalina cuando algo importa. Esa adrenalina es útil si la canalizas; si la peleas, te bloquea.",
    exercises: [
      "Practica tu pieza HABLANDO antes (cuenta a alguien qué va a pasar en cada parte).",
      "Tócala para una persona antes de tocar para muchas.",
      "Practica la entrada y el cierre 5 veces seguidas: son los puntos más vulnerables.",
      "Antes de salir: 3 respiraciones profundas, hombros sueltos, una sonrisa breve (cambia la química).",
    ],
    rule: "Si te tiembla la mano, no la pelees: respira y dale el primer compás más lento de lo que quisieras.",
  },
};

export function detectTopic(text = "") {
  const t = strip(text);
  if (!t) return null;
  for (const key of Object.keys(TOPICS)) {
    const topic = TOPICS[key];
    if (topic.keywords.some((k) => t.includes(strip(k)))) {
      return { key, ...topic };
    }
  }
  return null;
}

// Detecta si la pregunta es del tipo "ejercicios para X" o "cómo mejorar X"
export function isExerciseRequest(text = "") {
  const t = strip(text);
  return /ejercici|como mejor|como practic|tips para|recomenda|que hago para/.test(t);
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
