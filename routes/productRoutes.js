import express from "express";
import productController from "../controllers/productController.js";

const router = express.Router();

router.post("/", productController.createProduct);
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.put("/:id", productController.updateProduct);
router.delete("/:id", productController.deleteProduct);
router.get("/product-transactions/:product_id", productController.getProductTransactions);

export default router;
