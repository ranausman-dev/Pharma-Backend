// src/utils/response.js
import { sendErrorToSlack } from "./sendErrorToSlack.js";

// Enhanced response handlers
export const successResponse = (res, message, data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data,
  });
};

export const sendError = (res, message, statusCode = 500, error = null) => {
  // Ensure statusCode is a number
  if (typeof statusCode !== "number") {
    console.warn("⚠️ sendError received non-numeric statusCode:", statusCode);
    statusCode = 500;
  }

  const finalMessage =
    typeof message === "object" && message?.message
      ? message.message
      : message?.toString?.() || "Unexpected error";

  const err = error || new Error(finalMessage);
  err.statusCode = statusCode;

  // Send to Slack in production
  if (process.env.NODE_ENV === "production") {
    sendErrorToSlack(err, {
      endpoint: res.req?.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(statusCode).json({
    success: false,
    message: finalMessage,
    ...(process.env.NODE_ENV === "development" && { error: err.message }),
  });
};


export const errorResponse = (message) => {
  return { success: false, message };
};

// For backwards compatibility
export default {
  successResponse,
  sendError,
  errorResponse
};