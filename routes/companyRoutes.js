import express from "express";
import companyController from "../controllers/companyController.js";
import { createUploader } from "../utils/upload.js";

const router = express.Router();

// Create uploader for "company" folder
const uploadCompany_logo = createUploader("company");

router.post(
    "/",
    uploadCompany_logo.single("company_logo"),
    companyController.createCompany
);

router.get("/", companyController.getAllCompanies);
router.get("/:id", companyController.getCompanyById);
router.put("/:id", companyController.updateCompany);
router.delete("/:id", companyController.deleteCompany);

export default router;
