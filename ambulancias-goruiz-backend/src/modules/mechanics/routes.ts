import express from "express";
import { registerMechanicsIssueRoutes } from "./registerMechanicsIssueRoutes";

const router = express.Router();
registerMechanicsIssueRoutes(router);
export default router;
