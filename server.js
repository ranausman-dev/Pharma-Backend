import mongoose from "mongoose";
import "dotenv/config";
import { dbConnection } from "./config/dbConnection.js";
import app from "./app.js";

const PORT = process.env.PORT || 5000;

/* -------------------------- Graceful Shutdown -------------------------- */
process.on("SIGINT", async () => {
  console.log("🔌 SIGINT received. Closing MongoDB...");
  await mongoose.connection.close();
  console.log("✅ MongoDB disconnected");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🔌 SIGTERM received. Closing MongoDB...");
  await mongoose.connection.close();
  console.log("✅ MongoDB disconnected");
  process.exit(0);
});

/* ------------------------- Global Error Catchers ------------------------- */
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Promise Rejection:", err);
  process.exit(1);
});

/* ---------------------------- Start Server ---------------------------- */
dbConnection().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
});
