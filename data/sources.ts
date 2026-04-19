import type { NormUpdate, SourceCode, SourceMode } from "../src/types";

export type SourceAdapter = {
  code: SourceCode;
  label: string;
  officialUrl: string;
  remoteUrl: string;
  coverage: string;
  mode: SourceMode;
  items: NormUpdate[];
  keywords: string[];
  category: string;
};

export const sourceAdapters: SourceAdapter[] = [
  {
    code: "BCN",
    label: "Biblioteca del Congreso Nacional",
    officialUrl: "https://www.bcn.cl",
    remoteUrl: "https://www.bcn.cl/leychile/navegar?idNorma=167766",
    coverage: "Leyes, decretos y reglamentos base",
    mode: "snapshot",
    category: "Condiciones sanitarias",
    keywords: ["seguridad", "salud", "trabajo", "higiene", "subcontrat"],
    items: [
      {
        id: "upd-ds-594",
        title: "DS 594: condiciones sanitarias y ambientales básicas en lugares de trabajo",
        source: "BCN",
        category: "Condiciones sanitarias",
        publishedAt: "1999-09-15",
        effectiveAt: "2000-01-01",
        impactLevel: "alto",
        status: "monitoreado",
        summary:
          "Regula ventilación, servicios higiénicos, agua potable, iluminación, agentes físicos y condiciones mínimas de higiene industrial.",
        applicabilityReason:
          "Aplica a todos los centros de trabajo informados por la empresa y es base de fiscalización sanitaria.",
        officialUrl: "https://www.bcn.cl/leychile/navegar?idNorma=167766",
        keyPoints: [
          "Todo centro debe contar con servicios higiénicos adecuados.",
          "Las condiciones ambientales deben evaluarse y controlarse.",
          "La evidencia operativa es fiscalizable en terreno.",
        ],
      },
      {
        id: "upd-reglamento-subcontratacion",
        title: "Refuerzo del deber de coordinación preventiva en trabajo en régimen de subcontratación",
        source: "BCN",
        category: "Subcontratación",
        publishedAt: "2026-04-18",
        effectiveAt: "2026-04-18",
        impactLevel: "medio",
        status: "nuevo",
        summary:
          "El snapshot de BCN prioriza obligaciones de coordinación entre empresa principal, contratistas y subcontratistas para control de riesgos.",
        applicabilityReason:
          "Aplica cuando la empresa declara subcontratación y mantiene más de un centro de trabajo con terceros.",
        officialUrl: "https://www.bcn.cl",
        keyPoints: [
          "Debe existir coordinación de riesgos y responsabilidades.",
          "Se requiere trazabilidad de inducciones y controles compartidos.",
          "La documentación preventiva debe ser exigible a contratistas.",
        ],
      },
    ],
  },
  {
    code: "SUSESO",
    label: "Superintendencia de Seguridad Social",
    officialUrl: "https://www.suseso.cl/613/w3-propertyvalue-68955.html",
    remoteUrl: "https://www.suseso.cl/613/w3-propertyvalue-68955.html",
    coverage: "Compendio, dictámenes y obligaciones preventivas",
    mode: "snapshot",
    category: "Gestión preventiva",
    keywords: ["seguridad", "salud", "trabajo", "comité", "prevención"],
    items: [
      {
        id: "upd-ley-16744",
        title: "Ley 16.744 y obligaciones preventivas del empleador",
        source: "SUSESO",
        category: "Gestión preventiva",
        publishedAt: "1968-02-01",
        effectiveAt: "1968-05-01",
        impactLevel: "alto",
        status: "en_revision",
        summary:
          "Consolida deberes de prevención, implementación de medidas, entrega de elementos de protección y coordinación con el organismo administrador.",
        applicabilityReason:
          "Aplica por ser entidad empleadora adherida a organismo administrador y por exposición a riesgos operacionales.",
        officialUrl: "https://www.suseso.cl/613/w3-propertyvalue-68955.html",
        keyPoints: [
          "Debe implementarse la gestión preventiva prescrita por normativa y organismo administrador.",
          "El empleador debe proveer elementos de protección personal sin costo.",
          "Se requiere seguimiento formal de medidas correctivas.",
        ],
      },
      {
        id: "upd-comite-paritario",
        title: "Refuerzo de obligaciones sobre Comité Paritario y trazabilidad de acuerdos",
        source: "SUSESO",
        category: "Gobernanza SST",
        publishedAt: "2026-04-18",
        effectiveAt: "2026-04-18",
        impactLevel: "medio",
        status: "nuevo",
        summary:
          "Se detecta criterio que refuerza la necesidad de registrar acuerdos, investigaciones y medidas adoptadas por el Comité Paritario.",
        applicabilityReason:
          "La empresa supera 25 trabajadores y requiere verificar constitución, funcionamiento y respaldo de actas.",
        officialUrl: "https://www.suseso.cl/613/w3-propertyvalue-69075.html",
        keyPoints: [
          "Deben mantenerse actas y seguimiento de acuerdos.",
          "El comité participa en investigación y vigilancia preventiva.",
          "La evidencia documental debe estar disponible en fiscalización.",
        ],
      },
    ],
  },
  {
    code: "DT",
    label: "Dirección del Trabajo",
    officialUrl: "https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-192736.html",
    remoteUrl: "https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-194680.html",
    coverage: "Dictámenes, procedimientos y criterios laborales",
    mode: "snapshot",
    category: "Seguridad en el trabajo",
    keywords: ["seguridad", "salud", "trabajo", "acoso", "violencia", "protección"],
    items: [
      {
        id: "upd-ley-karin",
        title: "Ley Karin y procedimiento de investigación por acoso, violencia y riesgos psicosociales",
        source: "DT",
        category: "Riesgos psicosociales",
        publishedAt: "2025-06-03",
        effectiveAt: "2024-08-01",
        impactLevel: "alto",
        status: "nuevo",
        summary:
          "La Dirección del Trabajo refuerza plazos y reglas del procedimiento de investigación, y exige medidas de resguardo y protocolos preventivos actualizados.",
        applicabilityReason:
          "Aplica porque la empresa cuenta con trabajadores dependientes, reglamento interno y obligación de prevención frente a acoso y violencia en el trabajo.",
        officialUrl: "https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-192736.html",
        keyPoints: [
          "Debe existir protocolo preventivo comunicado a toda la organización.",
          "Las investigaciones tienen plazos reglados y requieren resguardo documentado.",
          "Las medidas deben integrarse al reglamento interno o protocolo equivalente.",
        ],
      },
    ],
  },
  {
    code: "MINSAL",
    label: "Ministerio de Salud",
    officialUrl: "https://www.minsal.cl",
    remoteUrl: "https://www.minsal.cl",
    coverage: "Regulación sanitaria y vigilancia ocupacional",
    mode: "snapshot",
    category: "Higiene ocupacional",
    keywords: ["salud", "trabajo", "ocupacional", "vigilancia", "riesgo"],
    items: [
      {
        id: "upd-vigilancia-ambiental",
        title: "Ajuste de foco en vigilancia de agentes físicos y ambientales por centro de trabajo",
        source: "MINSAL",
        category: "Higiene ocupacional",
        publishedAt: "2026-04-18",
        effectiveAt: "2026-04-18",
        impactLevel: "medio",
        status: "nuevo",
        summary:
          "El monitoreo diario levanta recordatorio regulatorio sobre evaluación de exposición a ruido, ventilación y condiciones de ambiente laboral.",
        applicabilityReason:
          "Aplica por existir bodegas y faenas con exposición operacional y por obligación general de control ambiental.",
        officialUrl: "https://www.minsal.cl",
        keyPoints: [
          "Debe existir programa de mediciones cuando el riesgo lo amerita.",
          "La evaluación debe vincularse al mapa de riesgos.",
          "La evidencia debe mantenerse por centro de trabajo.",
        ],
      },
    ],
  },
  {
    code: "SEC",
    label: "Superintendencia de Electricidad y Combustibles",
    officialUrl: "https://www.sec.cl",
    remoteUrl: "https://www.sec.cl/centro-de-descargas/",
    coverage: "Normativa eléctrica, combustibles y seguridad técnica",
    mode: "snapshot",
    category: "Electricidad y combustibles",
    keywords: ["seguridad", "electric", "combustible", "gas", "instalacion", "norma"],
    items: [
      {
        id: "upd-sec-decreto-109",
        title: "SEC: Reglamento de seguridad de las instalaciones eléctricas",
        source: "SEC",
        category: "Electricidad y combustibles",
        publishedAt: "2026-04-18",
        effectiveAt: "2026-04-18",
        impactLevel: "medio",
        status: "nuevo",
        summary:
          "La SEC mantiene normativa y pliegos técnicos relevantes para instalaciones eléctricas y seguridad operacional.",
        applicabilityReason:
          "Aplica cuando la empresa opera instalaciones eléctricas, estaciones de servicio, gas o actividades reguladas por SEC.",
        officialUrl: "https://www.sec.cl/decreto-n109-aprueba-reglamento-de-seguridad-de-las-instalaciones-electricas/",
        keyPoints: [
          "Existen requisitos técnicos de diseño, operación y mantenimiento.",
          "Puede haber impacto directo en combustibles e instalaciones.",
          "La empresa debe revisar exigencias sectoriales específicas.",
        ],
      },
    ],
  },
  {
    code: "DO",
    label: "Diario Oficial",
    officialUrl: "https://www.diariooficial.interior.gob.cl",
    remoteUrl: "https://www.diariooficial.interior.gob.cl",
    coverage: "Publicación oficial de leyes, decretos y resoluciones",
    mode: "snapshot",
    category: "Publicación oficial",
    keywords: ["decreto", "ley", "resolución", "seguridad", "salud", "trabajo"],
    items: [
      {
        id: "upd-do-publicacion-oficial",
        title: "Diario Oficial: publicación oficial de normas jurídicas",
        source: "DO",
        category: "Publicación oficial",
        publishedAt: "2026-04-18",
        effectiveAt: "2026-04-18",
        impactLevel: "medio",
        status: "monitoreado",
        summary:
          "El Diario Oficial es la fuente de publicación oficial para leyes, decretos y otras actuaciones jurídicas del Estado.",
        applicabilityReason:
          "Aplica para verificar vigencia y publicación oficial de cambios normativos relevantes en SST.",
        officialUrl: "https://www.diariooficial.interior.gob.cl/quienes-somos/",
        keyPoints: [
          "Permite confirmar publicación oficial de normas.",
          "Es clave para vigencia y trazabilidad jurídica.",
          "Debe usarse como control complementario de cambios.",
        ],
      },
    ],
  },
];
