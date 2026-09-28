import express from "express";
import genericController from "../controllers/genericController.js";

const router = express.Router();

router.get("/", genericController.getAllGenerics);
router.get("/search", genericController.searchGenerics);
router.get("/:id", genericController.getGenericById);
router.post("/", genericController.createGeneric);
router.put("/:id", genericController.updateGeneric);
router.delete("/:id", genericController.deleteGeneric);

export default router;
