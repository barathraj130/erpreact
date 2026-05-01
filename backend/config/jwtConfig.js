// backend/config/jwtConfig.js
import dotenv from "dotenv";
dotenv.config();

export const jwtSecret = process.env.JWT_SECRET || "super_secret_fallback_key_12345";
export const tokenExpiry = "24h";

export default { jwtSecret, tokenExpiry };