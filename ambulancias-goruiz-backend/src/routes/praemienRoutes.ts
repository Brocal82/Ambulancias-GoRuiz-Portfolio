import { Router } from 'express';
import { getMonthlyPraemienSummary } from '../controllers/prämienController';
import { authenticateToken } from '../middlewares/authMiddleware';


const router = Router();

router.get('/monthly-summary', authenticateToken, getMonthlyPraemienSummary);

export default router;
