// backend/src/modules/users/index.ts
export { default as User } from "./models/user.model";
export * as UsersController from "./controllers/users.controller";
export { default as usersRouter } from "./routes";
