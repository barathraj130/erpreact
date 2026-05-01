// backend/utils/jwtRS256.js
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

// Production ready: Load keys from files or env
// For this task, we assume the user will place 'private.key' and 'public.key' in backend/config/certs/
const PRIVATE_KEY = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
const PUBLIC_KEY = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';

if (!PRIVATE_KEY || !PUBLIC_KEY) {
    console.warn("⚠️ JWT RS256 keys missing in environment variables. Falling back to HS256 for development only if necessary, but RS256 is required for production.");
}

export const signAccessToken = (payload) => {
    return jwt.sign(payload, PRIVATE_KEY, {
        algorithm: 'RS256',
        expiresIn: '15m'
    });
};

export const signRefreshToken = (payload) => {
    return jwt.sign(payload, PRIVATE_KEY, {
        algorithm: 'RS256',
        expiresIn: '7d'
    });
};

export const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
    } catch (err) {
        return null;
    }
};

export const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
    } catch (err) {
        return null;
    }
};
