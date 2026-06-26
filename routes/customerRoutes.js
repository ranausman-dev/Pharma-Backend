import express from "express";
import customerController from "../controllers/customerController.js";
import supplierController from "../controllers/supplierController.js";
import { createUploader } from "../utils/upload.js";
import { SupplierModel } from "../models/supplierModel.js";

const router = express.Router();

// Create uploader for "customers" folder
const uploadCustomers = createUploader("customers");

router.get("/", customerController.getAllCustomers);
router.get("/active", customerController.getAllActiveCustomers);
router.get("/list", customerController.getCustomerList);
router.get("/:id/edit", customerController.editCustomer);
router.get("/:id/ledger", supplierController.getSupplierLedger);
router.get("/:id", customerController.showCustomer);
router.post("/",customerController.createCustomer);
router.put("/:id", customerController.updateCustomer);
router.delete("/:id", customerController.deleteCustomer);
router.patch("/toggle-status", customerController.toggleCustomerStatus);
router.get("/search/list", customerController.searchCustomers);

export default router;
