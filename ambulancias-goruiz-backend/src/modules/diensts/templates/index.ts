// backend/src/modules/diensts/templates/index.ts
/**
 * TEMPORARY compatibility layer for the diensts module.
 *
 * This slice no longer represents DienstTemplate CRUD ownership.
 * Real template definition and CRUD ownership now lives in the
 * `dienst-templates` module.
 *
 * For now, this folder only re-exports legacy Dienst lifecycle and
 * week-generation behavior that is still owned by `diensts`.
 *
 * It should be refactored or removed in a future migration of the
 * `diensts` module.
 */

export { deleteDienstsForWeek } from "./controllers/delete-diensts-for-week.controller";
export {
  createDienst,
  updateDienst,
  deleteDienst,
  generateDienstTemplatesForWeek,
} from "../../../controllers/dienstController";
