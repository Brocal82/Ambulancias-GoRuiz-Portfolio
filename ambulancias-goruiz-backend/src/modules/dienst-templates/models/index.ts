// backend/src/modules/dienst-templates/models/index.ts
// FASE 1: re-export del modelo legacy mientras movemos la propiedad del modulo.

export { default as DienstTemplate } from "../../../models/DienstTemplate";
export type {
  DaySchedule,
  IDienstTemplate,
} from "../../../models/DienstTemplate";
