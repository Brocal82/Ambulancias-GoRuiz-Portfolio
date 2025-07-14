import { Router } from 'express';
import {
  getAllAmbulances,
  getAmbulanceById,
  createAmbulance,
  updateAmbulance,
  deleteAmbulance,
} from '../controllers/ambulanceController';

import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

// Rutas protegidas: requiere token válido y rol admin
router.use(authenticateToken);
router.use(authorizeRole('admin'));

router.get('/', getAllAmbulances);
router.get('/:id', getAmbulanceById);
router.post('/', createAmbulance);
router.put('/:id', updateAmbulance);
router.delete('/:id', deleteAmbulance);

export default router;

