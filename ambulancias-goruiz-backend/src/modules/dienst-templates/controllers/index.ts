// backend/src/modules/dienst-templates/controllers/index.ts
// FASE 1: capa de compatibilidad para modularizar DienstTemplate sin cambiar runtime.

export {
  getDienstTemplates,
  createDienstTemplate,
  updateDienstTemplate,
  deleteDienstTemplate,
} from "./dienstTemplateController";
