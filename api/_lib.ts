import { createApiApp } from "./api-app";
import { initializeService, runScan } from "./compliance-service";
import { loadStoredState, saveStoredState } from "./state-store";
import type { AppState, CompanyProfile, DashboardResponse, IngestionRun, NormUpdate, Obligation, ObligationStatus, WatchRequest, WatchRequestStatus } from "../src/types";

const scanIntervalMinutes = Number(process.env.SCAN_INTERVAL_MINUTES ?? 1440);
const remoteFetchEnabled = process.env.REMOTE_FETCH_ENABLED !== "false";

let appState: AppState | null = null;
let initialized = false;
let nextRunAt = new Date(Date.now() + scanIntervalMinutes * 60_000).toISOString();

function normalizeTopic(topic: string) {
  return topic.trim().toLowerCase();
}

function normalizeState(input: Partial<AppState>) {
  return {
    companyProfile: input.companyProfile ?? {
      legalName: "",
      industry: "",
      headcount: 0,
      riskLevel: "",
      hasContractors: false,
      sites: [],
      administrator: "",
    },
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

function ensureWatchRequest(topic: string, origin: WatchRequest["origin"], industryOptions: any[], sourceAdapters: any[]) {
  const normalizedTopic = normalizeTopic(topic);
  if (!normalizedTopic || !appState) return;

  const existing = appState.watchRequests.find((item) => item.normalizedTopic === normalizedTopic);
  if (existing) {
    if (origin === "industry" && existing.origin === "manual") return;
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

function syncIndustryWatchers(industry: string, industryOptions: any[]) {
  if (!appState) return;
  const normalizedIndustry = normalizeTopic(industry);
  const compactIndustry = normalizedIndustry.replace(/\s+/g, "");
  const option =
    industryOptions.find((item) => item.value === compactIndustry) ??
    industryOptions.find((item: any) => normalizeTopic(item.label) === normalizedIndustry);

  if (!option) return;

  for (const topic of option.suggestedTopics) {
    ensureWatchRequest(topic, "industry", industryOptions, []);
  }
}

function refreshWatchRequests() {
  if (!appState) return;
  appState.watchRequests = appState.watchRequests.map((watch) => {
    const matchedUpdate = appState!.updates.find((update) => matchesWatch(update, watch));
    return {
      ...watch,
      status: matchedUpdate ? "cubierto" : watch.status === "en_revision" ? "en_revision" : "activo",
      lastMatchedUpdateId: matchedUpdate?.id ?? null,
    };
  });
}

function applyProfileRules(state: AppState, industryOptions: any[]): AppState {
  appState = state;
  syncIndustryWatchers(state.companyProfile.industry, industryOptions);
  refreshWatchRequests();

  const hasCommitteeDuty = state.companyProfile.headcount > 25;
  const hasContractors = state.companyProfile.hasContractors;

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
    watchRequests: appState.watchRequests,
  };
}

function computeStats(state: AppState) {
  const applicable = state.obligations.filter((item) => item.applies);
  const urgent = applicable.filter((item) => item.priority === "alto" && item.status !== "cumplido");
  const docsPending = state.documents.filter((item) => item.status !== "listo");

  return {
    monitoredSources: 6,
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

async function persistState() {
  if (!appState) return;
  await saveStoredState(appState);
}

async function registerIngestion(run: IngestionRun) {
  if (!appState) return;
  appState.ingestionRuns.unshift(run);
  appState.ingestionRuns = appState.ingestionRuns.slice(0, 40);
  await persistState();
}

export async function initializeService() {
  if (initialized) return;
  await initializeStorage();
  const loaded = await loadStoredState();
  appState = loaded ? normalizeState(loaded) : null;
  initialized = true;
}

export async function getDashboard(): Promise<DashboardResponse> {
  await initializeService();
  if (!appState) {
    return {
      generatedAt: new Date().toISOString(),
      companyProfile: {
        legalName: "",
        industry: "",
        headcount: 0,
        riskLevel: "",
        hasContractors: false,
        sites: [],
        administrator: "",
      },
      stats: {
        monitoredSources: 0,
        totalUpdates: 0,
        applicableObligations: 0,
        urgentActions: 0,
        pendingDocuments: 0,
        coverageRate: 0,
      },
      scheduler: {
        enabled: true,
        intervalMinutes: scanIntervalMinutes,
        nextRunAt,
        statePath: "memory",
      },
      sourceMonitors: [],
      industryOptions: [],
      watchRequests: [],
      updates: [],
      obligations: [],
      documents: [],
      scanEvents: [],
      ingestionRuns: [],
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    companyProfile: appState.companyProfile,
    stats: computeStats(appState),
    scheduler: {
      enabled: true,
      intervalMinutes: scanIntervalMinutes,
      nextRunAt,
      statePath: "postgres",
    },
    sourceMonitors: [],
    industryOptions: [],
    watchRequests: appState.watchRequests,
    updates: appState.updates,
    obligations: appState.obligations,
    documents: appState.documents,
    scanEvents: appState.scanEvents,
    ingestionRuns: appState.ingestionRuns.slice(0, 12),
  };
}

export async function runScan(trigger: "manual" | "automatic" = "manual"): Promise<DashboardResponse> {
  await initializeService();
  refreshWatchRequests();
  await persistState();
  return getDashboard();
}

export async function saveCompanyProfile(input: Partial<CompanyProfile>): Promise<DashboardResponse> {
  await initializeService();
  if (!appState) return getDashboard();

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

  await persistState();
  return getDashboard();
}

export async function addWatchTopic(topic: string): Promise<DashboardResponse> {
  await initializeService();
  if (!topic.trim() || !appState) return getDashboard();

  const normalizedTopic = normalizeTopic(topic);
  const matchedUpdate = appState.updates.find((update) =>
    normalizeTopic([update.title, update.category, update.summary].join(" ")).includes(normalizedTopic),
  );

  appState.watchRequests.unshift({
    id: `watch-${Date.now()}-${normalizedTopic.replace(/\s+/g, "-")}`,
    topic: topic.trim(),
    normalizedTopic,
    origin: "manual",
    status: matchedUpdate ? "cubierto" : "activo",
    createdAt: new Date().toISOString(),
    lastMatchedUpdateId: matchedUpdate?.id ?? null,
  });

  await persistState();
  return getDashboard();
}

export async function updateWatchStatus(id: string, status: WatchRequestStatus): Promise<DashboardResponse> {
  await initializeService();
  if (!appState) return getDashboard();

  const watch = appState.watchRequests.find((item) => item.id === id);
  if (!watch) throw new Error("Solicitud no encontrada.");

  watch.status = status;
  await persistState();
  return getDashboard();
}

export async function updateObligationStatus(id: string, status: ObligationStatus): Promise<DashboardResponse> {
  await initializeService();
  if (!appState) return getDashboard();

  const obligation = appState.obligations.find((item) => item.id === id);
  if (!obligation) throw new Error("Obligación no encontrada.");

  obligation.status = status;
  await persistState();
  return getDashboard();
}

export async function resetState(): Promise<DashboardResponse> {
  await initializeService();
  if (appState) {
    appState = normalizeState({});
  }
  nextRunAt = new Date(Date.now() + scanIntervalMinutes * 60_000).toISOString();
  await persistState();
  return getDashboard();
}

export async function getSources() {
  await initializeService();
  return { generatedAt: new Date().toISOString(), sources: [] };
}

// Re-export state store functions
export { initializeStorage, loadStoredState, saveStoredState } from "./state-store";
