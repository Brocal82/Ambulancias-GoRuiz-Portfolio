import { Router } from "express";
import {
  getUsers,
  updateUser,
  getUserById,
  deleteUser,
  loginUser,
  getAllUsersDienst,
  getAvailableUsersForDate,
  uploadUserFiles,
  uploadUserFilesForUser,
  deleteUserDocument,
  deleteUserDocumentForUser,
  revokeMySessions,
  getMyMfaStatus,
  startMyMfaEnrollment,
  confirmMyMfaEnrollment,
  disableMyMfa,
  issueMyStepUpSession,
} from "./controllers/users.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import {
  authorizeRole,
  authorizeSelfOrAdmin,
  authorizeSuperadmin,
} from "../../middlewares/roleMiddleware";
import { validateBody } from "../../middlewares/validateBody";
import { upload } from "../../middlewares/uploadMiddleware";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  loginUserSchema,
  mfaCodeSchema,
  updateUserSchema,
} from "./schemas/user.schema";

const router = Router();

// Rutas públicas
router.post("/register", (_req, res) => {
  res.status(403).json({
    message: "El registro público está deshabilitado. Se requiere invitación de un administrador de empresa.",
  });
});
router.post("/login", validateBody(loginUserSchema), loginUser);
router.post("/sessions/revoke-all", authenticateToken, revokeMySessions);
router.get("/me/mfa/status", authenticateToken, authorizeSuperadmin, getMyMfaStatus);
router.post(
  "/me/mfa/totp/enroll",
  authenticateToken,
  authorizeSuperadmin,
  startMyMfaEnrollment,
);
router.post(
  "/me/mfa/totp/confirm",
  authenticateToken,
  authorizeSuperadmin,
  validateBody(mfaCodeSchema),
  confirmMyMfaEnrollment,
);
router.post(
  "/me/mfa/totp/disable",
  authenticateToken,
  authorizeSuperadmin,
  validateBody(mfaCodeSchema),
  disableMyMfa,
);
router.post(
  "/me/step-up-session",
  authenticateToken,
  authorizeSuperadmin,
  validateBody(mfaCodeSchema),
  issueMyStepUpSession,
);

// ⚠️ Rutas personalizadas antes de `/:id`
router.get(
  "/diensts",
  authenticateToken,
  authorizeRole("admin"),
  getAllUsersDienst,
); // ✅ ya existente
router.get(
  "/available",
  authenticateToken,
  authorizeRole("admin"),
  getAvailableUsersForDate,
); // ✅ nueva ruta

// Ruta para actualizar el perfil del usuario autenticado
router.patch("/me", authenticateToken, validateBody(updateUserSchema), updateUser);
router.post(
  "/me/upload",
  authenticateToken,
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "documents", maxCount: 1 },
  ]),
  uploadUserFiles,
);
router.delete("/me/document", authenticateToken, deleteUserDocument);

// Rutas protegidas para usuarios
router.get("/", authenticateToken, authorizeRole("admin"), getUsers);
router.post(
  "/:userId/upload",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("userId"),
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "documents", maxCount: 1 },
  ]),
  uploadUserFilesForUser,
);
router.delete(
  "/:userId/document",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("userId"),
  deleteUserDocumentForUser,
);
router.get(
  "/:id",
  authenticateToken,
  validateObjectId("id"),
  authorizeSelfOrAdmin,
  getUserById,
);
router.put(
  "/:id",
  authenticateToken,
  validateObjectId("id"),
  authorizeSelfOrAdmin,
  validateBody(updateUserSchema),
  updateUser,
);
router.patch(
  "/:id",
  authenticateToken,
  validateObjectId("id"),
  authorizeSelfOrAdmin,
  validateBody(updateUserSchema),
  updateUser,
);

router.delete(
  "/:id",
  authenticateToken,
  validateObjectId("id"),
  authorizeSelfOrAdmin,
  deleteUser,
);

export default router;
