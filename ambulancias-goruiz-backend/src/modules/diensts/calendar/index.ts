// backend/src/modules/diensts/calendar/index.ts
// FASE 1: capa de compatibilidad -> re-export de legacy (NO refactor aún)

export {
  getAllDiensts,
  getDienstById,
  getDienstsByUser,
  searchDienst,
} from "../../../controllers/dienstController";
