
console.log("Starting import test...");
import cors from "cors";
console.log("✅ cors loaded");
import dotenv from "dotenv";
console.log("✅ dotenv loaded");
import express from "express";
console.log("✅ express loaded");
import { runSchemaUpdates } from "./database/schemaUpdates.js";
console.log("✅ schemaUpdates loaded");
import authRoutes from "./routes/authRoutes.js";
console.log("✅ authRoutes loaded");
import dashboardRoutes from "./routes/dashboardRoutes.js";
console.log("✅ dashboardRoutes loaded");
console.log("🚀 All critical imports loaded!");
