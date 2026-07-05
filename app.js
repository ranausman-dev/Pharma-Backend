import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

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

import cors from 'cors';

// import healthRoute from "./routes/health.js"; 

const app = express();

/* ---------------------------- Core Middlewares ---------------------------- */
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Declare limiter first, then use it
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 500,
  message: "Too many requests, try again later",
});

// Allow requests from your frontend
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://pharma-backend-zeta.vercel.app',
    'https://pharma-frontend-five.vercel.app'
  ],
  credentials: true,
}));


// ✅ Test route
app.get("/api/test", (req, res) => {
  res.send("API is running...");
});

// ✅ Apply limiter only to routes
// app.use("/api/health", apiLimiter, healthRoute);  
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
