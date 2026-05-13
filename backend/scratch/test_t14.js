import axios from 'axios';

async function testPurchaseBill() {
    try {
        // 1. Get token
        console.log("Logging in...");
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            username: 'admin',
            password: 'password123'
        });
        const token = loginRes.data.token;
        const headers = { Authorization: `Bearer ${token}` };

        // 2. Create supplier
        console.log("Creating supplier...");
        const suppRes = await axios.post('http://localhost:5000/api/suppliers', {
            name: "TEST_SUPPLIER_TXN_NEW",
            phone: "9000000099",
            state: "Tamil Nadu",
            gstin: "33AABCT1332L1ZF"
        }, { headers });
        const supplierId = suppRes.data.id;

        // 3. Create product
        console.log("Creating product...");
        const prodRes = await axios.post('http://localhost:5000/api/products', {
            name: "TEST_PRODUCT_TXN_NEW",
            sku: "TXN-NEW-123",
            cost_price: 1000,
            selling_price: 1500,
            gst_percent: 18,
            opening_stock: 0,
            min_stock: 5,
            unit: "pcs",
            hsn_code: "6006",
            category: "Trading"
        }, { headers });
        const productId = prodRes.data.id;

        // 4. Create Purchase Bill (like T1.4)
        console.log("Creating purchase bill...");
        const pbRes = await axios.post('http://localhost:5000/api/purchase-bills', {
            supplier_id: supplierId,
            bill_type: "TAX",
            bill_date: "2026-05-13",
            items: [
                {
                    product_id: productId,
                    quantity: 10,
                    unit_price: 1000,
                    tax_percent: 18
                }
            ],
            taxable_amount: 10000,
            cgst_amount: 900,
            sgst_amount: 900,
            total_amount: 11800,
            payments: [
                { mode: "CASH", amount: 5000, payment_date: "2026-05-13" },
                { mode: "BANK", amount: 3000, payment_date: "2026-05-13" }
            ],
            total_paid: 8000,
            balance_amount: 3800
        }, { headers });

        console.log("✅ Purchase bill created!", pbRes.data);
    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    }
}

testPurchaseBill();
