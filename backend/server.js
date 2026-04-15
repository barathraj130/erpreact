console.log("🚀 Server script starting...");
// backend/server.js
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import hrRoutes from "./routes/hrRoutes.js";
import aiQueryRoutes from "./routes/aiQueryRoutes.js";


dotenv.config();

// --- ROUTE IMPORTS ---
import { runSchemaUpdates } from "./database/schemaUpdates.js";
import { apiLimiter } from "./middlewares/rateLimitMiddleware.js";
import accountingRoutes from "./routes/accountingRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import backupRoutes from "./routes/backupRoutes.js";
import branchRoutes from "./routes/branchRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import customerPortalRoutes from "./routes/customerPortalRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import ledgerRoutes from "./routes/ledgerRoutes.js";
import lenderRoutes from "./routes/lenderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import purchaseBillRoutes from "./routes/purchaseBillRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import signatureRoutes from "./routes/signatureRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import tocRoutes from "./routes/tocRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import chitFundRoutes from "./routes/chitFundRoutes.js";
import employeePortalRoutes from "./routes/employeePortalRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";

import ledgerClosingRoutes from "./routes/ledgerClosingRoutes.js";
import reconciliationRoutes from "./routes/reconciliationRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- MIDDLEWARES ---
app.use(morgan("combined")); // Request logging

app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Branch-ID"]
}));

// Diagnostic middleware
app.use((req, res, next) => {
    console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Apply rate limiting to all API routes
app.use("/api/", apiLimiter);

// --- STATIC FOLDERS ---
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};
ensureDir("./uploads");
ensureDir("./uploads/signatures");
ensureDir("./uploads/products");
ensureDir("./uploads/reports");
ensureDir("./backups");

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- MOUNT ROUTES ---
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/backups", backupRoutes);
app.use("/api/products", productRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/users", signatureRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/purchase-bills", purchaseBillRoutes); 
app.use("/api/lenders", lenderRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/portal", customerPortalRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/accounting", accountingRoutes);
app.use("/api/toc", tocRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/ai-query", aiQueryRoutes);
app.use("/api/chit-fund", chitFundRoutes);
app.use("/api/ledger-closing", ledgerClosingRoutes);
app.use("/api/reconciliation", reconciliationRoutes);
app.use("/api/employee-portal", employeePortalRoutes);
app.use("/api/analytics", analyticsRoutes);


// --- DATABASE INITIALIZATION ---
runSchemaUpdates()
    .catch(err => { console.error("❌ Database Init Failed:", err); });

// --- ERROR HANDLING ---
app.use((err, req, res, next) => {
    console.error("❌ Unhandled Error:", err);
    res.status(err.status || 500).json({ 
        error: err.message || "Internal server error",
        code: err.code || "INTERNAL_ERROR"
    });
});

// --- HEALTH CHECK ---
app.get("/health", (req, res) => {
    res.json({ 
        status: "ok", 
        timestamp: new Date(),
        environment: process.env.NODE_ENV || "development"
    });
});

app.get("/", (req, res) => res.send("✅ ERP Backend Running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🔥 ERP Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🗄️ Database: ${process.env.DATABASE_URL || "postgresql://localhost/erp"}`);
    console.log(`\n✨ Modules Loaded:`);
    console.log(`  ✓ Authentication & Security`);
    console.log(`  ✓ Finance (Bank, Loans, Accounting)`);
    console.log(`  ✓ Sales & Invoicing`);
    console.log(`  ✓ Inventory`);
    console.log(`  ✓ HR & Payroll`);
    console.log(`  ✓ Reports & Analytics`);
    console.log(`  ✓ Backup & Recovery\n`);
});