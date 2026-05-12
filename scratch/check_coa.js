import * as db from '../backend/database/pg.js';

async function checkCOA() {
    try {
        const accounts = await db.pgAll("SELECT * FROM chart_of_accounts");
        console.log("Chart of Accounts:", JSON.stringify(accounts, null, 2));
    } catch (err) {
        console.error("COA check failed:", err);
    }
}

checkCOA();
