import Permission from "../models/permissionModel.js";
import { User } from "../models/userModel.js";
import { sendError, successResponse } from "../utils/response.js";

// Add new permission set for a user
const addPermission = async (req, res) => {
  try {
    const { userId, permissions } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    // Check if permissions already exist
    const existing = await Permission.findOne({ userId });
    if (existing) {
      return sendError(res, "Permissions already exist for this user. Use update instead.", 400);
    }

    const newPermission = await Permission.create({ userId, permissions });

    return successResponse(res, "Permissions added successfully", { newPermission });
  } catch (error) {
    return sendError(res, error.message);
  }
};

// Get permissions of a specific user
const getUserPermissions = async (req, res) => {
  try {
    const { id } = req.params; // userId

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    const permission = await Permission.findOne({ userId: id });
    if (!permission) {
      return sendError(res, "No permissions found for this user", 404);
    }

    return successResponse(res, "User permissions retrieved successfully", { permission });
  } catch (error) {
    return sendError(res, error.message);
  }
};

// Update permissions of a specific user
const updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params; // userId
    const { permissions } = req.body;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    const updated = await Permission.findOneAndUpdate(
      { userId: id },
      { permissions },
      { new: true, upsert: true }
    );

    return successResponse(res, "User permissions updated successfully", { updated });
  } catch (error) {
    return sendError(res, error.message);
  }
};

// Delete all permissions of a specific user
const deleteUserPermissions = async (req, res) => {
  try {
    const { id } = req.params; // userId

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    const deleted = await Permission.findOneAndDelete({ userId: id });
    if (!deleted) {
      return sendError(res, "No permissions found to delete", 404);
    }

    return successResponse(res, "User permissions deleted successfully", { deleted });
  } catch (error) {
    return sendError(res, error.message);
  }
};

const permissionController = {
  addPermission,
  getUserPermissions,
  updateUserPermissions,
  deleteUserPermissions,
};

export default permissionController;
