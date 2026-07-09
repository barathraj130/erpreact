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
import loanRoutes from "./routes/loanRoutes.js";
import brokerRoutes from "./routes/brokerRoutes.js";
import proprietorRoutes from "./routes/proprietorRoutes.js";
import personalAccountRoutes from "./routes/personalAccountRoutes.js";
import cashTransferRoutes from "./routes/cashTransferRoutes.js";
import salesReturnRoutes from "./routes/salesReturnRoutes.js";
import suppliersRoutes from "./routes/suppliersRoutes.js";
import employeePortalRoutes from "./routes/employeePortalRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import invoicePdfRoutes from "./routes/invoicePdfRoutes.js";
import purchasePdfRoutes from "./routes/purchasePdfRoutes.js";

import ledgerClosingRoutes from "./routes/ledgerClosingRoutes.js";
import reconciliationRoutes from "./routes/reconciliationRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import dayOperationsRoutes from "./routes/dayOperationsRoutes.js";
import branchInventoryRoutes from "./routes/branchInventoryRoutes.js";
import billingConfigRoutes from "./routes/billingConfigRoutes.js";
import customerNotificationsRoutes from "./routes/customerNotificationsRoutes.js";
import paymentMethodsRoutes from "./routes/paymentMethodsRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import intelligenceRoutes from "./routes/intelligenceRoutes.js";
import pointsRoutes from "./routes/pointsRoutes.js";
import resetRoutes from "./routes/resetRoutes.js";
import debugRoutes from "./routes/debugRoutes.js";
import deliveryOrderRoutes from "./routes/deliveryOrderRoutes.js";
import financeReportRoutes from "./routes/reports/finance.js";
import salesReportRoutes from "./routes/reports/sales.js";
import purchaseReportRoutes from "./routes/reports/purchase.js";
import inventoryReportRoutes from "./routes/reports/inventory.js";
import adminRoutes from "./routes/adminRoutes.js";
import gstReportRoutes from "./routes/reports/gst.js";
import hrReportRoutes from "./routes/reports/hr.js";
import expenseReportRoutes from "./routes/reports/expense.js";
import proprietorReportRoutes from "./routes/reports/proprietor.js";
import executiveReportRoutes from "./routes/reports/executive.js";
import stockLotsRoutes from "./routes/stockLots.js";
import stockInspectionsRoutes from "./routes/stockInspections.js";
import stockConversionsRoutes from "./routes/stockConversions.js";
import transactionCategoriesRoutes from "./routes/transactionCategoriesRoutes.js";
import stockInventoryRoutes from "./routes/stockInventory.js";
import stockReportRoutes from "./routes/reports/stock.js";
import productionRoutes from "./routes/production.js";
import financeRoutes from "./routes/financeRoutes.js";
import expenseEntryRoutes from "./routes/expenseEntryRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

// --- MIDDLEWARES ---
app.use(morgan("combined")); // Request logging

app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Branch-ID"]
}));

// Diagnostic middleware
app.use((req, res, next) => {
    console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// File-based logger for debugging
app.use((req, res, next) => {
    const logMsg = `[${new Date().toISOString()}] ${req.method} ${req.url} | User: ${JSON.stringify(req.user || {})}\n`;
    fs.appendFileSync(path.join(__dirname, 'debug.log'), logMsg);
    next();
});

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
ensureDir("./uploads/invoices");
ensureDir("./uploads/ledgers");
ensureDir("./backups");

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- MOUNT ROUTES ---
console.log("🛠️ Mounting Routes...");
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
app.use("/api/suppliers", suppliersRoutes);
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
app.use("/api/transaction-categories", transactionCategoriesRoutes);
app.use("/api/accounting", accountingRoutes);
app.use("/api/toc", tocRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/ai-query", aiQueryRoutes);
app.use("/api/chit-fund", chitFundRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/brokers", brokerRoutes);
app.use("/api/proprietor-transactions", proprietorRoutes);
app.use("/api/personal-accounts", personalAccountRoutes);
app.use("/api/cash-transfers", cashTransferRoutes);
app.use("/api/sales-returns", salesReturnRoutes);
app.use("/api/ledger-closing", ledgerClosingRoutes);
app.use("/api/reconciliation", reconciliationRoutes);
app.use("/api/employee-portal", employeePortalRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/invoice", invoicePdfRoutes);
app.use("/api/purchase-pdf", purchasePdfRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/day-operations", dayOperationsRoutes);
app.use("/api/branch-inventory", branchInventoryRoutes);
app.use("/api/billing-config", billingConfigRoutes);
app.use("/api/customer-notifications", customerNotificationsRoutes);
app.use("/api/payment-methods", paymentMethodsRoutes);
// New granular report sub-routes — must be mounted BEFORE the generic /api/reports
app.use("/api/reports/finance", financeReportRoutes);
app.use("/api/reports/sales", salesReportRoutes);
app.use("/api/reports/purchase", purchaseReportRoutes);
app.use("/api/reports/inventory", inventoryReportRoutes);
app.use("/api/reports/gst", gstReportRoutes);
app.use("/api/reports/hr", hrReportRoutes);
app.use("/api/reports/expense", expenseReportRoutes);
app.use("/api/reports/proprietor", proprietorReportRoutes);
app.use("/api/reports/executive", executiveReportRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/test", testRoutes);
app.use("/api/intelligence", intelligenceRoutes);
app.use("/api/points", pointsRoutes);
app.use("/api/reset", resetRoutes);
app.use("/api/debug", debugRoutes);
app.use("/api/delivery-orders", deliveryOrderRoutes);
app.use("/api/stock-lots", stockLotsRoutes);
app.use("/api/stock-inspections", stockInspectionsRoutes);
app.use("/api/stock-conversions", stockConversionsRoutes);
app.use("/api/stock-inventory", stockInventoryRoutes);
app.use("/api/reports/stock", stockReportRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/expense-entries", expenseEntryRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
console.log("✅ Routes Mounted.");


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

// --- DATABASE INITIALIZATION THEN START SERVER ---
const PORT = process.env.PORT || 3000;
runSchemaUpdates()
    .then(() => {
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
    })
    .catch(err => {
        console.error("❌ Database Init Failed — server NOT started:", err);
        process.exit(1);
    });