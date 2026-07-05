import express from "express";
import bulkCashRecoveryController from "../controllers/bulkCashRecoveryController.js";

const router = express.Router();

router.post("/", bulkCashRecoveryController.createBulkRecovery);
router.get("/", bulkCashRecoveryController.getBulkRecoveries);
router.put("/:id", bulkCashRecoveryController.editBulkRecovery);
router.delete("/:id", bulkCashRecoveryController.deleteBulkRecovery);

export default router;
