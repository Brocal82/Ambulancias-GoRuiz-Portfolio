// backend/src/modules/diensts/templates-crud/index.ts
// FASE 1: capa de compatibilidad -> re-export de legacy (NO refactor aún)

export {
  getDienstTemplates,
  createDienstTemplate,
  updateDienstTemplate,
  deleteDienstTemplate,
} from "../../../controllers/dienstTemplateController";
