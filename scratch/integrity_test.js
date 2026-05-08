import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const API_URL = 'http://localhost:5000/api';
const TOKEN = '...'; // I need a token. I'll fetch it from the user's session if possible or use a known admin.

async function runIntegrityTest() {
    try {
        // 1. Get Token (Assuming I can get it from somewhere or user provides it)
        // For now, I'll assume the server is open or I can bypass for local test if I add a debug flag.
        
        console.log("Starting Integrity Scenarios...");
        
        // Step 1: Create NON-TAX Invoice
        const invRes = await axios.post(`${API_URL}/invoice`, {
            customer_id: 1, // Assume 1 exists
            invoice_type: "NON-TAX_INVOICE",
            items: [{ product_id: 1, qty: 10, rate: 1000, gst_rate: 0 }],
            payments: [
                { payment_method: "CASH", amount: 5000 },
                { payment_method: "UPI", amount: 5000 }
            ],
            amount_paid: 10000,
            bill_purpose: "real"
        }, { headers: { Authorization: `Bearer ${TOKEN}` } });
        
        console.log("Scenario 1 Created:", invRes.data.bill_number);
        
        // Step 2: Create Name-Sake Bill
        const nameRes = await axios.post(`${API_URL}/invoice`, {
            customer_id: 1,
            invoice_type: "TAX_INVOICE",
            items: [{ product_id: 1, qty: 20, rate: 1000, gst_rate: 18 }],
            bill_purpose: "name_only",
            amount_paid: 0
        }, { headers: { Authorization: `Bearer ${TOKEN}` } });
        
        console.log("Scenario 2 Created:", nameRes.data.bill_number);
        
        // Step 3: Verify P&L Isolation
        const plReal = await axios.get(`${API_URL}/reports/finance/profit-loss?filterType=real`, { headers: { Authorization: `Bearer ${TOKEN}` } });
        console.log("Real P&L Sales:", plReal.data.totalIncome);
        
        const plAll = await axios.get(`${API_URL}/reports/finance/profit-loss?filterType=all`, { headers: { Authorization: `Bearer ${TOKEN}` } });
        console.log("All P&L Sales:", plAll.data.totalIncome);
        
    } catch (e) {
        console.error("Test Failed:", e.response?.data || e.message);
    }
}
