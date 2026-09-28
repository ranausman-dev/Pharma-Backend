import express from "express";
import  areaController  from "../controllers/areaController.js";
import tokenValidations from "../middleware/tokenValidation.js"; 

const router = express.Router();

router.post("/", areaController.createArea);
router.get("/", areaController.getAllAreas);
router.get("/active", areaController.getAllActiveAreas);
router.get("/:id", areaController.getAreaById);
router.put("/:id", areaController.updateArea);
router.delete("/:id", areaController.deleteArea);
router.patch("/:id/status", areaController.toggleAreaStatus);


export default router;
