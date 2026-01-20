// backend/server.js
import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import hrRoutes from "./routes/hrRoutes.js";
// --- DATABASE & SEEDING ---
import { runSchemaUpdates } from "./database/schemaUpdates.js";
import { seedPermissions } from "./database/seedPermissions.js";

// --- ROUTE IMPORTS ---
import authRoutes from "./routes/authRoutes.js";
import companyRoutes from "./routes/companyRoutes.js"; // ✅ 1. ADD THIS IMPORT
import customerPortalRoutes from "./routes/customerPortalRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import lenderRoutes from "./routes/lenderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import purchaseBillRoutes from "./routes/purchaseBillRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import signatureRoutes from "./routes/signatureRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- MIDDLEWARES ---
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- STATIC FOLDERS ---
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};
ensureDir("./uploads");
ensureDir("./uploads/signatures");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- MOUNT ROUTES ---
app.use("/api/auth", authRoutes);
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
// ✅ 2. MOUNT THE COMPANY ROUTE HERE
app.use("/api/company", companyRoutes);
app.use("/api/payments", paymentRoutes);
// --- DB INIT & START ---
runSchemaUpdates()
    .then(async () => { await seedPermissions(); })
    .catch(err => { console.error("❌ Database Init Failed:", err); });

app.get("/", (req, res) => res.send("ERP Backend Running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));