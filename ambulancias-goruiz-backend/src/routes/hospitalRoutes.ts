import express from 'express';
import {
  getAllHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
} from '../controllers/hospitalController';

const router = express.Router();

router.get('/', getAllHospitals);
router.post('/', createHospital);
router.put('/:id', updateHospital);
router.patch('/:id', updateHospital);
router.delete('/:id', deleteHospital);


export default router;
