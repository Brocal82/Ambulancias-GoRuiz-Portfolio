import express from "express";
import {
  getAllHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
} from "./controllers/hospitals.controller";
import { validateObjectId } from "../../middlewares/validateObjectId";

const router = express.Router();

router.get("/", getAllHospitals);
router.post("/", createHospital);
router.put("/:id", validateObjectId("id"), updateHospital);
router.patch("/:id", validateObjectId("id"), updateHospital);
router.delete("/:id", validateObjectId("id"), deleteHospital);

export default router;

