import type { AppState } from "../src/types";
import { sourceAdapters } from "./sources";

const initialUpdates = sourceAdapters.flatMap((adapter) => adapter.items).filter((item) =>
  ["upd-ley-karin", "upd-ds-594", "upd-ley-16744"].includes(item.id),
);

export const seedState: AppState = {
  companyProfile: {
    legalName: "Empresa Demo SST SpA",
    industry: "Servicios industriales y mantenimiento",
    headcount: 84,
    riskLevel: "III",
    hasContractors: true,
    sites: ["Casa Matriz Santiago", "Faena Antofagasta", "Bodega Renca"],
    administrator: "Mutual de Seguridad",
  },
  updates: initialUpdates,
  obligations: [
    {
      id: "obl-protocolo-karin",
      updateId: "upd-ley-karin",
      title: "Mantener protocolo de prevención y procedimiento de investigación vigente",
      area: "Personas y Cumplimiento",
      priority: "alto",
      applies: true,
      status: "en_progreso",
      basis:
        "Empresa con trabajadores dependientes y obligación de prevenir acoso, violencia y riesgos psicosociales.",
      howToComply: [
        "Actualizar el protocolo con medidas de prevención, denuncia, investigación y resguardo.",
        "Integrar o alinear el reglamento interno con el procedimiento vigente.",
        "Capacitar a jefaturas y registrar difusión a trabajadores.",
      ],
      evidence: [
        "Protocolo firmado y fechado.",
        "Registro de difusión y capacitaciones.",
        "Trazabilidad de denuncias y medidas de resguardo.",
      ],
      owner: "Gerencia de Personas",
      dueDate: "2026-05-15",
    },
    {
      id: "obl-inspeccion-ds594",
      updateId: "upd-ds-594",
      title: "Levantar matriz de condiciones sanitarias por centro de trabajo",
      area: "Operaciones",
      priority: "alto",
      applies: true,
      status: "pendiente",
      basis: "Todos los centros declarados requieren control verificable de higiene y ambiente laboral.",
      howToComply: [
        "Inspeccionar baños, agua potable, ventilación, iluminación y orden.",
        "Definir hallazgos, responsables y plazo de cierre por sede.",
        "Crear evidencia fotográfica y checklist trazable.",
      ],
      evidence: [
        "Checklist por sede.",
        "Plan de acción con fechas.",
        "Registros fotográficos y cierres.",
      ],
      owner: "Jefatura de Operaciones",
      dueDate: "2026-05-02",
    },
    {
      id: "obl-programa-preventivo",
      updateId: "upd-ley-16744",
      title: "Formalizar programa anual de trabajo preventivo con seguimiento",
      area: "Prevención de Riesgos",
      priority: "medio",
      applies: true,
      status: "en_progreso",
      basis:
        "La empresa presenta dotación, contratistas y operaciones con riesgo que exigen gestión preventiva documentada.",
      howToComply: [
        "Definir objetivos, responsables, frecuencia y KPI preventivos.",
        "Coordinar medidas con el organismo administrador.",
        "Registrar cumplimiento mensual y desviaciones.",
      ],
      evidence: [
        "Programa anual aprobado.",
        "Actas de seguimiento.",
        "Indicadores mensuales de ejecución.",
      ],
      owner: "Asesor SST",
      dueDate: "2026-05-20",
    },
  ],
  documents: [
    {
      id: "doc-matriz-legal",
      name: "Matriz legal SST",
      type: "Base maestra",
      status: "listo",
      linkedObligationIds: ["obl-protocolo-karin", "obl-inspeccion-ds594", "obl-programa-preventivo"],
      lastGeneratedAt: "2026-04-18T18:40:00.000Z",
      description: "Compila normas, criterios de aplicabilidad, responsables y evidencia esperada.",
    },
    {
      id: "doc-plan-cierre",
      name: "Plan de cierre de brechas",
      type: "Plan de acción",
      status: "requiere_revision",
      linkedObligationIds: ["obl-inspeccion-ds594", "obl-programa-preventivo"],
      lastGeneratedAt: "2026-04-18T17:55:00.000Z",
      description: "Prioriza actividades y vencimientos según criticidad y estado.",
    },
    {
      id: "doc-protocolo-karin",
      name: "Borrador protocolo Ley Karin",
      type: "Documento operativo",
      status: "faltante",
      linkedObligationIds: ["obl-protocolo-karin"],
      lastGeneratedAt: null,
      description: "Plantilla para prevención, denuncia e investigación interna.",
    },
  ],
  scanEvents: [
    {
      id: "scan-1",
      executedAt: "2026-04-18T12:05:00.000Z",
      source: "SUSESO / DT / BCN",
      summary: "Escaneo inicial del día con 3 cambios priorizados y 2 obligaciones nuevas o reforzadas.",
      findings: 3,
    },
    {
      id: "scan-2",
      executedAt: "2026-04-17T12:00:00.000Z",
      source: "SUSESO",
      summary: "Sin cambios críticos; se mantuvo monitoreo de compendio preventivo.",
      findings: 1,
    },
  ],
  ingestionRuns: [],
  watchRequests: [
    {
      id: "watch-default-1",
      topic: "ley karin",
      normalizedTopic: "ley karin",
      origin: "manual",
      status: "activo",
      createdAt: "2026-04-18T10:00:00.000Z",
      lastMatchedUpdateId: "upd-ley-karin",
    },
  ],
};
