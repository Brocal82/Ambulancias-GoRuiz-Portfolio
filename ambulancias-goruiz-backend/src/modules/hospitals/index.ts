// backend/src/modules/hospitals/index.ts
export { default as hospitalsRoutes } from "./routes";
export {
  createHospital,
  deleteHospital,
  getAllHospitals,
  updateHospital,
} from "./controller";
export * as hospitalsController from "./controller";
export * as hospitalsService from "./service";
export * as hospitalsValidators from "./validators";
export { Hospital } from "./model";
export type { IHospital } from "./model";
export type { HospitalCreateInput } from "./validators";

