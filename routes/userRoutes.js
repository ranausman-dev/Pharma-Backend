import express from "express";
import userController from "../controllers/userController.js";
import { createUploader } from "../utils/upload.js";

const router = express.Router();

// Create uploader for "users" folder
const uploadUsers = createUploader("users");

router.get("/bookers", userController.getAllBookers);
router.get("/", userController.getAllUsers);
router.get("/active", userController.getAllActiveUsers);
router.get("/:id", userController.getUserById);
router.post("/",userController.createUser);
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);
router.patch("/toggle-status", userController.toggleUserStatus);

export default router;
