//src/routes/dienstRoutes.ts
import express from 'express';
import {
  createDienst,
  getAllDiensts,
  getDienstById,
  updateDienst,
  updateDienstPartial,
  deleteDienst,
  searchDienst,
  getDienstsByUser,
  removeAssignment,
  getAssignedDaysForUser,
  generateDienstTemplatesForWeek,
  deleteDienstsForWeek,
  assignTeamToWeek,
  assignUserToWeek,
  clearPeopleForWeek,
  swapWeekRoles
} from '../controllers/dienstController';

import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';


const router = express.Router();

// 👮‍♂️ Rutas protegidas
router.post('/', authenticateToken, authorizeRole('admin'), createDienst);
router.get('/', authenticateToken, authorizeRole('admin'), getAllDiensts);
router.get('/search', authenticateToken, authorizeRole('admin'), searchDienst);
router.get('/user/:userId', authenticateToken, getDienstsByUser);

// ✅ NUEVA RUTA - antes de las que usan :id
router.get('/assigned-days/:userId', authenticateToken, getAssignedDaysForUser);

router.post('/generate-week', authenticateToken, authorizeRole('admin'), generateDienstTemplatesForWeek);
router.post('/delete-week', authenticateToken, authorizeRole('admin'), deleteDienstsForWeek);

// 👇 Acceso según permisos
router.get('/:id', authenticateToken, getDienstById);
router.put('/:id', authenticateToken, authorizeRole('admin'), updateDienst);

// ✅ Nueva ruta para eliminar un assignment específico
router.patch('/:id/remove-assignment', authenticateToken, authorizeRole('admin'), removeAssignment);

router.patch('/:id', authenticateToken, authorizeRole('admin'), updateDienstPartial);
router.delete('/:id', authenticateToken, authorizeRole('admin'), deleteDienst);

// Asignar un Team completo a todos los días de una semana (solo admin)
router.post('/assign-team-to-week', authenticateToken, authorizeRole('admin'), assignTeamToWeek);

router.post('/swap-week-roles', authenticateToken, authorizeRole('admin'), swapWeekRoles);

// Asignar UN usuario (driver/medic) a toda la semana de un Dienst
router.post('/assign-user-to-week', authenticateToken, authorizeRole('admin'), assignUserToWeek);

router.post('/clear-week-people', authenticateToken, authorizeRole('admin'), clearPeopleForWeek);


export default router;

