import mongoose from "mongoose";
import { seedDefaultUser } from "../controllers/seedUser.js";
import dns from "node:dns/promises";

export const dbConnection = async () => {
  try {
    dns.setServers(["8.8.8.8"]);
    await mongoose.connect(process.env.MONGO_URL);
    // await mongoose.connect(process.env.MONGO_DB_TEST)
    seedDefaultUser()
    console.log("✅ Connected to database");
  } catch (err) {
    console.error("❌ Error connecting to database:", err.message);
    throw err;
  }
};
