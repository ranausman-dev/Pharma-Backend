import express from "express";
import { createUploader } from "../utils/upload.js";
import { uploadSingleImage, uploadMultipleImages } from "../controllers/uploadController.js";

const router = express.Router();

// Upload to "avatars" folder
router.post("/single", createUploader("avatars").single("image"), uploadSingleImage);

// Upload to "gallery" folder
router.post("/multiple", createUploader("gallery").array("images", 5), uploadMultipleImages);

export default router;
