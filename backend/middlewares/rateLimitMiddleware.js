// backend/middlewares/rateLimitMiddleware.js
import rateLimit from "express-rate-limit";

/**
 * Rate limiting middleware for API routes
 * Prevents brute force attacks and abuse
 */

// General API rate limiter - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased significantly for testing
    message: { error: "Too many requests from this IP, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => true // BYPASS FOR TESTING
});

// Strict rate limiter for login attempts
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Increased significantly for testing
    message: { error: "Too many login attempts. Account temporarily locked for security." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => true // BYPASS FOR TESTING
});

// Password reset rate limiter - 3 requests per hour
export const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100,
    message: { error: "Too many password reset attempts. Try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => true // BYPASS FOR TESTING
});

// File upload rate limiter - 10 uploads per hour
export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: { error: "Too many uploads. Try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => true // BYPASS FOR TESTING
});

export default { apiLimiter, loginLimiter, passwordResetLimiter, uploadLimiter };
