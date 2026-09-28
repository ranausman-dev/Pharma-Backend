// Import express and initialize a router
import express from "express";
const router = express.Router();

// Define a GET route at /api/health
// This route provides a basic health check for the API
router.get("/", (req, res) => {
  // Get memory usage details from Node.js process
  const mem = process.memoryUsage();

  // Respond with basic server health information
  res.status(200).json({
    status: "UP", // Server status
    uptime: process.uptime(), // Time (in seconds) since the server started
    memory: {
      used: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`,   // RAM currently used
      total: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`, // Total allocated RAM
    },
    timestamp: new Date().toISOString(), // Current time in ISO format
  });
});

// Export the router to be used in the main app
export default router;
