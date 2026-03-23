import { Router } from "express";
import { createInvitation, validateInvitation, acceptInvitation } from "./controllers/invitations.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { validateBody } from "../../middlewares/validateBody";
import {
  createInvitationSchema,
  acceptInvitationSchema,
} from "./schemas/invitation.schema";

const router = Router();

router.post(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  validateBody(createInvitationSchema),
  createInvitation,
);

router.get("/validate", validateInvitation);

router.post(
  "/accept",
  validateBody(acceptInvitationSchema),
  acceptInvitation,
);

export default router;
