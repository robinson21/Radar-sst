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
  FilePlus2,
  FileStack,
  LoaderCircle,
  Radar,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
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

  function syncPayload(payload: DashboardResponse) {
    startTransition(() => {
      setData(payload);
      setForm(toProfileForm(payload.companyProfile));
    });
  }

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const payload = await readJson<DashboardResponse>("/api/dashboard");
      syncPayload(payload);
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
    if (!form) {
      return;
    }
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
    if (!manualTopic.trim()) {
      return;
    }
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
          <a href="#overview">Resumen ejecutivo</a>
          <a href="#sources">Fuentes monitoreadas</a>
          <a href="#profile">Perfil y rubro</a>
          <a href="#watchlist">Solicitudes SST</a>
          <a href="#updates">Normativa detectada</a>
          <a href="#obligations">Aplicabilidad y cumplimiento</a>
          <a href="#documents">Documentos y bases</a>
          <a href="#activity">Actividad del agente</a>
        </nav>
        <div className="sidebar-card">
          <p className="eyebrow">Ejecución automática</p>
          <strong>Cada {data.scheduler.intervalMinutes} min</strong>
          <span>Próximo ciclo {fmtDate(data.scheduler.nextRunAt)}</span>
          <span>Estado persistido en `data/state.json`</span>
        </div>
      </aside>

      <main className="content">
        <section className="hero" id="overview">
          <div>
            <p className="eyebrow">Monitoreo diario normativo</p>
            <h2>Plataforma inicial para detectar, clasificar y accionar cumplimiento SST</h2>
            <p className="hero-copy">El agente consolida cambios normativos, evalúa si aplican a tu operación y propone cómo cumplir con trazabilidad de evidencia, responsables y documentos base.</p>
            {error ? <div className="inline-error">{error}</div> : null}
          </div>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => void runScan()} disabled={scanning}>{scanning ? <LoaderCircle className="spin" size={16} /> : <RefreshCcw size={16} />}Ejecutar escaneo</button>
            <button className="secondary-btn" onClick={() => void resetDemo()}><RotateCcw size={16} />Reset demo</button>
            <div className="hero-meta"><Clock3 size={16} /><span>Última actualización: {fmtDate(data.generatedAt)}</span></div>
          </div>
        </section>

        <section className="metrics-grid">
          <MetricCard icon={<Database size={18} />} label="Fuentes activas" value={String(data.stats.monitoredSources)} />
          <MetricCard icon={<BellRing size={18} />} label="Normas monitoreadas" value={String(data.stats.totalUpdates)} />
          <MetricCard icon={<Search size={18} />} label="Temas vigilados" value={String(data.watchRequests.length)} />
          <MetricCard icon={<ShieldAlert size={18} />} label="Obligaciones aplicables" value={String(data.stats.applicableObligations)} />
          <MetricCard icon={<Sparkles size={18} />} label="Acciones urgentes" value={String(data.stats.urgentActions)} />
          <MetricCard icon={<FileStack size={18} />} label="Documentos pendientes" value={String(data.stats.pendingDocuments)} />
        </section>

        <section className="dashboard-grid" id="sources">
          <div className="panel">
            <div className="panel-head"><div><p className="eyebrow">Adaptadores de monitoreo</p><h3>Fuentes oficiales configuradas</h3></div><Radar size={18} /></div>
            <div className="source-grid">{data.sourceMonitors.map((monitor) => <SourceCard key={monitor.code} monitor={monitor} />)}</div>
          </div>
          <div className="panel accent-panel">
            <div className="panel-head"><div><p className="eyebrow">Ingestión reciente</p><h3>Últimas corridas del pipeline</h3></div><Activity size={18} /></div>
            <div className="stack">{data.ingestionRuns.length === 0 ? <EmptyState text="Aún no hay corridas de ingestión registradas." /> : data.ingestionRuns.slice(0, 5).map((run) => <IngestionCard key={run.id} run={run} />)}</div>
          </div>
        </section>

        <section className="dashboard-grid" id="profile">
          <div className="panel">
            <div className="panel-head"><div><p className="eyebrow">Motor de aplicabilidad</p><h3>Perfil empresarial editable</h3></div><Database size={18} /></div>
            <div className="form-grid">
              <label className="field"><span>Razón social</span><input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></label>
              <label className="field"><span>Rubro libre</span><input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></label>
              <label className="field"><span>Rubro sugerido</span><select value="" onChange={(e) => { if (e.target.value) setForm({ ...form, industry: e.target.value }); }}><option value="">Seleccionar rubro</option>{data.industryOptions.map((option) => <option key={option.value} value={option.label}>{option.label}</option>)}</select></label>
              <label className="field"><span>Dotación</span><input value={form.headcount} type="number" onChange={(e) => setForm({ ...form, headcount: e.target.value })} /></label>
              <label className="field"><span>Nivel de riesgo</span><input value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value })} /></label>
              <label className="field"><span>Organismo administrador</span><input value={form.administrator} onChange={(e) => setForm({ ...form, administrator: e.target.value })} /></label>
              <label className="field checkbox-field"><span>Subcontratistas</span><input checked={form.hasContractors} type="checkbox" onChange={(e) => setForm({ ...form, hasContractors: e.target.checked })} /></label>
              <label className="field full-width"><span>Centros de trabajo</span><textarea rows={5} value={form.sites} onChange={(e) => setForm({ ...form, sites: e.target.value })} /></label>
            </div>
            <div className="panel-actions"><button className="primary-btn" onClick={() => void saveProfile()} disabled={savingProfile}>{savingProfile ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}Guardar perfil</button></div>
          </div>
          <div className="panel accent-panel">
            <div className="panel-head"><div><p className="eyebrow">Lectura actual</p><h3>Cómo interpreta hoy el agente tu operación</h3></div><Sparkles size={18} /></div>
            <ul className="roadmap-list">
              <li>{data.companyProfile.headcount > 25 ? "Sí requiere" : "No requiere"} control de Comité Paritario por dotación informada.</li>
              <li>{data.companyProfile.hasContractors ? "Sí existe" : "No existe"} exposición por subcontratación declarada.</li>
              <li>{data.companyProfile.sites.length} centro(s) de trabajo considerados para DS 594 y matrices operativas.</li>
              <li>El rubro activo es `{data.companyProfile.industry}` y alimenta solicitudes persistentes por tema.</li>
              <li>Organismo administrador cargado: {data.companyProfile.administrator}.</li>
            </ul>
          </div>
        </section>

        <section className="dashboard-grid" id="watchlist">
          <div className="panel">
            <div className="panel-head"><div><p className="eyebrow">Solicitudes persistentes</p><h3>Temas SST que el agente debe perseguir</h3></div><Search size={18} /></div>
            <div className="watch-entry">
              <input value={manualTopic} placeholder="Ejemplo: sílice, protocolo de calor, violencia de terceros" onChange={(e) => setManualTopic(e.target.value)} />
              <button className="primary-btn" onClick={() => void addWatchTopic()} disabled={savingTopic}>{savingTopic ? <LoaderCircle className="spin" size={16} /> : <FilePlus2 size={16} />}Agregar tema</button>
            </div>
            <div className="stack">{data.watchRequests.map((request) => <WatchCard key={request.id} request={request} disabled={mutatingWatchId === request.id} onChangeStatus={updateWatchStatus} />)}</div>
          </div>
          <div className="panel accent-panel">
            <div className="panel-head"><div><p className="eyebrow">Rubro a búsqueda</p><h3>Temas sugeridos por sector</h3></div><Sparkles size={18} /></div>
            <div className="chips">{data.industryOptions.find((item) => item.label === data.companyProfile.industry)?.suggestedTopics.map((topic) => <span key={topic} className="chip">{topic}</span>) ?? <span className="chip">Sin temas sugeridos para este rubro aún.</span>}</div>
            <p className="helper-copy">Cuando guardas un rubro reconocido, el backend crea solicitudes persistentes por temas relacionados a SST y las cruza contra la base monitoreada.</p>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="panel spotlight">
            <div className="panel-head"><div><p className="eyebrow">Qué cambió hoy</p><h3>Alertas normativas priorizadas</h3></div><BookOpenText size={18} /></div>
            <div className="stack">{data.updates.slice(0, 3).map((update) => <UpdateCard key={update.id} update={update} />)}</div>
          </div>
          <div className="panel">
            <div className="panel-head"><div><p className="eyebrow">Brechas críticas</p><h3>Acciones inmediatas</h3></div><Activity size={18} /></div>
            <div className="stack">{urgentObligations.length === 0 ? <EmptyState text="No hay brechas críticas pendientes." /> : urgentObligations.map((item) => <article className="action-card" key={item.id}><div className="action-header"><strong>{item.title}</strong><span className={`pill ${statusTone[item.status]}`}>{item.status.replace("_", " ")}</span></div><p>{item.basis}</p><div className="meta-row"><span>{item.owner}</span><span>Vence {fmtDate(item.dueDate)}</span></div></article>)}</div>
          </div>
        </section>

        <section className="panel" id="updates">
          <div className="panel-head"><div><p className="eyebrow">Base normativa</p><h3>Normas clasificadas por fuente y aplicabilidad</h3></div><ArrowUpRight size={18} /></div>
          <div className="cards-grid">{data.updates.map((update) => <article className="reg-card" key={update.id}><div className="reg-header"><span className={`source-tag ${sourceTone[update.source]}`}>{update.source}</span><span className={`pill ${impactTone[update.impactLevel]}`}>{update.category}</span></div><h4>{update.title}</h4><p>{update.applicabilityReason}</p><ul className="micro-list">{update.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul><a href={update.officialUrl} target="_blank" rel="noreferrer" className="text-link">Ver fuente oficial <ChevronRight size={14} /></a></article>)}</div>
        </section>

        <section className="dashboard-grid" id="obligations">
          <div className="panel">
            <div className="panel-head"><div><p className="eyebrow">Motor de aplicabilidad</p><h3>Obligaciones que sí te aplican</h3></div><ShieldAlert size={18} /></div>
            <div className="table-like">{data.obligations.map((item) => <div className="table-row" key={item.id}><div><strong>{item.title}</strong><p>{item.area}</p></div><div><span className={`pill ${impactTone[item.priority]}`}>{item.priority}</span></div><div><span className={`pill ${item.applies ? statusTone[item.status] : "pill-neutral"}`}>{item.applies ? item.status.replace("_", " ") : "no aplica"}</span></div><div><p>{item.owner}</p><small>{fmtDate(item.dueDate)}</small></div><div><select className="status-select" value={item.status} disabled={!item.applies || mutatingObligationId === item.id} onChange={(e) => void updateObligationStatus(item.id, e.target.value as ObligationStatus)}><option value="pendiente">Pendiente</option><option value="en_progreso">En progreso</option><option value="cumplido">Cumplido</option></select></div></div>)}</div>
          </div>
          <div className="panel">
            <div className="panel-head"><div><p className="eyebrow">Cómo cumplir</p><h3>Guía operativa del agente</h3></div><Sparkles size={18} /></div>
            <div className="stack">{data.obligations.slice(0, 3).map((item) => <article className="playbook-card" key={item.id}><strong>{item.title}</strong><p>{item.basis}</p><div className="playbook-columns"><div><span className="mini-title">Cumplir</span><ul className="micro-list">{item.howToComply.map((step) => <li key={step}>{step}</li>)}</ul></div><div><span className="mini-title">Evidencia</span><ul className="micro-list">{item.evidence.map((entry) => <li key={entry}>{entry}</li>)}</ul></div></div></article>)}</div>
          </div>
        </section>

        <section className="dashboard-grid" id="documents">
          <div className="panel">
            <div className="panel-head"><div><p className="eyebrow">Documentos generables</p><h3>Repositorio inicial de salidas</h3></div><FileStack size={18} /></div>
            <div className="stack">{data.documents.map((document) => <DocumentCard key={document.id} document={document} />)}</div>
          </div>
          <div className="panel accent-panel">
            <div className="panel-head"><div><p className="eyebrow">Próxima iteración</p><h3>Qué debería venir después del MVP</h3></div><Database size={18} /></div>
            <ul className="roadmap-list">
              <li>Fetch remoto con parsing por fuente y deduplicación real.</li>
              <li>Búsqueda semántica para cubrir mejor temas SST solicitados.</li>
              <li>Motor de reglas configurable por rubro, dotación y centros de trabajo.</li>
              <li>Generación real de documentos en `DOCX` o `PDF` y versionado.</li>
              <li>Gestión multiempresa y workflow de revisión legal.</li>
            </ul>
          </div>
        </section>

        <section className="panel" id="activity">
          <div className="panel-head"><div><p className="eyebrow">Bitácora del agente</p><h3>Actividad reciente de búsqueda y clasificación</h3></div><Clock3 size={18} /></div>
          <div className="timeline">{data.scanEvents.map((event) => <TimelineItem key={event.id} event={event} />)}</div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong></article>;
}

