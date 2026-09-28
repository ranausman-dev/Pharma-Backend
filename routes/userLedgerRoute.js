import express from "express";
import userLedgerController from "../controllers/userLedgerController.js";

const router = express.Router();

// User ledger
router.post("/", userLedgerController.addUserLedger);
router.get("/:id", userLedgerController.getUserLedgers);
router.put("/:id", userLedgerController.editUserLedger);


export default router;
