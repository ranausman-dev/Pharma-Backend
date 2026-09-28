import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  const mem = process.memoryUsage();

  res.status(200).json({
    status: "UP",
    uptime: process.uptime(),
    memory: {
      used: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
