import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import { GoogleGenAI } from "@google/genai";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

// Types
interface CompanyProfile {
  legalName: string;
  industry: string;
  headcount: number;
  riskLevel: string;
  hasContractors: boolean;
  sites: string[];
  administrator: string;
}

interface NormUpdate {
  id: string;
  title: string;
  source: string;
  category: string;
  publishedAt: string;
  effectiveAt: string;
  impactLevel: string;
  status: string;
  summary: string;
  applicabilityReason: string;
  officialUrl: string;
  keyPoints: string[];
}

interface WatchRequest {
  id: string;
  topic: string;
  normalizedTopic: string;
  origin: string;
  status: string;
  createdAt: string;
  lastMatchedUpdateId: string | null;
}

interface AppState {
  companyProfile: CompanyProfile;
  updates: NormUpdate[];
  obligations: any[];
  documents: any[];
  scanEvents: any[];
  ingestionRuns: any[];
  watchRequests: WatchRequest[];
}

interface AIUsageLog {
  date: string;
  requestCount: number;
  lastUsedAt: string;
}

// AI Configuration
const AI_DAILY_LIMIT = 20;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
let aiUsageLog: AIUsageLog = { date: "", requestCount: 0, lastUsedAt: "" };

function initGemini() {
  if (!ai && GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
}

function checkAILimit(): { canUse: boolean; remaining: number; resetsAt: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (aiUsageLog.date !== today) {
    aiUsageLog = { date: today, requestCount: 0, lastUsedAt: "" };
  }
  const remaining = Math.max(0, AI_DAILY_LIMIT - aiUsageLog.requestCount);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return { canUse: remaining > 0, remaining, resetsAt: tomorrow.toISOString() };
}

function recordAIUsage() {
  aiUsageLog.requestCount++;
  aiUsageLog.lastUsedAt = new Date().toISOString();
}

async function callGemini(prompt: string): Promise<string> {
  if (!ai) {
    initGemini();
    if (!ai) throw new Error("GEMINI_API_KEY no configurada");
  }
  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });
  return result.text ?? "";
}

// Data
const industryOptions = [
  { value: "mineria", label: "Minería", suggestedTopics: ["polvo sílice", "ruido ocupacional", "trabajo en altura", "fatiga y turnos"] },
  { value: "construccion", label: "Construcción", suggestedTopics: ["trabajo en altura", "excavaciones", "andamios", "subcontratación"] },
  { value: "logistica", label: "Logística y bodegas", suggestedTopics: ["manejo manual de cargas", "grúas horquilla", "tránsito interno", "ergonomía"] },
  { value: "manufactura", label: "Manufactura", suggestedTopics: ["bloqueo y etiquetado", "guardas de máquinas", "sustancias peligrosas", "ruido ocupacional"] },
  { value: "salud", label: "Salud", suggestedTopics: ["riesgo biológico", "manejo de residuos", "agresiones externas", "fatiga y turnos"] },
  { value: "retail", label: "Retail", suggestedTopics: ["ergonomía", "violencia de terceros", "manejo manual de cargas", "emergencias"] },
];

