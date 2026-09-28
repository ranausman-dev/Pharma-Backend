
import express from "express";
import freeSaleDescController from "../controllers/freeSaleDescController.js";

const router = express.Router();

router.get("/", freeSaleDescController.getAllFreeSaleDesc);
router.post("/", freeSaleDescController.createFreeSaleDesc);


export default router;
