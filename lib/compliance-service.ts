import { industryOptions } from "../data/industries";
import { seedState } from "../data/seed";
import { sourceAdapters } from "../data/sources";
import type {
  AppState,
  CompanyProfile,
  DashboardResponse,
  IngestionRun,
  NormUpdate,
  Obligation,
  SourceMonitor,
  WatchRequest,
  WatchRequestStatus,
} from "../src/types";
import { getStatePath, initializeStorage, loadStoredState, saveSnapshot, saveStoredState } from "./state-store";

const scanIntervalMinutes = Number(process.env.SCAN_INTERVAL_MINUTES ?? 1440);
const remoteFetchEnabled = process.env.REMOTE_FETCH_ENABLED !== "false";

let appState: AppState = structuredClone(seedState);
let initialized = false;
let nextRunAt = new Date(Date.now() + scanIntervalMinutes * 60_000).toISOString();

function normalizeTopic(topic: string) {
  return topic.trim().toLowerCase();
}

function normalizeState(input: Partial<AppState>): AppState {
  return {
    companyProfile: input.companyProfile ?? structuredClone(seedState.companyProfile),
    updates: input.updates ?? [],
    obligations: input.obligations ?? [],
    documents: input.documents ?? [],
    scanEvents: input.scanEvents ?? [],
    ingestionRuns: input.ingestionRuns ?? [],
    watchRequests: input.watchRequests ?? [],
  };
}

function matchesWatch(update: NormUpdate, watch: WatchRequest) {
  const haystack = normalizeTopic(
    [update.title, update.category, update.summary, update.applicabilityReason, ...update.keyPoints].join(" "),
  );
  return haystack.includes(watch.normalizedTopic);
}

function ensureWatchRequest(topic: string, origin: WatchRequest["origin"]) {
  const normalizedTopic = normalizeTopic(topic);
  if (!normalizedTopic) {
    return;
  }

  const existing = appState.watchRequests.find((item) => item.normalizedTopic === normalizedTopic);
  if (existing) {
    if (origin === "industry" && existing.origin === "manual") {
      return;
    }
    existing.status = existing.lastMatchedUpdateId ? "cubierto" : "activo";
    return;
  }

  const matchedUpdate = appState.updates.find((update) =>
    normalizeTopic([update.title, update.category, update.summary].join(" ")).includes(normalizedTopic),
  );

  appState.watchRequests.unshift({
    id: `watch-${Date.now()}-${normalizedTopic.replace(/\s+/g, "-")}`,
    topic: topic.trim(),
    normalizedTopic,
    origin,
    status: matchedUpdate ? "cubierto" : "activo",
    createdAt: new Date().toISOString(),
    lastMatchedUpdateId: matchedUpdate?.id ?? null,
  });
}

function syncIndustryWatchers(industry: string) {
  const normalizedIndustry = normalizeTopic(industry);
  const compactIndustry = normalizedIndustry.replace(/\s+/g, "");
  const option =
    industryOptions.find((item) => item.value === compactIndustry) ??
    industryOptions.find((item) => normalizeTopic(item.label) === normalizedIndustry);

  if (!option) {
    return;
  }

  for (const topic of option.suggestedTopics) {
    ensureWatchRequest(topic, "industry");
  }
}

function refreshWatchRequests() {
  appState.watchRequests = appState.watchRequests.map((watch) => {
    const matchedUpdate = appState.updates.find((update) => matchesWatch(update, watch));
    return {
      ...watch,
      status: matchedUpdate ? "cubierto" : watch.status === "en_revision" ? "en_revision" : "activo",
      lastMatchedUpdateId: matchedUpdate?.id ?? null,
    };
  });
}

