// backend/src/modules/diensts/templates/index.ts
/**
 * Ciclo de vida de instancias Dienst (create, update, delete, generate-week, delete-week).
 * NO son plantillas: las plantillas reales (DienstTemplate) viven en `dienst-templates`.
 * Carpeta "templates" se mantiene por compatibilidad; el export público es DienstLifecycle.
 */

export { deleteDienstsForWeek } from "./controllers/delete-diensts-for-week.controller";
export {
  createDienst,
  updateDienst,
  deleteDienst,
  generateDienstTemplatesForWeek,
} from "../../../controllers/dienstController";
