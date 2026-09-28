import express from "express";
import bulkCashRecoveryController from "../controllers/bulkCashRecoveryController.js";

const router = express.Router();

router.post("/", bulkCashRecoveryController.createBulkRecovery);
<<<<<<< HEAD
router.post("/multiple", bulkCashRecoveryController.createMultipleBulkRecoveries);
=======
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
router.get("/", bulkCashRecoveryController.getBulkRecoveries);
router.put("/:id", bulkCashRecoveryController.editBulkRecovery);
router.delete("/:id", bulkCashRecoveryController.deleteBulkRecovery);

export default router;