function applyProfileRules(state: AppState): AppState {
  appState = state;
  syncIndustryWatchers(state.companyProfile.industry);
  refreshWatchRequests();

  const hasCommitteeDuty = state.companyProfile.headcount > 25;
  const hasContractors = state.companyProfile.hasContractors;

  const normalizedDocuments = state.documents.map((item) => {
    if (item.id === "doc-plan-cierre" && state.obligations.every((obligation) => obligation.status === "cumplido")) {
      return { ...item, status: "listo" as const };
    }
    return item;
  });

  const normalizedObligations = state.obligations.map((item) => {
    if (item.id === "obl-comite-paritario") {
      return {
        ...item,
        applies: hasCommitteeDuty,
        basis: hasCommitteeDuty
          ? "La dotación reportada exige verificar funcionamiento formal del comité."
          : "No aplica actualmente porque la dotación informada no supera 25 trabajadores.",
      };
    }

    if (item.id === "obl-subcontratacion") {
      return {
        ...item,
        applies: hasContractors,
        basis: hasContractors
          ? "La empresa declaró contratistas o subcontratistas y requiere coordinación preventiva."
          : "No aplica actualmente porque no se declaró trabajo en régimen de subcontratación.",
      };
    }

    return item;
  });

  return {
    ...state,
    obligations: normalizedObligations,
    documents: normalizedDocuments,
    watchRequests: appState.watchRequests,
  };
}

function computeStats(state: AppState) {
  const applicable = state.obligations.filter((item) => item.applies);
  const urgent = applicable.filter((item) => item.priority === "alto" && item.status !== "cumplido");
  const docsPending = state.documents.filter((item) => item.status !== "listo");

  return {
    monitoredSources: sourceAdapters.length,
    totalUpdates: state.updates.length,
    applicableObligations: applicable.length,
    urgentActions: urgent.length,
    pendingDocuments: docsPending.length,
    coverageRate:
      applicable.length === 0
        ? 0
        : Math.round((applicable.filter((item) => item.status === "cumplido").length / applicable.length) * 100),
  };
}

function buildSourceMonitors(state: AppState): SourceMonitor[] {
  return sourceAdapters.map((adapter) => {
    const lastRun = state.ingestionRuns.find((item) => item.source === adapter.code);
    return {
      code: adapter.code,
      label: adapter.label,
      officialUrl: adapter.officialUrl,
      coverage: adapter.coverage,
      mode: adapter.mode,
      snapshotCount: adapter.items.length,
      lastRunAt: lastRun?.executedAt ?? null,
      lastStatus: lastRun?.status ?? "idle",
    };
  });
}

function buildDashboardPayload(state: AppState): DashboardResponse {
  return {
    generatedAt: new Date().toISOString(),
    companyProfile: state.companyProfile,
    stats: computeStats(state),
    scheduler: {
      enabled: true,
      intervalMinutes: scanIntervalMinutes,
      nextRunAt,
      statePath: getStatePath(),
    },
    sourceMonitors: buildSourceMonitors(state),
    industryOptions,
    watchRequests: state.watchRequests,
    updates: state.updates,
    obligations: state.obligations,
    documents: state.documents,
    scanEvents: state.scanEvents,
    ingestionRuns: state.ingestionRuns.slice(0, 12),
  };
}

async function persistState() {
  await saveStoredState(appState);
}

async function registerScan(sourceLabel: string, summary: string, findings: number) {
  appState.scanEvents.unshift({
    id: `scan-${Date.now()}`,
    executedAt: new Date().toISOString(),
    source: sourceLabel,
    summary,
    findings,
  });
  appState = applyProfileRules(appState);
  await persistState();
}

async function registerIngestion(run: IngestionRun) {
  appState.ingestionRuns.unshift(run);
  appState.ingestionRuns = appState.ingestionRuns.slice(0, 40);
  await persistState();
}