function SourceCard({ monitor }: { monitor: SourceMonitor }) {
  const statusClass = monitor.lastStatus === "ok" ? "pill-success" : monitor.lastStatus === "fallback" ? "pill-warning" : "pill-neutral";
  return <article className="source-card"><div className="action-header"><strong>{monitor.label}</strong><span className={`pill ${statusClass}`}>{monitor.lastStatus}</span></div><p>{monitor.coverage}</p><div className="meta-stack"><span>Modo: {monitor.mode}</span><span>Snapshots: {monitor.snapshotCount}</span><span>{monitor.lastRunAt ? `Última corrida ${fmtDate(monitor.lastRunAt)}` : "Sin corridas aún"}</span></div><a href={monitor.officialUrl} target="_blank" rel="noreferrer" className="text-link">Abrir fuente oficial <ChevronRight size={14} /></a></article>;
}

function IngestionCard({ run }: { run: IngestionRun }) {
  return <article className="doc-card"><div className="action-header"><strong>{run.source}</strong><span className={`pill ${run.status === "ok" ? "pill-success" : "pill-warning"}`}>{run.mode}</span></div><p>{run.note}</p><div className="meta-stack"><span>Ejecutado {fmtDate(run.executedAt)}</span><span>Items leídos: {run.fetchedItems}</span><span>Nuevos detectados: {run.newItems}</span></div></article>;
}

