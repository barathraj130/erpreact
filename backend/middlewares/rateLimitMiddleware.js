// backend/middlewares/rateLimitMiddleware.js
import rateLimit from "express-rate-limit";

/**
 * Rate limiting middleware for API routes
 * Prevents brute force attacks and abuse
 */

// General API rate limiter - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for authenticated admin users
        return req.user && req.user.role === "admin";
    }
});

// Strict rate limiter for login attempts - 5 requests per 15 minutes
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Increased for developer testing
    message: "Too many login attempts. Account temporarily locked for security.",
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => false
});

// Password reset rate limiter - 3 requests per hour
export const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: "Too many password reset attempts. Try again later.",
    standardHeaders: true,
    legacyHeaders: false
});

// File upload rate limiter - 10 uploads per hour
export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many uploads. Try again later.",
    standardHeaders: true,
    legacyHeaders: false
});

export default { apiLimiter, loginLimiter, passwordResetLimiter, uploadLimiter };
