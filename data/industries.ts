import type { IndustryOption } from "../src/types";

export const industryOptions: IndustryOption[] = [
  {
    value: "mineria",
    label: "Minería",
    suggestedTopics: ["polvo sílice", "ruido ocupacional", "trabajo en altura", "fatiga y turnos"],
  },
  {
    value: "construccion",
    label: "Construcción",
    suggestedTopics: ["trabajo en altura", "excavaciones", "andamios", "subcontratación"],
  },
  {
    value: "logistica",
    label: "Logística y bodegas",
    suggestedTopics: ["manejo manual de cargas", "grúas horquilla", "tránsito interno", "ergonomía"],
  },
  {
    value: "manufactura",
    label: "Manufactura",
    suggestedTopics: ["bloqueo y etiquetado", "guardas de máquinas", "sustancias peligrosas", "ruido ocupacional"],
  },
  {
    value: "salud",
    label: "Salud",
    suggestedTopics: ["riesgo biológico", "manejo de residuos", "agresiones externas", "fatiga y turnos"],
  },
  {
    value: "retail",
    label: "Retail",
    suggestedTopics: ["ergonomía", "violencia de terceros", "manejo manual de cargas", "emergencias"],
  },
];
