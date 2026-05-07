import express from 'express';
import * as db from './database/pg.js';

const app = express();

app.get('/api/debug/db-info', async (req, res) => {
    try {
        const dbInfo = await db.pgGet("SELECT current_database(), current_user, inet_server_addr(), inet_server_port()");
        const productsCols = await db.pgAll("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'");
        res.json({ dbInfo, productsCols });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
