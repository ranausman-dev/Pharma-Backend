/**
 * Local dev server using mongodb-memory-server
 * Run with: node server-local.js
 */
import "dotenv/config";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { seed } from "./seed.js";
import app from "./app.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "skjdhkheiury89ghe9";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const PORT = parseInt(process.env.PORT, 10) || 5001;

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Promise Rejection:", err);
});

async function startServer() {
  console.log("⏳ Starting in-memory MongoDB...");
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log(`✅ In-memory MongoDB started at: ${uri}`);

  await mongoose.connect(uri);
  console.log("✅ Connected to in-memory database");

  console.log("🌱 Seeding database with initial data & admin user...");
  await seed(false);

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Backend server listening on http://0.0.0.0:${PORT} (and http://localhost:${PORT})`);
  });

  server.on("error", (err) => {
    console.error("❌ HTTP Server Error:", err);
  });

  server.on("close", () => {
    console.warn("⚠️ HTTP Server closed!");
  });

  process.on("SIGINT", async () => {
    server.close();
    await mongoose.connection.close();
    await mongod.stop();
    console.log("✅ Cleaned up and exiting.");
    process.exit(0);
  });
}

startServer().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
