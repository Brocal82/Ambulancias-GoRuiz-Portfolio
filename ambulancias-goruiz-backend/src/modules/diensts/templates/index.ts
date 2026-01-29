// backend/src/modules/diensts/templates/index.ts
// FASE 1: capa de compatibilidad -> re-export de legacy (NO refactor aún)

export {
  createDienst,
  updateDienst,
  deleteDienst,
  generateDienstTemplatesForWeek,
  deleteDienstsForWeek,
} from "../../../controllers/dienstController";
