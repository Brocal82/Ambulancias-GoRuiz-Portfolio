import express from 'express';
import { createDienst } from '../controllers/dienstController';

const router = express.Router();

router.post('/', createDienst); // POST /api/dienst

export default router;