const sourceAdapters = [
  { code: "BCN", label: "Biblioteca del Congreso Nacional", officialUrl: "https://www.bcn.cl", remoteUrl: "https://www.bcn.cl/leychile/navegar?idNorma=167766", coverage: "Leyes, decretos y reglamentos base", mode: "snapshot", category: "Condiciones sanitarias", keywords: ["seguridad", "salud", "trabajo", "higiene", "subcontrat"], items: [{ id: "upd-ds-594", title: "DS 594: condiciones sanitarias y ambientales básicas en lugares de trabajo", source: "BCN", category: "Condiciones sanitarias", publishedAt: "1999-09-15", effectiveAt: "2000-01-01", impactLevel: "alto", status: "monitoreado", summary: "Regula ventilación, servicios higiénicos, agua potable, iluminación, agentes físicos y condiciones mínimas de higiene industrial.", applicabilityReason: "Aplica a todos los centros de trabajo informados por la empresa y es base de fiscalización sanitaria.", officialUrl: "https://www.bcn.cl/leychile/navegar?idNorma=167766", keyPoints: ["Todo centro debe contar con servicios higiénicos adecuados.", "Las condiciones ambientales deben evaluarse y controlarse.", "La evidencia operativa es fiscalizable en terreno."] }, { id: "upd-reglamento-subcontratacion", title: "Refuerzo del deber de coordinación preventiva en trabajo en régimen de subcontratación", source: "BCN", category: "Subcontratación", publishedAt: "2026-04-18", effectiveAt: "2026-04-18", impactLevel: "medio", status: "nuevo", summary: "El snapshot de BCN prioriza obligaciones de coordinación entre empresa principal, contratistas y subcontratistas para control de riesgos.", applicabilityReason: "Aplica cuando la empresa declara subcontratación y mantiene más de un centro de trabajo con terceros.", officialUrl: "https://www.bcn.cl", keyPoints: ["Debe existir coordinación de riesgos y responsabilidades.", "Se requiere trazabilidad de inducciones y controles compartidos.", "La documentación preventiva debe ser exigible a contratistas."] }] },
  { code: "SUSESO", label: "Superintendencia de Seguridad Social", officialUrl: "https://www.suseso.cl/613/w3-propertyvalue-68955.html", remoteUrl: "https://www.suseso.cl/613/w3-propertyvalue-68955.html", coverage: "Compendio, dictámenes y obligaciones preventivas", mode: "snapshot", category: "Gestión preventiva", keywords: ["seguridad", "salud", "trabajo", "comité", "prevención"], items: [{ id: "upd-ley-16744", title: "Ley 16.744 y obligaciones preventivas del empleador", source: "SUSESO", category: "Gestión preventiva", publishedAt: "1968-02-01", effectiveAt: "1968-05-01", impactLevel: "alto", status: "en_revision", summary: "Consolida deberes de prevención, implementación de medidas, entrega de elementos de protección y coordinación con el organismo administrador.", applicabilityReason: "Aplica por ser entidad empleadora adherida a organismo administrador y por exposición a riesgos operacionales.", officialUrl: "https://www.suseso.cl/613/w3-propertyvalue-68955.html", keyPoints: ["Debe implementarse la gestión preventiva prescrita por normativa y organismo administrador.", "El empleador debe proveer elementos de protección personal sin costo.", "Se requiere seguimiento formal de medidas correctivas."] }, { id: "upd-comite-paritario", title: "Refuerzo de obligaciones sobre Comité Paritario y trazabilidad de acuerdos", source: "SUSESO", category: "Gobernanza SST", publishedAt: "2026-04-18", effectiveAt: "2026-04-18", impactLevel: "medio", status: "nuevo", summary: "Se detecta criterio que refuerza la necesidad de registrar acuerdos, investigaciones y medidas adoptadas por el Comité Paritario.", applicabilityReason: "La empresa supera 25 trabajadores y requiere verificar constitución, funcionamiento y respaldo de actas.", officialUrl: "https://www.suseso.cl/613/w3-propertyvalue-69075.html", keyPoints: ["Deben mantenerse actas y seguimiento de acuerdos.", "El comité participa en investigación y vigilancia preventiva.", "La evidencia documental debe estar disponible en fiscalización."] }] },
  { code: "DT", label: "Dirección del Trabajo", officialUrl: "https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-192736.html", remoteUrl: "https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-194680.html", coverage: "Dictámenes, procedimientos y criterios laborales", mode: "snapshot", category: "Seguridad en el trabajo", keywords: ["seguridad", "salud", "trabajo", "acoso", "violencia", "protección"], items: [{ id: "upd-ley-karin", title: "Ley Karin y procedimiento de investigación por acoso, violencia y riesgos psicosociales", source: "DT", category: "Riesgos psicosociales", publishedAt: "2025-06-03", effectiveAt: "2024-08-01", impactLevel: "alto", status: "nuevo", summary: "La Dirección del Trabajo refuerza plazos y reglas del procedimiento de investigación, y exige medidas de resguardo y protocolos preventivos actualizados.", applicabilityReason: "Aplica porque la empresa cuenta con trabajadores dependientes, reglamento interno y obligación de prevención frente a acoso y violencia en el trabajo.", officialUrl: "https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-192736.html", keyPoints: ["Debe existir protocolo preventivo comunicado a toda la organización.", "Las investigaciones tienen plazos reglados y requieren resguardo documentado.", "Las medidas deben integrarse al reglamento interno o protocolo equivalente."] }] },
  { code: "MINSAL", label: "Ministerio de Salud", officialUrl: "https://www.minsal.cl", remoteUrl: "https://www.minsal.cl", coverage: "Regulación sanitaria y vigilancia ocupacional", mode: "snapshot", category: "Higiene ocupacional", keywords: ["salud", "trabajo", "ocupacional", "vigilancia", "riesgo"], items: [{ id: "upd-vigilancia-ambiental", title: "Ajuste de foco en vigilancia de agentes físicos y ambientales por centro de trabajo", source: "MINSAL", category: "Higiene ocupacional", publishedAt: "2026-04-18", effectiveAt: "2026-04-18", impactLevel: "medio", status: "nuevo", summary: "El monitoreo diario levanta recordatorio regulatorio sobre evaluación de exposición a ruido, ventilación y condiciones de ambiente laboral.", applicabilityReason: "Aplica por existir bodegas y faenas con exposición operacional y por obligación general de control ambiental.", officialUrl: "https://www.minsal.cl", keyPoints: ["Debe existir programa de mediciones cuando el riesgo lo amerita.", "La evaluación debe vincularse al mapa de riesgos.", "La evidencia debe mantenerse por centro de trabajo."] }] },
  { code: "SEC", label: "Superintendencia de Electricidad y Combustibles", officialUrl: "https://www.sec.cl", remoteUrl: "https://www.sec.cl/centro-de-descargas/", coverage: "Normativa eléctrica, combustibles y seguridad técnica", mode: "snapshot", category: "Electricidad y combustibles", keywords: ["seguridad", "electric", "combustible", "gas", "instalacion", "norma"], items: [{ id: "upd-sec-decreto-109", title: "SEC: Reglamento de seguridad de las instalaciones eléctricas", source: "SEC", category: "Electricidad y combustibles", publishedAt: "2026-04-18", effectiveAt: "2026-04-18", impactLevel: "medio", status: "nuevo", summary: "La SEC mantiene normativa y pliegos técnicos relevantes para instalaciones eléctricas y seguridad operacional.", applicabilityReason: "Aplica cuando la empresa opera instalaciones eléctricas, estaciones de servicio, gas o actividades reguladas por SEC.", officialUrl: "https://www.sec.cl/decreto-n109-aprueba-reglamento-de-seguridad-de-las-instalaciones-electricas/", keyPoints: ["Existen requisitos técnicos de diseño, operación y mantenimiento.", "Puede haber impacto directo en combustibles e instalaciones.", "La empresa debe revisar exigencias sectoriales específicas."] }] },
  { code: "DO", label: "Diario Oficial", officialUrl: "https://www.diariooficial.interior.gob.cl", remoteUrl: "https://www.diariooficial.interior.gob.cl", coverage: "Publicación oficial de leyes, decretos y resoluciones", mode: "snapshot", category: "Publicación oficial", keywords: ["decreto", "ley", "resolución", "seguridad", "salud", "trabajo"], items: [{ id: "upd-do-publicacion-oficial", title: "Diario Oficial: publicación oficial de normas jurídicas", source: "DO", category: "Publicación oficial", publishedAt: "2026-04-18", effectiveAt: "2026-04-18", impactLevel: "medio", status: "monitoreado", summary: "El Diario Oficial es la fuente de publicación oficial para leyes, decretos y otras actuaciones jurídicas del Estado.", applicabilityReason: "Aplica para verificar vigencia y publicación oficial de cambios normativos relevantes en SST.", officialUrl: "https://www.diariooficial.interior.gob.cl/quienes-somos/", keyPoints: ["Permite confirmar publicación oficial de normas.", "Es clave para vigencia y trazabilidad jurídica.", "Debe usarse como control complementario de cambios."] }] },
];

