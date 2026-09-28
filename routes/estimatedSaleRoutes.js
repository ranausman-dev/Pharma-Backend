<<<<<<< HEAD
import express from "express";
import estimatedSaleController from "../controllers/estimatedSaleController.js";

const router = express.Router();

// create estimated sales 
router.post("/", estimatedSaleController.createEstimatedSale);
router.get("/", estimatedSaleController.getAllEstimatedSales); 
router.delete("/:orderId", estimatedSaleController.deleteEstimatedSale); 
router.get("/:orderId", estimatedSaleController.getEstimatedSaleById);
router.put("/update/:orderId", estimatedSaleController.updateEstimatedSale);

export default router;
=======
import express from "express";
import estimatedSaleController from "../controllers/estimatedSaleController.js";

const router = express.Router();

// create estimated sales 
router.post("/", estimatedSaleController.createEstimatedSale);
router.get("/", estimatedSaleController.getAllEstimatedSales); 
router.delete("/:orderId", estimatedSaleController.deleteEstimatedSale); 
router.get("/:orderId", estimatedSaleController.getEstimatedSaleById);
router.put("/update/:orderId", estimatedSaleController.updateEstimatedSale);

export default router;
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
