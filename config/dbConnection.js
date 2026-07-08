import mongoose from "mongoose";
import { seedDefaultUser } from "../controllers/seedUser.js";

export const dbConnection = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL); 
    seedDefaultUser()
    console.log("✅ Connected to database");
  } catch (err) {
    console.error("❌ Error connecting to database:", err.message);
    throw err;
  }
};