function slugify(input: string) {
  return normalizeTopic(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function decodeHtml(input: string) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(input: string) {
  return decodeHtml(input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractRemoteItems(html: string, adapter: (typeof sourceAdapters)[number]): NormUpdate[] {
  const items: NormUpdate[] = [];
  const seen = new Set<string>();
  const anchorRegex = /<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gims;
  const genericFragments = [
    "inicio",
    "home",
    "portal",
    "historia",
    "quienes somos",
    "documentos ministerio",
    "servicios de salud",
    "multimedia",
    "contacto",
    "trámites",
    "tramites",
  ];

  const titleMatches = [...html.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gims)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
    .slice(0, 8);

  for (const title of titleMatches) {
    const haystack = normalizeTopic(title);
    if (!adapter.keywords.some((keyword) => haystack.includes(keyword))) {
      continue;
    }
    if (genericFragments.some((fragment) => haystack.includes(fragment))) {
      continue;
    }
    const id = `remote-${adapter.code.toLowerCase()}-${slugify(title)}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    items.push({
      id,
      title,
      source: adapter.code,
      category: adapter.category,
      publishedAt: new Date().toISOString().slice(0, 10),
      effectiveAt: new Date().toISOString().slice(0, 10),
      impactLevel: "medio",
      status: "nuevo",
      summary: `Hallazgo remoto detectado desde ${adapter.label}. Requiere revisión y clasificación fina.`,
      applicabilityReason: `Coincide con términos SST monitoreados para ${adapter.label}.`,
      officialUrl: adapter.remoteUrl,
      keyPoints: [
        "Hallazgo detectado por integración remota inicial.",
        "Debe validarse alcance regulatorio antes de accionar.",
        "El snapshot remoto quedó almacenado localmente o en BD.",
      ],
    });
  }

  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) && items.length < 6) {
    const href = match[1];
    const label = stripTags(match[2]);
    const haystack = normalizeTopic(label);
    if (!label || label.length < 24) {
      continue;
    }
    if (!adapter.keywords.some((keyword) => haystack.includes(keyword))) {
      continue;
    }
    if (genericFragments.some((fragment) => haystack.includes(fragment))) {
      continue;
    }
    const resolvedUrl = href.startsWith("http") ? href : new URL(href, adapter.remoteUrl).toString();
    const id = `remote-${adapter.code.toLowerCase()}-${slugify(label)}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    items.push({
      id,
      title: label,
      source: adapter.code,
      category: adapter.category,
      publishedAt: new Date().toISOString().slice(0, 10),
      effectiveAt: new Date().toISOString().slice(0, 10),
      impactLevel: "medio",
      status: "nuevo",
      summary: `Contenido SST identificado en enlace oficial de ${adapter.label}.`,
      applicabilityReason: "El texto remoto contiene palabras clave relacionadas con SST monitoreadas por el agente.",
      officialUrl: resolvedUrl,
      keyPoints: [
        "Extraído desde página oficial en modo remoto.",
        "Pendiente de clasificación jurídica más precisa.",
        "Disponible para cruce con temas vigilados.",
      ],
    });
  }

  return items;
}

function upsertGeneratedArtifacts(update: NormUpdate) {
  if (update.id === "upd-comite-paritario" && !appState.obligations.some((item) => item.id === "obl-comite-paritario")) {
    appState.obligations.unshift({
      id: "obl-comite-paritario",
      updateId: update.id,
      title: "Regularizar actas, acuerdos y plan de seguimiento del Comité Paritario",
      area: "Comité Paritario",
      priority: "medio",
      applies: appState.companyProfile.headcount > 25,
      status: "pendiente",
      basis: "La dotación reportada exige verificar funcionamiento formal del comité.",
      howToComply: [
        "Consolidar actas de constitución y sesiones.",
        "Crear registro de acuerdos con responsables y fechas.",
        "Vincular acuerdos con investigaciones y acciones correctivas.",
      ],
      evidence: ["Libro o repositorio de actas.", "Planilla de seguimiento.", "Firma o validación de integrantes."],
      owner: "Presidencia Comité Paritario",
      dueDate: "2026-05-30",
    });
  }

  if (update.id === "upd-vigilancia-ambiental" && !appState.documents.some((item) => item.id === "doc-plan-mediciones")) {
    appState.documents.unshift({
      id: "doc-plan-mediciones",
      name: "Programa de mediciones ambientales",
      type: "Programa técnico",
      status: "requiere_revision",
      linkedObligationIds: ["obl-inspeccion-ds594"],
      lastGeneratedAt: new Date().toISOString(),
      description: "Define matriz de agentes, mediciones requeridas, frecuencia y trazabilidad.",
    });
  }

  if (update.id === "upd-reglamento-subcontratacion" && !appState.obligations.some((item) => item.id === "obl-subcontratacion")) {
    appState.obligations.unshift({
      id: "obl-subcontratacion",
      updateId: update.id,
      title: "Formalizar coordinación preventiva con contratistas y subcontratistas",
      area: "Subcontratación",
      priority: "medio",
      applies: appState.companyProfile.hasContractors,
      status: "pendiente",
      basis: "La empresa declaró contratistas o subcontratistas y requiere coordinación preventiva.",
      howToComply: [
        "Definir estándar mínimo documental para empresas contratistas.",
        "Registrar inducciones, coordinación de riesgos y permisos de trabajo.",
        "Exigir evidencias SST por empresa y centro de trabajo.",
      ],
      evidence: ["Matriz de contratistas vigentes.", "Registros de inducción y coordinación.", "Control documental por proveedor."],
      owner: "Administrador de Contratos",
      dueDate: "2026-06-05",
    });
  }

  refreshWatchRequests();
}

async function ingestSource(source: (typeof sourceAdapters)[number]): Promise<IngestionRun> {
  const executedAt = new Date().toISOString();
  const knownIds = new Set(appState.updates.map((item) => item.id));
  let fetchedItems = source.items;
  let mode: "snapshot" | "remote" = "snapshot";
  let status: "ok" | "fallback" = "fallback";
  let note = "Se usó snapshot local del adaptador; falta integración remota.";

  if (remoteFetchEnabled) {
    try {
      const response = await fetch(source.remoteUrl, {
        headers: { "user-agent": "radar-sst-mvp/0.1", accept: "text/html,application/xhtml+xml" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const remoteItems = extractRemoteItems(html, source);
      if (remoteItems.length > 0) {
        fetchedItems = [...source.items, ...remoteItems];
      }
      mode = "remote";
      status = "ok";
      note = `Se consultó fuente remota y se almacenó snapshot (${remoteItems.length} item(s) remotos detectados).`;
      await saveSnapshot(source.code, "remote", source.remoteUrl, html.slice(0, 120000), remoteItems);
    } catch (error) {
      const snapshotContent = JSON.stringify({ fallback: true, reason: String(error), items: source.items }, null, 2);
      await saveSnapshot(source.code, "snapshot", source.remoteUrl, snapshotContent, source.items);
      note = `Falló fetch remoto y se usó snapshot local: ${error instanceof Error ? error.message : "error desconocido"}.`;
    }
  } else {
    const snapshotContent = JSON.stringify({ fallback: true, reason: "REMOTE_FETCH_ENABLED=false", items: source.items }, null, 2);
    await saveSnapshot(source.code, "snapshot", source.remoteUrl, snapshotContent, source.items);
    note = "Fetch remoto deshabilitado por configuración; se usó snapshot local.";
  }

  const freshItems = fetchedItems.filter((item) => !knownIds.has(item.id));
  for (const item of freshItems) {
    appState.updates.unshift(item);
    upsertGeneratedArtifacts(item);
  }

  const run: IngestionRun = {
    id: `ingest-${source.code}-${Date.now()}`,
    source: source.code,
    executedAt,
    mode,
    status,
    fetchedItems: fetchedItems.length,
    newItems: freshItems.length,
    officialUrl: source.officialUrl,
    note,
  };

  await registerIngestion(run);
  return run;
}

export async function initializeService() {
  if (initialized) {
    return;
  }

  await initializeStorage();
  const loaded = await loadStoredState();
  appState = applyProfileRules(loaded ? normalizeState(loaded) : structuredClone(seedState));
  await persistState();
  initialized = true;
}

export async function getDashboard() {
  await initializeService();
  return buildDashboardPayload(appState);
}

export async function getSources() {
  await initializeService();
  return { generatedAt: new Date().toISOString(), sources: buildSourceMonitors(appState) };
}

export async function runScan(trigger: "manual" | "automatic" = "manual") {
  await initializeService();
  const runs: IngestionRun[] = [];
  for (const adapter of sourceAdapters) {
    runs.push(await ingestSource(adapter));
  }
  refreshWatchRequests();
  const findings = runs.reduce((sum, run) => sum + run.newItems, 0);
  const coveredRequests = appState.watchRequests.filter((item) => item.status === "cubierto").length;
  const summary =
    findings > 0
      ? `Escaneo ${trigger === "manual" ? "manual" : "automático"} ejecutado. ${findings} hallazgo(s) nuevos y ${coveredRequests} tema(s) SST cubiertos por la base actual.`
      : `Escaneo ${trigger === "manual" ? "manual" : "automático"} ejecutado sin novedades, con ${coveredRequests} tema(s) SST ya cubiertos por la base actual.`;
  nextRunAt = new Date(Date.now() + scanIntervalMinutes * 60_000).toISOString();
  await registerScan(sourceAdapters.map((item) => item.code).join(" / "), summary, findings);
  return buildDashboardPayload(appState);
}

export async function saveCompanyProfile(input: Partial<CompanyProfile>) {
  await initializeService();
  const current = appState.companyProfile;
  const nextHeadcount = Number(input.headcount ?? current.headcount);
  const nextSites = Array.isArray(input.sites) ? input.sites : current.sites;

  appState.companyProfile = {
    legalName: String(input.legalName ?? current.legalName).trim(),
    industry: String(input.industry ?? current.industry).trim(),
    headcount: Number.isFinite(nextHeadcount) ? Math.max(1, nextHeadcount) : current.headcount,
    riskLevel: String(input.riskLevel ?? current.riskLevel).trim(),
    hasContractors: Boolean(input.hasContractors ?? current.hasContractors),
    sites: nextSites.map((site) => site.trim()).filter(Boolean),
    administrator: String(input.administrator ?? current.administrator).trim(),
  };
  appState = applyProfileRules(appState);
  await persistState();
  return buildDashboardPayload(appState);
}

export async function addWatchTopic(topic: string) {
  await initializeService();
  if (!topic.trim()) {
    throw new Error("Tema inválido.");
  }
  ensureWatchRequest(topic, "manual");
  appState = applyProfileRules(appState);
  await persistState();
  return buildDashboardPayload(appState);
}

export async function updateWatchStatus(id: string, status: WatchRequestStatus) {
  await initializeService();
  const watch = appState.watchRequests.find((item) => item.id === id);
  if (!watch) {
    throw new Error("Solicitud no encontrada.");
  }
  watch.status = status;
  await persistState();
  return buildDashboardPayload(appState);
}

export async function updateObligationStatus(id: string, status: Obligation["status"]) {
  await initializeService();
  const obligation = appState.obligations.find((item) => item.id === id);
  if (!obligation) {
    throw new Error("Obligación no encontrada.");
  }
  obligation.status = status;
  if (id === "obl-protocolo-karin" && status === "cumplido") {
    const document = appState.documents.find((item) => item.id === "doc-protocolo-karin");
    if (document) {
      document.status = "listo";
      document.lastGeneratedAt = new Date().toISOString();
    }
  }
  appState = applyProfileRules(appState);
  await persistState();
  return buildDashboardPayload(appState);
}

export async function resetState() {
  await initializeService();
  appState = applyProfileRules(structuredClone(seedState));
  nextRunAt = new Date(Date.now() + scanIntervalMinutes * 60_000).toISOString();
  await persistState();
  return buildDashboardPayload(appState);
}
