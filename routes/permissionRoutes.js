import express from "express";
import tokenValidations from "../middleware/tokenValidation.js";
import permissionController from "../controllers/permissionController.js";

const router = express.Router();

// Create new permission entry for a user
router.post("/", permissionController.addPermission);

// Get permissions of a specific user
router.get("/:id", permissionController.getUserPermissions);

// Update permissions of a specific user
router.put("/:id", permissionController.updateUserPermissions);

// Delete permissions of a specific user
router.delete("/:id", permissionController.deleteUserPermissions);

export default router;
