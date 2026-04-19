export type SourceCode = "BCN" | "SUSESO" | "DT" | "MINSAL" | "SEC" | "DO";
export type ImpactLevel = "alto" | "medio" | "bajo";
export type ObligationStatus = "pendiente" | "en_progreso" | "cumplido";
export type SourceMode = "snapshot" | "remote";
export type WatchRequestStatus = "activo" | "cubierto" | "en_revision";

export type CompanyProfile = {
  legalName: string;
  industry: string;
  headcount: number;
  riskLevel: string;
  hasContractors: boolean;
  sites: string[];
  administrator: string;
};

export type NormUpdate = {
  id: string;
  title: string;
  source: SourceCode;
  category: string;
  publishedAt: string;
  effectiveAt: string;
  impactLevel: ImpactLevel;
  status: "nuevo" | "monitoreado" | "en_revision";
  summary: string;
  applicabilityReason: string;
  officialUrl: string;
  keyPoints: string[];
};

export type Obligation = {
  id: string;
  updateId: string;
  title: string;
  area: string;
  priority: ImpactLevel;
  applies: boolean;
  status: ObligationStatus;
  basis: string;
  howToComply: string[];
  evidence: string[];
  owner: string;
  dueDate: string;
};

export type DocumentTemplate = {
  id: string;
  name: string;
  type: string;
  status: "listo" | "requiere_revision" | "faltante";
  linkedObligationIds: string[];
  lastGeneratedAt: string | null;
  description: string;
};

export type ScanEvent = {
  id: string;
  executedAt: string;
  source: string;
  summary: string;
  findings: number;
};

export type IngestionRun = {
  id: string;
  source: SourceCode;
  executedAt: string;
  mode: SourceMode;
  status: "ok" | "fallback";
  fetchedItems: number;
  newItems: number;
  officialUrl: string;
  note: string;
};

export type WatchRequest = {
  id: string;
  topic: string;
  normalizedTopic: string;
  origin: "industry" | "manual";
  status: WatchRequestStatus;
  createdAt: string;
  lastMatchedUpdateId: string | null;
};

export type IndustryOption = {
  value: string;
  label: string;
  suggestedTopics: string[];
};

export type AppState = {
  companyProfile: CompanyProfile;
  updates: NormUpdate[];
  obligations: Obligation[];
  documents: DocumentTemplate[];
  scanEvents: ScanEvent[];
  ingestionRuns: IngestionRun[];
  watchRequests: WatchRequest[];
};

export type SourceMonitor = {
  code: SourceCode;
  label: string;
  officialUrl: string;
  coverage: string;
  mode: SourceMode;
  snapshotCount: number;
  lastRunAt: string | null;
  lastStatus: "ok" | "fallback" | "idle";
};

export type DashboardResponse = {
  generatedAt: string;
  companyProfile: CompanyProfile;
  stats: {
    monitoredSources: number;
    totalUpdates: number;
    applicableObligations: number;
    urgentActions: number;
    pendingDocuments: number;
    coverageRate: number;
  };
  scheduler: {
    enabled: boolean;
    intervalMinutes: number;
    nextRunAt: string;
    statePath: string;
  };
  sourceMonitors: SourceMonitor[];
  industryOptions: IndustryOption[];
  watchRequests: WatchRequest[];
  updates: NormUpdate[];
  obligations: Obligation[];
  documents: DocumentTemplate[];
  scanEvents: ScanEvent[];
  ingestionRuns: IngestionRun[];
};
