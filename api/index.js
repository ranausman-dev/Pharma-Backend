import app from "../app.js";
import { dbConnection } from "../config/dbConnection.js";

let isConnected = false;

export default async function handler(req, res) {
  if (!isConnected) {
    try {
      await dbConnection();
      isConnected = true;
    } catch (err) {
      console.error("❌ DB connection failed in Vercel:", err.message);
      return res.status(500).json({ success: false, message: "DB connection error" });
    }
  }

  return app.handle(req, res);
}
