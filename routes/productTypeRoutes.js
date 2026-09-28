import express from "express";
import productTypeController from "../controllers/productTypeController.js";

const router = express.Router();

router.get("/", productTypeController.getAllProductTypes);
router.get("/list", productTypeController.listProductTypes);
router.get("/:id", productTypeController.getProductTypeById);
router.post("/", productTypeController.createProductType);
router.put("/:id", productTypeController.updateProductType);
router.delete("/:id", productTypeController.deleteProductType);

export default router;
