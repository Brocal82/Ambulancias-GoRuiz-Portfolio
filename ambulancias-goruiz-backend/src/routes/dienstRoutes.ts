import express from 'express';
import { createDienst, getAllDiensts, getDienstById, updateDienst, updateDienstPartial, deleteDienst } from '../controllers/dienstController';

const router = express.Router();

router.post('/', createDienst); // POST /api/dienst
router.get('/', getAllDiensts)
router.get('/:id', getDienstById);
router.put('/:id', updateDienst);
router.patch('/:id', updateDienstPartial);
router.delete('/:id', deleteDienst);



export default router;