// Seed state
const seedState: AppState = {
  companyProfile: { legalName: "Empresa Demo SST SpA", industry: "Servicios industriales y mantenimiento", headcount: 84, riskLevel: "III", hasContractors: true, sites: ["Casa Matriz Santiago", "Faena Antofagasta", "Bodega Renca"], administrator: "Mutual de Seguridad" },
  updates: sourceAdapters.flatMap(a => a.items).filter(item => ["upd-ley-karin", "upd-ds-594", "upd-ley-16744"].includes(item.id)),
  obligations: [
    { id: "obl-protocolo-karin", updateId: "upd-ley-karin", title: "Mantener protocolo de prevención y procedimiento de investigación vigente", area: "Personas y Cumplimiento", priority: "alto", applies: true, status: "en_progreso", basis: "Empresa con trabajadores dependientes y obligación de prevenir acoso, violencia y riesgos psicosociales.", howToComply: ["Actualizar el protocolo con medidas de prevención, denuncia, investigación y resguardo.", "Integrar o alinear el reglamento interno con el procedimiento vigente.", "Capacitar a jefaturas y registrar difusión a trabajadores."], evidence: ["Protocolo firmado y fechado.", "Registro de difusión y capacitaciones.", "Trazabilidad de denuncias y medidas de resguardo."], owner: "Gerencia de Personas", dueDate: "2026-05-15" },
    { id: "obl-inspeccion-ds594", updateId: "upd-ds-594", title: "Levantar matriz de condiciones sanitarias por centro de trabajo", area: "Operaciones", priority: "alto", applies: true, status: "pendiente", basis: "Todos los centros declarados requieren control verificable de higiene y ambiente laboral.", howToComply: ["Inspeccionar baños, agua potable, ventilación, iluminación y orden.", "Definir hallazgos, responsables y plazo de cierre por sede.", "Crear evidencia fotográfica y checklist trazable."], evidence: ["Checklist por sede.", "Plan de acción con fechas.", "Registros fotográficos y cierres."], owner: "Jefatura de Operaciones", dueDate: "2026-05-02" },
    { id: "obl-programa-preventivo", updateId: "upd-ley-16744", title: "Formalizar programa anual de trabajo preventivo con seguimiento", area: "Prevención de Riesgos", priority: "medio", applies: true, status: "en_progreso", basis: "La empresa presenta dotación, contratistas y operaciones con riesgo que exigen gestión preventiva documentada.", howToComply: ["Definir objetivos, responsables, frecuencia y KPI preventivos.", "Coordinar medidas con el organismo administrador.", "Registrar cumplimiento mensual y desviaciones."], evidence: ["Programa anual aprobado.", "Actas de seguimiento.", "Indicadores mensuales de ejecución."], owner: "Asesor SST", dueDate: "2026-05-20" },
  ],
  documents: [
    { id: "doc-matriz-legal", name: "Matriz legal SST", type: "Base maestra", status: "listo", linkedObligationIds: ["obl-protocolo-karin", "obl-inspeccion-ds594", "obl-programa-preventivo"], lastGeneratedAt: "2026-04-18T18:40:00.000Z", description: "Compila normas, criterios de aplicabilidad, responsables y evidencia esperada." },
    { id: "doc-plan-cierre", name: "Plan de cierre de brechas", type: "Plan de acción", status: "requiere_revision", linkedObligationIds: ["obl-inspeccion-ds594", "obl-programa-preventivo"], lastGeneratedAt: "2026-04-18T17:55:00.000Z", description: "Prioriza actividades y vencimientos según criticidad y estado." },
    { id: "doc-protocolo-karin", name: "Borrador protocolo Ley Karin", type: "Documento operativo", status: "faltante", linkedObligationIds: ["obl-protocolo-karin"], lastGeneratedAt: null, description: "Plantilla para prevención, denuncia e investigación interna." },
  ],
  scanEvents: [
    { id: "scan-1", executedAt: "2026-04-18T12:05:00.000Z", source: "SUSESO / DT / BCN", summary: "Escaneo inicial del día con 3 cambios priorizados y 2 obligaciones nuevas o reforzadas.", findings: 3 },
    { id: "scan-2", executedAt: "2026-04-17T12:00:00.000Z", source: "SUSESO", summary: "Sin cambios críticos; se mantuvo monitoreo de compendio preventivo.", findings: 1 },
  ],
  ingestionRuns: [],
  watchRequests: [{ id: "watch-default-1", topic: "ley karin", normalizedTopic: "ley karin", origin: "manual", status: "activo", createdAt: "2026-04-18T10:00:00.000Z", lastMatchedUpdateId: "upd-ley-karin" }],
};

