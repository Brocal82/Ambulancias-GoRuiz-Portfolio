import { Router } from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { listTeams, createTeam, deleteTeam } from '../controllers/teamController';

const router = Router();

router.use(authenticateToken, authorizeRole('admin'));

router.get('/', listTeams);
router.post('/', createTeam);
router.delete('/:id', deleteTeam);

export default router;
