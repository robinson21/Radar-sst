import { startTransition, useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BellRing,
  BookOpenText,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Download,
  FilePlus2,
  FileStack,
  FileText,
  LoaderCircle,
  Radar,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  SparklesIcon,
  Wand2,
} from "lucide-react";
import type {
  CompanyProfile,
  DashboardResponse,
  DocumentTemplate,
  ImpactLevel,
  IngestionRun,
  NormUpdate,
  ObligationStatus,
  ScanEvent,
  SourceCode,
  SourceMonitor,
  WatchRequest,
  WatchRequestStatus,
} from "./types";

interface AIStatus {
  canUse: boolean;
  remaining: number;
  resetsAt: string;
}

interface AIResponse {
  action: string;
  itemId: string;
  result: string;
  usage: AIStatus;
  analyzedAt: string;
}

const sourceTone: Record<SourceCode, string> = {
  BCN: "tone-blue",
  SUSESO: "tone-green",
  DT: "tone-amber",
  MINSAL: "tone-red",
  SEC: "tone-cyan",
  DO: "tone-slate",
};

const impactTone: Record<ImpactLevel, string> = {
  alto: "pill-danger",
  medio: "pill-warning",
  bajo: "pill-neutral",
};

const watchTone: Record<WatchRequestStatus, string> = {
  activo: "pill-warning",
  cubierto: "pill-success",
  en_revision: "pill-neutral",
};

const statusTone: Record<ObligationStatus, string> = {
  pendiente: "pill-danger",
  en_progreso: "pill-warning",
  cumplido: "pill-success",
};

type ProfileForm = {
  legalName: string;
  industry: string;
  headcount: string;
  riskLevel: string;
  hasContractors: boolean;
  sites: string;
  administrator: string;
};

function fmtDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(new Date(value));
}

function toProfileForm(profile: CompanyProfile): ProfileForm {
  return {
    legalName: profile.legalName,
    industry: profile.industry,
    headcount: String(profile.headcount),
    riskLevel: profile.riskLevel,
    hasContractors: profile.hasContractors,
    sites: profile.sites.join("\n"),
    administrator: profile.administrator,
  };
}

