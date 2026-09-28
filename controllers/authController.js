import permissionModel from "../models/permissionModel.js";
import { User } from "../models/userModel.js";
import { sendError, successResponse } from "../utils/response.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

//login User
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Check email and password
    if (!email || !password) {
      return sendError(res, "Email and password are required", 400);
    }

    // ✅ Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return sendError(res, "Invalid email or password", 401);
    }

    // ✅ Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, "Invalid email or password", 401);
    }

    // ✅ Check if user is admin
    // if (user.role !== "admin") {
    //   return sendError(res, "Only admin users can log in", 403);
    // }

    // ✅ Create JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // ✅ Success response
    // Inside your login controller, after user authentication
    const permissions = await permissionModel.findOne({ userId: user._id });
    const userPermissions = permissions ? permissions.permissions : [];

    return successResponse(res, "Login successful", {
      token,
      user: {
        id: user._id,
        name: user.name,
        father_name: user.father_name,
        email: user.email,
        mobile_number: user.mobile_number,
        phone_number: user.phone_number,
        city: user.city,
        role: user.role,
        employee_type: user.employee_type,
        status: user.status,
        salary: user.salary,
        incentive_type: user.incentive_type,
        incentive_percentage: user.incentive_percentage,
        cnic: user.cnic,
        profile_photo: user.profile_photo || null,
        permissions: userPermissions, // ✅ Include permissions
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return sendError(res, "Login failed", 500);
  }
};


// UPDATE password
export const updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    // Validate all required fields
    if (!oldPassword || !newPassword || !confirmPassword) {
      return sendError(res, "Old password, new password, and confirm password are required", 400);
    }

    // Validate password length (minimum 6 characters)
    if (newPassword.length < 6) {
      return sendError(res, "New password must be at least 6 characters long", 400);
    }

    if (newPassword !== confirmPassword) {
      return sendError(res, "New password and confirmation password do not match", 400);
    }

    // Fetch user by ID from the decoded JWT token
    const user = await User.findById(req.user.id);
    if (!user) {
      return sendError(res, "User not found");
    }

    // Ensure the logged-in user is the one trying to update the password
    if (req.user.id.toString() !== user.id.toString()) {
      return sendError(res, "You can only update your own password", 403);
    }

    // Check if the old password matches the stored password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return sendError(res, "Old password is incorrect", 400);
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    user.password = hashedPassword;
    await user.save();

    return successResponse(res, "Password updated successfully", { user });
  } catch (error) {
    console.error("Update Password Error:", error);
    sendError(res, "Failed to update password", error);
  }
};




export const logoutUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    return successResponse(res, "Logout successful", {}, 200);
  } catch (error) {
    console.error("Logout error:", error);
    return sendError(res, "Failed to logout", 500);
  }
};


const authController = {
  logoutUser,
  loginUser,
  updatePassword
};

export default authController;
