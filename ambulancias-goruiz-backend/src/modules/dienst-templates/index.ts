// backend/src/modules/dienst-templates/index.ts
// FASE 1: barrel principal del modulo DienstTemplate.
// Esta capa es solo aditiva y de compatibilidad; no cambia el wiring activo.

export * as DienstTemplateControllers from "./controllers";
export * as DienstTemplateModels from "./models";
export { default as dienstTemplateRoutes } from "./routes";
export * as DienstTemplateServices from "./services";
export * as DienstTemplateTypes from "./types";
export * as DienstTemplateUtils from "./utils";
