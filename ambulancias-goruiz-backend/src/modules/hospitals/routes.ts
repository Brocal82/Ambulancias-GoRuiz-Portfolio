import express from "express";
import {
  getAllHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
} from "./controller";

const router = express.Router();

router.get("/", getAllHospitals);
router.post("/", createHospital);
router.put("/:id", updateHospital);
router.patch("/:id", updateHospital);
router.delete("/:id", deleteHospital);

export default router;

