import db from '../database/pg.js';

const POINTS_PER_RUPEE = 100; // Every ₹100 = 1 point
const MIN_REDEEM = 50; // Minimum points to redeem
const MAX_REDEEM_PERCENT = 0.20; // Max 20% of bill value

export async function getAvailablePoints(customerId) {
    const result = await db.pgGet(`
        SELECT COALESCE(SUM(points), 0) as balance
        FROM customer_points
        WHERE customer_id = $1
        AND (expires_at IS NULL OR expires_at > NOW())
    `, [customerId]);
    return Number(result.balance) || 0;
}

export async function getPointsBalance(customerId) {
    const result = await db.pgAll(`
        SELECT 
            COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) as total_earned,
            COALESCE(SUM(CASE WHEN points < 0 THEN points ELSE 0 END), 0) as total_redeemed,
            COALESCE(SUM(points), 0) as available_points
        FROM customer_points
        WHERE customer_id = $1
    `, [customerId]);
    
    const row = result[0];
    const expiringSoon = await db.pgGet(`
        SELECT COALESCE(SUM(points), 0) as expiring
        FROM customer_points
        WHERE customer_id = $1 
        AND expires_at IS NOT NULL 
        AND expires_at <= NOW() + INTERVAL '30 days'
        AND expires_at > NOW()
    `, [customerId]);
    
    return {
        available_points: Number(row.available_points) || 0,
        total_earned: Number(row.total_earned) || 0,
        total_redeemed: Math.abs(Number(row.total_redeemed)) || 0,
        points_value: `₹${Number(row.available_points) || 0}`,
        expiring_soon: Number(expiringSoon.expiring) || 0
    };
}

export async function earnPoints(client, customerId, invoiceId, amountPaid, invoiceType, billPurpose) {
    // Only earn points for NON_TAX invoices with real purchases
    if (invoiceType !== 'NON_TAX_INVOICE') return 0;
    if (billPurpose === 'name_only') return 0;
    if (amountPaid <= 0) return 0;
    
    const pointsToEarn = Math.floor(amountPaid / POINTS_PER_RUPEE);
    if (pointsToEarn <= 0) return 0;
    
    // Get current balance
    const lastBalance = await client.query(`
        SELECT COALESCE(balance_after, 0) as bal 
        FROM customer_points 
        WHERE customer_id = $1 
        ORDER BY id DESC LIMIT 1
    `, [customerId]);
    
    const currentBalance = Number(lastBalance.rows[0]?.bal || 0);
    const newBalance = currentBalance + pointsToEarn;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);
    
    await client.query(`
        INSERT INTO customer_points 
            (customer_id, transaction_type, points, reference_id, description, balance_after, expires_at)
        VALUES ($1, 'earned', $2, $3, $4, $5, $6)
    `, [
        customerId,
        pointsToEarn,
        invoiceId,
        `Earned ${pointsToEarn} pts on ₹${amountPaid} retail purchase`,
        newBalance,
        expiresAt
    ]);
    
    return pointsToEarn;
}

export async function redeemPoints(client, customerId, pointsToRedeem, billTotal, invoiceId) {
    const available = await getAvailablePoints(customerId);
    
    if (pointsToRedeem < MIN_REDEEM) {
        throw new Error(`Minimum ${MIN_REDEEM} points required to redeem`);
    }
    
    if (pointsToRedeem > available) {
        throw new Error(`Only ${available} points available`);
    }
    
    const maxDiscount = billTotal * MAX_REDEEM_PERCENT;
    const discount = Math.min(pointsToRedeem, maxDiscount);
    const pointsUsed = Math.floor(discount);
    
    // Get current balance
    const lastBalance = await client.query(`
        SELECT COALESCE(balance_after, 0) as bal 
        FROM customer_points 
        WHERE customer_id = $1 
        ORDER BY id DESC LIMIT 1
    `, [customerId]);
    
    const currentBalance = Number(lastBalance.rows[0]?.bal || 0);
    const newBalance = currentBalance - pointsUsed;
    
    await client.query(`
        INSERT INTO customer_points 
            (customer_id, transaction_type, points, reference_id, description, balance_after)
        VALUES ($1, 'redeemed', $2, $3, $4, $5)
    `, [
        customerId,
        -pointsUsed,
        invoiceId,
        `Redeemed ${pointsUsed} pts = ₹${discount} discount`,
        newBalance
    ]);
    
    return { points_used: pointsUsed, discount: Math.round(discount * 100) / 100 };
}

export async function addBonusPoints(client, customerId, points, reason) {
    const lastBalance = await client.query(`
        SELECT COALESCE(balance_after, 0) as bal 
        FROM customer_points 
        WHERE customer_id = $1 
        ORDER BY id DESC LIMIT 1
    `, [customerId]);
    
    const currentBalance = Number(lastBalance.rows[0]?.bal || 0);
    const newBalance = currentBalance + points;
    
    await client.query(`
        INSERT INTO customer_points 
            (customer_id, transaction_type, points, description, balance_after)
        VALUES ($1, 'bonus', $2, $3, $4)
    `, [customerId, points, `Bonus: ${reason}`, newBalance]);
    
    return points;
}

export async function getPointsHistory(customerId, limit = 100) {
    const rows = await db.pgAll(`
        SELECT 
            created_at as date,
            transaction_type as type,
            points,
            description,
            balance_after
        FROM customer_points
        WHERE customer_id = $1
        ORDER BY created_at DESC
        LIMIT $2
    `, [customerId, limit]);
    
    return rows.map(r => ({
        date: r.date,
        type: r.type,
        points: r.points,
        description: r.description,
        balance_after: r.balance_after
    }));
}

export async function expireOldPoints(client) {
    // Find points that have expired
    const expired = await client.query(`
        SELECT id, customer_id, points, expires_at
        FROM customer_points
        WHERE expires_at IS NOT NULL 
        AND expires_at <= NOW()
        AND points > 0
    `);
    
    for (const row of expired.rows) {
        await client.query(`
            UPDATE customer_points SET points = 0 WHERE id = $1
        `, [row.id]);
        
        // Recalculate balances for customer
        const lastBalance = await client.query(`
            SELECT COALESCE(SUM(points), 0) as bal 
            FROM customer_points 
            WHERE customer_id = $1
        `, [row.customer_id]);
        
        await client.query(`
            INSERT INTO customer_points 
                (customer_id, transaction_type, points, description, balance_after)
            VALUES ($1, 'expired', $2, $3, $4)
        `, [
            row.customer_id,
            -row.points,
            `Expired ${row.points} points`,
            Number(lastBalance.rows[0].bal) - row.points
        ]);
    }
}