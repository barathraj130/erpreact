// backend/middlewares/security.js
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';

export const applySecurityMiddleware = (app) => {
    // 1. UUID Request ID
    app.use((req, res, next) => {
        req.id = uuidv4();
        res.setHeader('X-Request-Id', req.id);
        next();
    });

    // 2. Helmet for Security Headers & CSP
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "blob:"],
                connectSrc: ["'self'"],
                upgradeInsecureRequests: [],
            },
        },
    }));

    // 3. CORS - Restricted to Frontend Origin
    const corsOptions = {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Branch-Id'],
        credentials: true,
        optionsSuccessStatus: 200
    };
    app.use(cors(corsOptions));

    // 4. Rate Limiting
    const globalLimiter = rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 100, // 100 requests per minute
        message: { error: "Too many requests, please try again later." }
    });
    app.use(globalLimiter);

    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts
        message: { error: "Too many login attempts, please try again in 15 minutes." }
    });
    app.use('/api/auth/login', loginLimiter);
    app.use('/api/jwt-auth/login', loginLimiter);

    // 5. Body Limit
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    console.log("✅ Security middleware applied");
};
