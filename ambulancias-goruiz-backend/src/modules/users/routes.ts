import { Router } from "express";
import {
  createUser,
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
} from "./controllers/users.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import {
  authorizeRole,
  authorizeSelfOrAdmin,
} from "../../middlewares/roleMiddleware";
import { validateBody } from "../../middlewares/validateBody";
import { upload } from "../../middlewares/uploadMiddleware";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  registerUserSchema,
  loginUserSchema,
  updateUserSchema,
} from "./schemas/user.schema";

const router = Router();

// Rutas públicas
router.post("/register", validateBody(registerUserSchema), createUser);
router.post("/login", validateBody(loginUserSchema), loginUser);

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
    { name: "documents", maxCount: 5 },
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
    { name: "documents", maxCount: 5 },
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
