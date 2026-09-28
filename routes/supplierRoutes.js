import express from "express";
import supplierController from "../controllers/supplierController.js";

const router = express.Router();

router.get("/", supplierController.getAllSuppliers);
router.get("/active", supplierController.getAllActiveSuppliers);
router.get("/search", supplierController.searchSuppliers);
router.put("/balance", supplierController.addSupplierBalance);
router.get("/supplier-customer", supplierController.getAllActiveSuppliersAndCustomers);
router.get("/:id/ledger", supplierController.getSupplierLedger);
router.get("/:id", supplierController.getSupplierById);
router.post("/", supplierController.createSupplier);
router.put("/:id", supplierController.updateSupplier);
router.delete("/:id", supplierController.deleteSupplier); 
router.put("/:id/recalculate-balance", supplierController.recalculateSupplierBalance);
router.put("/ledger-entry/:entryId", supplierController.editSupplierLedgerEntry);
router.delete("/ledger-entry/:entryId", supplierController.deleteSupplierLedgerEntry);
router.patch("/toggle-status", supplierController.toggleSupplierStatus);
router.patch("/status", supplierController.toggleSupplierStatus);

export default router;