function App() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [manualTopic, setManualTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);
  const [mutatingObligationId, setMutatingObligationId] = useState<string | null>(null);
  const [mutatingWatchId, setMutatingWatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [aiResult, setAiResult] = useState<AIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const response = await fetch(input, init);
    if (!response.ok) {
      const fallback = "La operación no pudo completarse.";
      try {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? fallback);
      } catch {
        throw new Error(fallback);
      }
    }
    return (await response.json()) as T;
  }

  async function loadAIStatus() {
    try {
      const status = await readJson<AIStatus>("/api/ai-status");
      setAiStatus(status);
    } catch {
      setAiStatus(null);
    }
  }

  function syncPayload(payload: DashboardResponse) {
    startTransition(() => {
      setData(payload);
      setForm(toProfileForm(payload.companyProfile));
      if (payload.aiStatus) {
        setAiStatus(payload.aiStatus);
      }
    });
  }

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const payload = await readJson<DashboardResponse>("/api/dashboard");
      syncPayload(payload);
      await loadAIStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function runScan() {
    setScanning(true);
    setError(null);
    try {
      const payload = await readJson<DashboardResponse>("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      syncPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setScanning(false);
    }
  }

  async function saveProfile() {
    if (!form) return;
    setSavingProfile(true);
    setError(null);
    try {
      const payload = await readJson<DashboardResponse>("/api/company-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: form.legalName,
          industry: form.industry,
          headcount: Number(form.headcount),
          riskLevel: form.riskLevel,
          hasContractors: form.hasContractors,
          sites: form.sites.split("\n").map((site) => site.trim()).filter(Boolean),
          administrator: form.administrator,
        }),
      });
      syncPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSavingProfile(false);
    }
  }

  async function addWatchTopic() {
    if (!manualTopic.trim()) return;
    setSavingTopic(true);
    setError(null);
    try {
      const payload = await readJson<DashboardResponse>("/api/watch-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: manualTopic }),
      });
      setManualTopic("");
      syncPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSavingTopic(false);
    }
  }

  async function updateWatchStatus(id: string, status: WatchRequestStatus) {
    setMutatingWatchId(id);
    setError(null);
    try {
      const payload = await readJson<DashboardResponse>(`/api/watch-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      syncPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setMutatingWatchId(null);
    }
  }

  async function updateObligationStatus(id: string, status: ObligationStatus) {
    setMutatingObligationId(id);
    setError(null);
    try {
      const payload = await readJson<DashboardResponse>(`/api/obligations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      syncPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setMutatingObligationId(null);
    }
  }

  async function resetDemo() {
    setLoading(true);
    setError(null);
    try {
      const payload = await readJson<DashboardResponse>("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      syncPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function callAI(action: string, itemId?: string) {
    setAiLoading(true);
    setError(null);
    setAiResult(null);
    try {
      const result = await readJson<AIResponse>("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemId }),
      });
      setAiResult(result);
      await loadAIStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al usar IA");
    } finally {
      setAiLoading(false);
    }
  }

  async function exportData() {
    try {
      const response = await fetch("/api/export");
      if (!response.ok) throw new Error("Error al exportar");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `radar-sst-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al exportar");
    }
  }

  async function downloadDocx(docId: string, docName: string) {
    try {
      const response = await fetch(`/api/documents/${docId}/generate`, { method: "POST" });
      if (!response.ok) throw new Error("Error al generar documento");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docName.replace(/\s+/g, "-")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al descargar DOCX");
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (loading) {
    return <div className="shell loading-shell"><LoaderCircle className="spin" size={28} /><p>Cargando plataforma SST...</p></div>;
  }
  if (error && !data) {
    return <div className="shell loading-shell"><ShieldAlert size={28} /><p>{error}</p><button className="primary-btn" onClick={() => void loadDashboard()}>Reintentar</button></div>;
  }
  if (!data || !form) {
    return null;
  }

  const urgentObligations = data.obligations.filter((item) => item.applies && item.priority === "alto" && item.status !== "cumplido");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><ShieldAlert size={18} /></div>
          <div><p className="eyebrow">MVP Compliance</p><h1>Radar SST</h1></div>
        </div>
        <nav className="sidebar-nav">
          <a href="#overview">Resumen</a>
          <a href="#ai-assistant">Asistente IA</a>
          <a href="#sources">Fuentes</a>
          <a href="#profile">Perfil</a>
          <a href="#obligations">Obligaciones</a>
          <a href="#documents">Documentos</a>
        </nav>
        <div className="sidebar-card">
          <p className="eyebrow">IA Disponible</p>
          <strong style={{ color: aiStatus?.canUse ? "#22c55e" : "#ef4444" }}>
            {aiStatus?.canUse ? `${aiStatus.remaining} uso restante` : "Sin usos hoy"}
          </strong>
          <small>Se renueva a las 00:00 UTC</small>
        </div>
        <div className="sidebar-card">
          <button className="secondary-btn" style={{ width: "100%", marginBottom: 8 }} onClick={() => void exportData()}>
            <Download size={14} /> Exportar datos
          </button>
        </div>
      </aside>

      <main className="content">
        <section className="hero" id="overview">
          <div>
            <p className="eyebrow">Monitoreo diario normativo</p>
            <h2>Plataforma SST para detectar, clasificar y accionarr cumplimiento</h2>
            <p className="hero-copy">El agente consolida cambios normativos, evalúa aplicabilidad y propone cómo cumplir.</p>
            {error ? <div className="inline-error">{error}</div> : null}
          </div>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => void runScan()} disabled={scanning}>
              {scanning ? <LoaderCircle className="spin" size={16} /> : <RefreshCcw size={16} />}
              Ejecutar escaneo
            </button>
            <button className="secondary-btn" onClick={() => void resetDemo()}>
              <RotateCcw size={16} /> Reset
            </button>
            <div className="hero-meta"><Clock3 size={16} /><span>Actualizado: {fmtDate(data.generatedAt)}</span></div>
          </div>
        </section>

        <section className="panel" id="ai-assistant">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Asistente IA</p>
              <h3>Análisis con Gemini (1 uso diario)</h3>
            </div>
            <Wand2 size={18} />
          </div>
          <div className="ai-section">
            <div className="ai-actions">
              <button className="ai-btn" onClick={() => void callAI("analyze")} disabled={aiLoading || !aiStatus?.canUse}>
                <SparklesIcon size={14} /> Analizar norma
              </button>
              <button className="ai-btn" onClick={() => void callAI("summarize")} disabled={aiLoading || !aiStatus?.canUse}>
                <BookOpenText size={14} /> Resumir
              </button>
              <button className="ai-btn" onClick={() => void callAI("recommend")} disabled={aiLoading || !aiStatus?.canUse}>
                <CheckCircle2 size={14} /> Cómo cumplir
              </button>
              <button className="ai-btn" onClick={() => void callAI("generate")} disabled={aiLoading || !aiStatus?.canUse}>
                <FileText size={14} /> Generar plan
              </button>
            </div>
            {aiLoading && <div className="ai-loading"><LoaderCircle className="spin" size={20} /> Procesando con IA...</div>}
            {aiResult && (
              <div className="ai-result">
                <div className="ai-result-header">
                  <span className="pill pill-success">IA usada: 1/{aiResult.usage.remaining + 1}</span>
                  <small>{fmtDate(aiResult.analyzedAt)}</small>
                </div>
                <div className="ai-result-content">
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{aiResult.result}</pre>
                </div>
              </div>
            )}
            {!aiStatus?.canUse && !aiLoading && (
              <p className="helper-copy">Límite diario alcanzado. Se renueva a las 00:00 UTC.</p>
            )}
          </div>
        </section>

        <section className="metrics-grid">
          <MetricCard icon={<Database size={18} />} label="Fuentes activas" value={String(data.stats.monitoredSources)} />
          <MetricCard icon={<BellRing size={18} />} label="Normas monitoreadas" value={String(data.stats.totalUpdates)} />
          <MetricCard icon={<ShieldAlert size={18} />} label="Obligaciones aplicables" value={String(data.stats.applicableObligations)} />
          <MetricCard icon={<Sparkles size={18} />} label="Acciones urgentes" value={String(data.stats.urgentActions)} />
          <MetricCard icon={<FileStack size={18} />} label="Documentos pendientes" value={String(data.stats.pendingDocuments)} />
          <MetricCard icon={<Activity size={18} />} label="Cobertura" value={`${data.stats.coverageRate}%`} />
        </section>

        <section className="dashboard-grid" id="profile">
          <div className="panel">
            <div className="panel-head"><div><p className="eyebrow">Perfil empresarial</p><h3>Datos de la empresa</h3></div><Database size={18} /></div>
            <div className="form-grid">
              <label className="field"><span>Razón social</span><input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></label>
              <label className="field"><span>Rubro</span><input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></label>
              <label className="field"><span>Dotación</span><input value={form.headcount} type="number" onChange={(e) => setForm({ ...form, headcount: e.target.value })} /></label>
              <label className="field"><span>Nivel de riesgo</span><input value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value })} /></label>
              <label className="field checkbox-field"><span>Subcontratistas</span><input checked={form.hasContractors} type="checkbox" onChange={(e) => setForm({ ...form, hasContractors: e.target.checked })} /></label>
              <label className="field full-width"><span>Centros de trabajo</span><textarea rows={3} value={form.sites} onChange={(e) => setForm({ ...form, sites: e.target.value })} /></label>
            </div>
            <div className="panel-actions"><button className="primary-btn" onClick={() => void saveProfile()} disabled={savingProfile}>{savingProfile ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}Guardar</button></div>
          </div>
          <div className="panel accent-panel">
            <div className="panel-head"><div><p className="eyebrow">Resumen</p><h3>Interpretación actual</h3></div><Sparkles size={18} /></div>
            <ul className="roadmap-list">
              <li>{data.companyProfile.headcount > 25 ? "Sí" : "No"} requiere Comité Paritario</li>
              <li>{data.companyProfile.hasContractors ? "Sí" : "No"} tiene subcontratación</li>
              <li>{data.companyProfile.sites.length} centros de trabajo</li>
            </ul>
          </div>
        </section>

        <section className="panel" id="updates">
          <div className="panel-head"><div><p className="eyebrow">Base normativa</p><h3>Normas detectadas</h3></div><BookOpenText size={18} /></div>
          <div className="cards-grid">{data.updates.map((update) => <article className="reg-card" key={update.id}><div className="reg-header"><span className={`source-tag ${sourceTone[update.source]}`}>{update.source}</span><span className={`pill ${impactTone[update.impactLevel]}`}>{update.impactLevel}</span></div><h4>{update.title}</h4><p>{update.applicabilityReason}</p><ul className="micro-list">{update.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul><a href={update.officialUrl} target="_blank" rel="noreferrer" className="text-link">Ver fuente <ChevronRight size={14} /></a></article>)}</div>
        </section>

        <section className="panel" id="obligations">
          <div className="panel-head"><div><p className="eyebrow">Obligaciones</p><h3>Cumplimiento SST</h3></div><ShieldAlert size={18} /></div>
          <div className="table-like">{data.obligations.map((item) => <div className="table-row" key={item.id}><div><strong>{item.title}</strong><p>{item.area}</p></div><div><span className={`pill ${impactTone[item.priority]}`}>{item.priority}</span></div><div><span className={`pill ${item.applies ? statusTone[item.status] : "pill-neutral"}`}>{item.applies ? item.status.replace("_", " ") : "no aplica"}</span></div><div><p>{item.owner}</p><small>{fmtDate(item.dueDate)}</small></div><div><select className="status-select" value={item.status} disabled={!item.applies || mutatingObligationId === item.id} onChange={(e) => void updateObligationStatus(item.id, e.target.value as ObligationStatus)}><option value="pendiente">Pendiente</option><option value="en_progreso">En progreso</option><option value="cumplido">Cumplido</option></select></div></div>)}</div>
        </section>

        <section className="panel" id="documents">
          <div className="panel-head"><div><p className="eyebrow">Documentos</p><h3>Generación y descarga</h3></div><FileStack size={18} /></div>
          <div className="stack">{data.documents.map((doc) => <article className="doc-card" key={doc.id}><div className="action-header"><strong>{doc.name}</strong><span className={`pill ${doc.status === "listo" ? "pill-success" : doc.status === "faltante" ? "pill-danger" : "pill-warning"}`}>{doc.status.replace("_", " ")}</span></div><p>{doc.description}</p><button className="primary-btn" onClick={() => void downloadDocx(doc.id, doc.name)} disabled={doc.status === "faltante"}><Download size={14} /> Descargar DOCX</button></article>)}</div>
        </section>
      </main>

      <style>{`
        .ai-section { padding: 16px 0; }
        .ai-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .ai-btn { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
        .ai-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ai-btn:hover:not(:disabled) { background: #2563eb; }
        .ai-loading { display: flex; align-items: center; gap: 8px; padding: 12px; color: #666; }
        .ai-result { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        .ai-result-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
        .ai-result-content { padding: 12px; max-height: 400px; overflow-y: auto; }
        .sidebar-card { margin-top: 16px; }
        .sidebar-card button { font-size: 12px; }
      `}</style>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong></article>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

export default App;
