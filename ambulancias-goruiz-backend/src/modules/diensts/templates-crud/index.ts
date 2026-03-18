// backend/src/modules/diensts/templates-crud/index.ts
// FASE 1: capa de compatibilidad -> apunta al modulo real dienst-templates.

export {
  getDienstTemplates,
  createDienstTemplate,
  updateDienstTemplate,
  deleteDienstTemplate,
} from "../../dienst-templates/controllers";
