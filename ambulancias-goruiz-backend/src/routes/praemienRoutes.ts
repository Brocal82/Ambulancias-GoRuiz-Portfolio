import { Router } from 'express';
import { getMonthlyPraemienSummary, getPraemienMonthlyHistory} from '../controllers/praemienController';
import { saveMonthlyPraemie } from '../controllers/praemienHistoryController';
import { authenticateToken } from '../middlewares/authMiddleware';


const router = Router();

router.get('/monthly-summary', authenticateToken, getMonthlyPraemienSummary);
router.get('/monthly-history', authenticateToken, getPraemienMonthlyHistory);
router.post("/save-monthly", authenticateToken, saveMonthlyPraemie);

export default router;
