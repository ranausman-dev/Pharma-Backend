import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cors from 'cors';

import userRoute from "./routes/userRoutes.js";
import authRoute from "./routes/authRoutes.js";
import productRoute from "./routes/productRoutes.js";
import supplierRoute from "./routes/supplierRoutes.js";
import customerRoute from "./routes/customerRoutes.js";
import areaRoute from "./routes/areaRoutes.js";
import genericRoute from "./routes/genericRoutes.js";
import companyRoute from "./routes/companyRoutes.js";
import productTypeRoute from "./routes/productTypeRoutes.js";
import purchaseRoute from "./routes/purchaseRoutes.js";
import saleRoute from "./routes/saleRoutes.js";
import packSizeRoute from "./routes/packSizeRoutes.js";
import userLedgerRoute from "./routes/userLedgerRoute.js";
import freeSaleDescRoute from "./routes/freeSaleDescRoutes.js";
import freeSaleRoute from "./routes/freeSaleRoutes.js";
import estimatedSaleRoute from "./routes/estimatedSaleRoutes.js";
import permissionRoute from "./routes/permissionRoutes.js";
import investorRoute from "./routes/investorRoute.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import bulkCashRecoveryRoute from "./routes/bulkCashRecoveryRoutes.js";

const app = express();

/* ---------------------------- Core Middlewares ---------------------------- */
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ✅ CORS must come before all routes
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://pharma-backend-zeta.vercel.app',
    'https://pharma-frontend-five.vercel.app'
  ],
  credentials: true,
}));

// ✅ Rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 500,
  message: "Too many requests, try again later",
});

// ✅ Test route
app.get("/api/test", (req, res) => {
  res.send("API is running...");
});

// ✅ In-memory temp store for PDFs (auto-cleared after 5 min or after download)
const _tempPdfStore = new Map();

// STEP 1 – Frontend POSTs the base64 PDF and gets back a short-lived token
app.post("/api/reports/store-pdf", (req, res) => {
  const { pdfBase64, filename } = req.body;
  if (!pdfBase64) return res.status(400).json({ error: "PDF data is required" });

  // Generate a simple unique token
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  _tempPdfStore.set(token, { pdfBase64, filename: filename || "report.pdf" });

  // Auto-clean after 5 minutes in case the download never happens
  setTimeout(() => _tempPdfStore.delete(token), 5 * 60 * 1000);

  res.json({ token });
});

// STEP 2a – URL contains filename as last segment so IDM picks it up correctly
//            e.g. /api/reports/download-pdf/<token>/business-analysis-report.pdf
const _servePdf = (req, res, token) => {
  const data = _tempPdfStore.get(token);
  if (!data) return res.status(404).send("File not found or link expired");

  try {
    const base64Data = data.pdfBase64.replace(/^data:[^,]+,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const safeFilename = data.filename.replace(/[^\w.\-]/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);

    _tempPdfStore.delete(token);
  } catch (err) {
    console.error("PDF download error:", err);
    res.status(500).send("Error serving PDF");
  }
};

// Route WITH filename in URL path — IDM uses last URL segment as filename ✅
app.get("/api/reports/download-pdf/:token/:filename", (req, res) => {
  _servePdf(req, res, req.params.token);
});

// Route WITHOUT filename — backward compat
app.get("/api/reports/download-pdf/:token", (req, res) => {
  _servePdf(req, res, req.params.token);
});

// ✅ Apply rate limiter to all API routes
app.use("/api/users", apiLimiter, userRoute);
app.use("/api/auth", apiLimiter, authRoute);
app.use("/api/product", apiLimiter, productRoute);
app.use("/api/area", apiLimiter, areaRoute);
app.use("/api/supplier", apiLimiter, supplierRoute);
app.use("/api/customer", apiLimiter, customerRoute);
app.use("/api/company", apiLimiter, companyRoute);
app.use("/api/generic", apiLimiter, genericRoute);
app.use("/api/product-type", apiLimiter, productTypeRoute);
app.use("/api/purchase", apiLimiter, purchaseRoute);
app.use("/api/sale", apiLimiter, saleRoute);
app.use("/api/pack-size", apiLimiter, packSizeRoute);
app.use("/api/user-ledger", apiLimiter, userLedgerRoute);
app.use("/api/free-sale-desc", apiLimiter, freeSaleDescRoute);
app.use("/api/free-sale", apiLimiter, freeSaleRoute);
app.use("/api/estimated-sale", apiLimiter, estimatedSaleRoute);
app.use("/api/permissions", apiLimiter, permissionRoute);
app.use("/api/investor", apiLimiter, investorRoute);
app.use("/api/bulk-recovery", apiLimiter, bulkCashRecoveryRoute);

app.use("/uploads", express.static("uploads")); // Serve uploaded images
app.use("/api/upload", uploadRoutes);

export default app;
