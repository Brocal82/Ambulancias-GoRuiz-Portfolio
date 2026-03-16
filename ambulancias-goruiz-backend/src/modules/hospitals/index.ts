// backend/src/modules/hospitals/index.ts
export { default as hospitalsRoutes } from "./routes";
export {
  createHospital,
  deleteHospital,
  getAllHospitals,
  updateHospital,
} from "./controllers/hospitals.controller";
export * as hospitalsController from "./controllers/hospitals.controller";
export * as hospitalsService from "./services/hospitals.service";
export * as hospitalsValidators from "./utils/hospital.validators";
export { Hospital } from "./models/hospital.model";
export type { IHospital } from "./models/hospital.model";
export type { HospitalCreateInput } from "./utils/hospital.validators";

