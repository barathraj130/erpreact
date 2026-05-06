console.log("Starting minimal server...");
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import productRoutes from "./routes/productRoutes.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/products", productRoutes);

app.get("/", (req, res) => res.send("Minimal Server Running"));

app.listen(3001, () => console.log("Minimal server on 3001"));