function UpdateCard({ update }: { update: NormUpdate }) {
  return <article className="update-card"><div className="update-topline"><span className={`source-tag ${sourceTone[update.source]}`}>{update.source}</span><span className={`pill ${impactTone[update.impactLevel]}`}>Impacto {update.impactLevel}</span></div><h4>{update.title}</h4><p>{update.summary}</p><div className="meta-row"><span>Publicado: {fmtDate(update.publishedAt)}</span><span>Vigencia: {fmtDate(update.effectiveAt)}</span></div></article>;
}

function DocumentCard({ document }: { document: DocumentTemplate }) {
  const tone = document.status === "listo" ? "pill-success" : document.status === "faltante" ? "pill-danger" : "pill-warning";
  return <article className="doc-card"><div className="action-header"><strong>{document.name}</strong><span className={`pill ${tone}`}>{document.status.replace("_", " ")}</span></div><p>{document.description}</p><div className="meta-row"><span>{document.type}</span><span>{document.lastGeneratedAt ? `Generado ${fmtDate(document.lastGeneratedAt)}` : "Aún no generado"}</span></div></article>;
}

function WatchCard({
  request,
  disabled,
  onChangeStatus,
}: {
  request: WatchRequest;
  disabled: boolean;
  onChangeStatus: (id: string, status: WatchRequestStatus) => Promise<void>;
}) {
  return <article className="doc-card"><div className="action-header"><strong>{request.topic}</strong><span className={`pill ${watchTone[request.status]}`}>{request.status.replace("_", " ")}</span></div><div className="meta-stack"><span>Origen: {request.origin}</span><span>Creado {fmtDate(request.createdAt)}</span><span>{request.lastMatchedUpdateId ? `Última coincidencia: ${request.lastMatchedUpdateId}` : "Sin coincidencias aún"}</span></div><div className="panel-actions left"><select className="status-select" value={request.status} disabled={disabled} onChange={(e) => void onChangeStatus(request.id, e.target.value as WatchRequestStatus)}><option value="activo">Activo</option><option value="cubierto">Cubierto</option><option value="en_revision">En revisión</option></select></div></article>;
}

function TimelineItem({ event }: { event: ScanEvent }) {
  return <article className="timeline-item"><div className="timeline-dot" /><div><strong>{fmtDate(event.executedAt)}</strong><p>{event.summary}</p><small>{event.source} · {event.findings} hallazgo(s)</small></div></article>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

export default App;
