import express from "express";
import investorController from "../controllers/investorController.js";
import tokenValidation from "../middleware/tokenValidation.js";

const router = express.Router();

// ✅ Add new investor
router.post("/", investorController.addInvestor);

// ✅ Add new Investment 
router.put("/new-investment/:id", investorController.addInvestment);

// ✅ Update specific investment in amount_invested array
router.put("/:investorId/investment/:investmentId", investorController.updateInvestment);

// ✅ Get all investors with summary
router.get("/", investorController.getInvestors);

// ✅ Get single investor by ID
router.get("/:id", investorController.getInvestorById);

// ✅ Update investor
router.put("/:id", investorController.editInvestor);

// ✅ Add debit/credit transaction for investor 
router.post("/:id/transaction", investorController.addInvestorLedger);

// ✅ Edit debit/credit transaction for investor 
router.put("/:id/transaction/:entryId", investorController.editInvestorLedger);

// Get transactions
router.get("/:id/transactions", investorController.getInvestorTransactions);

// Get Single transactions
router.get("/:id/transactions/:transactionId", investorController.getInvestorTransactionById);

// Delete ledger entry
router.delete("/:id/transaction/:entryId", investorController.deleteInvestorLedger);

// Recalculate balance
router.put("/:id/recalculate-balance", investorController.recalculateInvestorBalance);

export default router;
