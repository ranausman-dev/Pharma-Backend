// routes/packSizeRoutes.js
import express from "express";
import packSizeController from "../controllers/packSizeController.js";

const router = express.Router();

router.get("/", packSizeController.getAllPackSizes);
router.get("/search", packSizeController.searchPackSizes);
router.get("/:id", packSizeController.getPackSizeById);
router.post("/", packSizeController.createPackSize);
router.put("/:id", packSizeController.updatePackSize);
router.delete("/:id", packSizeController.deletePackSize);

export default router;
