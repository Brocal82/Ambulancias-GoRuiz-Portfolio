import express from 'express';
import { createDienst, getAllDiensts, getDienstById } from '../controllers/dienstController';

const router = express.Router();

router.post('/', createDienst); // POST /api/dienst
router.get('/', getAllDiensts)
router.get('/:id', getDienstById);

export default router;

