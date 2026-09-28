
import express from "express";
import freeSaleController from "../controllers/freeSaleController.js";

const router = express.Router();

router.get("/", freeSaleController.getAllFreeSales);
router.post("/", freeSaleController.createFreeSale);
router.get("/single-free-sale/:id", freeSaleController.getFreeSaleById);
router.delete("/:id", freeSaleController.deleteFreeSale);


export default router;
