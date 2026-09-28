import { sendError } from "../utils/response.js";
import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";
import { catchAsyncErrors } from "./catchAsyncErrors.js";

const verifyToken = async (req, res, next) => {
  const tokenString = req.headers.authorization;

  if (!tokenString) {
    return sendError(res, "Authorization header missing", 401);
  }

  const token = tokenString.split(" ")[1];
  if (!token) {
    return sendError(res, "Bearer token missing", 401);
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not set in environment variables.");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { userId, tokenVersion } = decoded;

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    // Optional: check tokenVersion if you use token invalidation
    if (user.tokenVersion !== undefined && user.tokenVersion !== tokenVersion) {
      return sendError(res, "Session expired. Please login again.", 401);
    }

    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    return sendError(
      res,
      error.name === "TokenExpiredError"
        ? "Token expired. Please login again."
        : "Invalid token",
      401
    );
  }
};

const authorizeRoles = (...allowedRoles) => {
  return catchAsyncErrors(async (req, res, next) => {
    if (!req.user) {
      return sendError(res, "Unauthenticated", 401);
    }

    const userRole = req.user.role?.toLowerCase();
    const hasAccess = allowedRoles.some((role) => role.toLowerCase() === userRole);

    if (!hasAccess) {
      return sendError(
        res,
        `Access denied. Required role(s): ${allowedRoles.join(", ")}`,
        403
      );
    }

    next();
  });
};

export default {
  verifyToken,
  authorizeRoles,
};
