// backend/config/encryptionConfig.js
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// Use environment variables for production encryption keys
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ENCRYPTION_IV = process.env.ENCRYPTION_IV || crypto.randomBytes(16).toString("hex");
const ALGORITHM = "aes-256-cbc";

/**
 * Encrypt sensitive data
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted text with IV prepended
 */
export const encryptData = (text) => {
    if (!text) return text;
    
    try {
        const key = Buffer.from(ENCRYPTION_KEY, "hex");
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(text, "utf8", "hex");
        encrypted += cipher.final("hex");
        
        // Prepend IV to encrypted text for decryption
        return `${iv.toString("hex")}:${encrypted}`;
    } catch (err) {
        console.error("❌ Encryption Error:", err);
        return text;
    }
};

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text with IV prepended
 * @returns {string} - Decrypted text
 */
export const decryptData = (encryptedText) => {
    if (!encryptedText || !encryptedText.includes(":")) return encryptedText;
    
    try {
        const key = Buffer.from(ENCRYPTION_KEY, "hex");
        const [ivHex, encrypted] = encryptedText.split(":");
        const iv = Buffer.from(ivHex, "hex");
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        
        return decrypted;
    } catch (err) {
        console.error("❌ Decryption Error:", err);
        return encryptedText;
    }
};

/**
 * Hash sensitive data (one-way)
 * @param {string} text - Text to hash
 * @returns {string} - Hashed text
 */
export const hashData = (text) => {
    return crypto.createHash("sha256").update(text).digest("hex");
};

export default {
    encryptData,
    decryptData,
    hashData,
    ENCRYPTION_KEY,
    ENCRYPTION_IV,
    ALGORITHM
};