// State management
const databaseUrl = process.env.DATABASE_URL;
let sql = databaseUrl ? neon(databaseUrl) : null;
let appState: AppState = structuredClone(seedState);
let initialized = false;

async function ensureDatabase() {
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS app_state (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS app_snapshots (source text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
}

async function loadStoredState(): Promise<AppState | null> {
  if (!sql) return null;
  await ensureDatabase();
  const rows = await sql`SELECT payload FROM app_state WHERE id = 'default' LIMIT 1`;
  return (rows[0] as { payload?: AppState } | undefined)?.payload ?? null;
}

async function saveStoredState(state: AppState) {
  if (!sql) return;
  await ensureDatabase();
  await sql`INSERT INTO app_state (id, payload, updated_at) VALUES ('default', ${JSON.stringify(state)}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
}

async function initializeService() {
  if (initialized) return;
  const loaded = await loadStoredState();
  if (loaded) appState = loaded;
  initialized = true;
}

function normalizeTopic(topic: string) {
  return topic.trim().toLowerCase();
}

function buildDashboard() {
  const applicable = appState.obligations.filter(o => o.applies);
  const urgent = applicable.filter(o => o.priority === "alto" && o.status !== "cumplido");
  const docsPending = appState.documents.filter(d => d.status !== "listo");
  const coverageRate = applicable.length === 0 ? 0 : Math.round((applicable.filter(o => o.status === "cumplido").length / applicable.length) * 100);

  return {
    generatedAt: new Date().toISOString(),
    companyProfile: appState.companyProfile,
    stats: { monitoredSources: sourceAdapters.length, totalUpdates: appState.updates.length, applicableObligations: applicable.length, urgentActions: urgent.length, pendingDocuments: docsPending.length, coverageRate },
    scheduler: { enabled: true, intervalMinutes: 1440, nextRunAt: new Date(Date.now() + 86400000).toISOString(), statePath: sql ? "postgres" : "memory" },
    sourceMonitors: sourceAdapters.map(a => ({ code: a.code, label: a.label, officialUrl: a.officialUrl, coverage: a.coverage, mode: a.mode, snapshotCount: a.items.length, lastRunAt: null, lastStatus: "idle" })),
    industryOptions,
    watchRequests: appState.watchRequests,
    updates: appState.updates,
    obligations: appState.obligations,
    documents: appState.documents,
    scanEvents: appState.scanEvents,
    ingestionRuns: appState.ingestionRuns.slice(0, 12),
    aiStatus: checkAILimit(),
  };
}

// AI Prompts
function buildPrompt(action: string, items: any[]): string {
  const companyInfo = `Empresa: ${appState.companyProfile.legalName}, Rubro: ${appState.companyProfile.industry}, Dotación: ${appState.companyProfile.headcount} trabajadores, Nivel de riesgo: ${appState.companyProfile.riskLevel}`;

  switch (action) {
    case "analyze":
      const updatesText = items.map((u, i) => `${i+1}. ${u.title} (${u.category}): ${u.summary}`).join("\n");
      return `Eres un asesor SST experto en normativa chilena. Analiza TODAS las siguientes normativas y responde en JSON:

{
  "analisis": [
    {"id": "id-de-la-norma", "aplicabilidad": "explica brevemente si aplica", "nivelImpacto": "alto/medio/bajo", "plazoRecomendado": "días/meses"},
    ...
  ],
  "resumenEjecutivo": "resumen de los hallazgos principales"
}

Normativas a analizar:
${updatesText}

Empresa: ${companyInfo}

Responde SOLO con JSON válido.`;

    case "summarize":
      const summaryText = items.map((u, i) => `${i+1}. ${u.title}\nCategoría: ${u.category}\nResumen: ${u.summary}\nPuntos clave: ${u.keyPoints?.join(", ") || "N/A"}\n---`).join("\n");
      return `Eres un asesor SST chileno. Resume TODAS las siguientes normativas en términos simples para trabajadores no técnicos:

${summaryText}

Para cada una incluye:
- ¿De qué se trata?
- ¿Qué debe hacer la empresa?
- ¿Qué pasa si no se cumple?

Sé conciso y usa lenguaje simple.`;

    case "recommend":
      const obligationsText = items.map((o, i) => `${i+1}. ${o.title}\nÁrea: ${o.area}\nBase legal: ${o.basis}\nEstado: ${o.status}\nResponsable: ${o.owner}\nVencimiento: ${o.dueDate}`).join("\n\n");
      return `Eres un asesor SST chileno. Para TODAS las siguientes obligaciones, sugiere:

${obligationsText}

Para cada una proporciona:
- 3-5 pasos específicos para cumplir
- 2-3 evidencias necesarias
- Responsable típico
- Plazo estimado

Responde en español de forma estructurada, numerando cada obligación y sus recomendaciones.`;

    case "generate":
      const generateText = items.map((o, i) => `${i+1}. ${o.title}\nÁrea: ${o.area}\nBase legal: ${o.basis}\nResponsable: ${o.owner}\nVencimiento: ${o.dueDate}`).join("\n\n");
      return `Eres un asesor SST chileno. Genera un PLAN DE ACCIÓN completo en formato markdown para cumplir con TODAS las siguientes obligaciones:

${generateText}
Empresa: ${companyInfo}

Para cada obligación incluye:
## [Número] - [Título]
### Objetivo
### Actividades (con responsables y plazos)
### Evidencias requeridas
### Checkpoints de verificación

Genera contenido práctico y accionable.`;

    default:
      throw new Error("Acción no válida");
  }
}

// DOCX Generator
async function generateObligationDOCX(obligation: any): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: "PLAN DE ACCIÓN SST", heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: obligation.title, heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ children: [new TextRun({ text: "Información General", bold: true })] }),
        new Paragraph({ text: `Área: ${obligation.area}` }),
        new Paragraph({ text: `Prioridad: ${obligation.priority}` }),
        new Paragraph({ text: `Estado: ${obligation.status}` }),
        new Paragraph({ text: `Responsable: ${obligation.owner}` }),
        new Paragraph({ text: `Vencimiento: ${obligation.dueDate}` }),
        new Paragraph({ text: `Base Legal: ${obligation.basis}` }),
        new Paragraph({ children: [new TextRun({ text: "", break: 1 })] }),
        new Paragraph({ children: [new TextRun({ text: "Cómo Cumplir", bold: true })] }),
        ...obligation.howToComply.map((step: string) => new Paragraph({ text: `- ${step}` })),
        new Paragraph({ children: [new TextRun({ text: "", break: 1 })] }),
        new Paragraph({ children: [new TextRun({ text: "Evidencias Requeridas", bold: true })] }),
        ...obligation.evidence.map((ev: string) => new Paragraph({ text: `- ${ev}` })),
      ],
    }],
  });
  return await Packer.toBuffer(doc);
}

// Express-like router
function route(req: VercelRequest, res: VercelResponse) {
  const { method, url } = req;
  const path = url?.split("?")[0] ?? "/";

  // Health
  if (path === "/api/health" && method === "GET") {
    return res.json({ status: "ok" });
  }

  // AI Status
  if (path === "/api/ai-status" && method === "GET") {
    return res.json(checkAILimit());
  }

  // AI Analyze
  if (path === "/api/ai-analyze" && method === "POST") {
    const { canUse } = checkAILimit();
    if (!canUse) {
      return res.status(429).json({ error: "Límite diario de IA alcanzado", ...checkAILimit() });
    }

    return initializeService().then(async () => {
      try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        const { action } = body;

        if (!action || !["analyze", "summarize", "recommend", "generate"].includes(action)) {
          return res.status(400).json({ error: "Acción inválida. Use: analyze, summarize, recommend, generate" });
        }

        // Select items based on action
        let items: any[];
        let itemType: string;
        if (action === "analyze" || action === "summarize") {
          items = appState.updates;
          itemType = "normativas";
        } else {
          items = appState.obligations;
          itemType = "obligaciones";
        }

        if (items.length === 0) {
          return res.status(400).json({ error: `No hay ${itemType} para analizar` });
        }

        const prompt = buildPrompt(action, items);
        const result = await callGemini(prompt);

        recordAIUsage();

        return res.json({
          action,
          itemType,
          itemCount: items.length,
          result,
          usage: checkAILimit(),
          analyzedAt: new Date().toISOString(),
        });
      } catch (error: any) {
        return res.status(500).json({ error: error.message || "Error al procesar con IA" });
      }
    }).catch(err => res.status(500).json({ error: err.message }));
  }

  // Dashboard
  if (path === "/api/dashboard" && method === "GET") {
    return initializeService().then(() => res.json(buildDashboard())).catch(err => res.status(500).json({ error: err.message }));
  }

  // Sources
  if (path === "/api/sources" && method === "GET") {
    return initializeService().then(() => res.json({ generatedAt: new Date().toISOString(), sources: sourceAdapters.map(a => ({ code: a.code, label: a.label, officialUrl: a.officialUrl, coverage: a.coverage, mode: a.mode, snapshotCount: a.items.length, lastRunAt: null, lastStatus: "idle" })) })).catch(err => res.status(500).json({ error: err.message }));
  }

  // Scan
  if (path === "/api/scan" && method === "POST") {
    return initializeService().then(() => res.json(buildDashboard())).catch(err => res.status(500).json({ error: err.message }));
  }

  // Company Profile
  if (path === "/api/company-profile" && method === "POST") {
    return initializeService().then(async () => {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      appState.companyProfile = {
        legalName: String(body?.legalName ?? appState.companyProfile.legalName).trim(),
        industry: String(body?.industry ?? appState.companyProfile.industry).trim(),
        headcount: Number.isFinite(Number(body?.headcount)) ? Math.max(1, Number(body?.headcount)) : appState.companyProfile.headcount,
        riskLevel: String(body?.riskLevel ?? appState.companyProfile.riskLevel).trim(),
        hasContractors: Boolean(body?.hasContractors ?? appState.companyProfile.hasContractors),
        sites: Array.isArray(body?.sites) ? body.sites.map((s: string) => s.trim()).filter(Boolean) : appState.companyProfile.sites,
        administrator: String(body?.administrator ?? appState.companyProfile.administrator).trim(),
      };
      await saveStoredState(appState);
      res.json(buildDashboard());
    }).catch(err => res.status(500).json({ error: err.message }));
  }

  // Watch Requests
  if (path === "/api/watch-requests" && method === "POST") {
    return initializeService().then(async () => {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const topic = String(body?.topic ?? "").trim();
      if (!topic) return res.status(400).json({ error: "Tema inválido." });
      const normalizedTopic = normalizeTopic(topic);
      if (!appState.watchRequests.find(w => w.normalizedTopic === normalizedTopic)) {
        appState.watchRequests.unshift({ id: `watch-${Date.now()}-${normalizedTopic.replace(/\s+/g, "-")}`, topic, normalizedTopic, origin: "manual", status: "activo", createdAt: new Date().toISOString(), lastMatchedUpdateId: null });
        await saveStoredState(appState);
      }
      res.json(buildDashboard());
    }).catch(err => res.status(500).json({ error: err.message }));
  }

  if (path.startsWith("/api/watch-requests/") && method === "PATCH") {
    return initializeService().then(async () => {
      const id = path.split("/")[3];
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const status = body?.status;
      if (!status || !["activo", "cubierto", "en_revision"].includes(status)) return res.status(400).json({ error: "Estado inválido." });
      const watch = appState.watchRequests.find(w => w.id === id);
      if (!watch) return res.status(404).json({ error: "Solicitud no encontrada." });
      watch.status = status;
      await saveStoredState(appState);
      res.json(buildDashboard());
    }).catch(err => res.status(500).json({ error: err.message }));
  }

  // Obligations
  if (path.startsWith("/api/obligations/") && method === "PATCH") {
    return initializeService().then(async () => {
      const id = path.split("/")[3];
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const status = body?.status;
      if (!status || !["pendiente", "en_progreso", "cumplido"].includes(status)) return res.status(400).json({ error: "Estado inválido." });
      const obligation = appState.obligations.find(o => o.id === id);
      if (!obligation) return res.status(404).json({ error: "Obligación no encontrada." });
      obligation.status = status;
      await saveStoredState(appState);
      res.json(buildDashboard());
    }).catch(err => res.status(500).json({ error: err.message }));
  }

  // Export
  if (path === "/api/export" && method === "GET") {
    return initializeService().then(() => {
      res.setHeader("Content-Disposition", `attachment; filename="radar-sst-state-${new Date().toISOString().slice(0, 10)}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.json(appState);
    }).catch(err => res.status(500).json({ error: err.message }));
  }

  // Document Generation (DOCX)
  if (path.match(/^\/api\/documents\/[^/]+\/generate$/) && method === "POST") {
    return initializeService().then(async () => {
      const parts = path.split("/");
      const docId = parts[2];
      const document = appState.documents.find(d => d.id === docId);
      if (!document) return res.status(404).json({ error: "Documento no encontrado." });

      try {
        const buffer = await generateObligationDOCX({
          title: document.name,
          area: document.type,
          priority: "N/A",
          status: document.status,
          basis: document.description,
          howToComply: ["Revisar documento en plataforma", "Actualizar según necesidades", "Validar con responsables"],
          evidence: ["Documento revisado", "Firmas de aprobación"],
          owner: appState.companyProfile.legalName,
          dueDate: document.lastGeneratedAt || new Date().toISOString(),
        });

        res.setHeader("Content-Disposition", `attachment; filename="${document.name.replace(/\s+/g, "-")}.docx"`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.send(buffer);
      } catch (error: any) {
        return res.status(500).json({ error: error.message });
      }
    }).catch(err => res.status(500).json({ error: err.message }));
  }

  // Reset
  if (path === "/api/reset" && method === "POST") {
    return initializeService().then(async () => {
      appState = structuredClone(seedState);
      await saveStoredState(appState);
      res.json(buildDashboard());
    }).catch(err => res.status(500).json({ error: err.message }));
  }

  res.status(404).json({ error: "Not found" });
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  initializeService().then(() => route(req, res)).catch(err => res.status(500).json({ error: err.message }));
}
