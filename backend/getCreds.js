import db from "./database/pg.js";
async function get() {
    const companies = await db.pgAll("SELECT * FROM companies");
    const users = await db.pgAll("SELECT * FROM users");
    console.log("COMPANIES:", companies.map(c => ({ id: c.id, code: c.company_code })));
    console.log("USERS:", users.map(u => ({ id: u.id, email: u.email, company_id: u.company_id, role: u.role })));
    process.exit(0);
}
get();
