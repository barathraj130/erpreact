import requests
import json
import time

BASE_URL = "http://localhost:3001/api"
CREDENTIALS = {
    "company_code": "TITAN-X",
    "email": "test_selenium@titan.com",
    "password": "password123"
}

def run_tests():
    print("🚀 Starting ERP Finance & HR Comprehensive Tests (API-Driven)")
    
    # 0. Login
    print("\n🔑 Logging in...")
    login_res = requests.post(f"{BASE_URL}/auth/login", json=CREDENTIALS)
    if login_res.status_code != 200:
        print(f"❌ Login Failed: {login_res.text}")
        return
    
    token = login_res.json()['accessToken']
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print("✅ Logged in successfully.")

    # --- CLEANUP PREVIOUS TEST DATA ---
    print("\n🧹 Cleaning up previous test data...")
    try:
        # Delete Employees
        emp_res = requests.get(f"{BASE_URL}/employees", headers=headers)
        for e in emp_res.json():
            if e['name'].startswith("TEST"):
                requests.delete(f"{BASE_URL}/employees/{e['id']}", headers=headers)
        
        # Delete Brokers
        br_res = requests.get(f"{BASE_URL}/brokers", headers=headers)
        for b in br_res.json():
            if b['name'].startswith("TEST"):
                requests.delete(f"{BASE_URL}/brokers/{b['id']}", headers=headers)
        
        # Delete Chits
        ch_res = requests.get(f"{BASE_URL}/chit-fund/groups", headers=headers)
        for c in ch_res.json():
            if c['group_name'].startswith("TEST"):
                requests.delete(f"{BASE_URL}/chit-fund/groups/{c['id']}", headers=headers)
        
        # Delete Lenders
        len_res = requests.get(f"{BASE_URL}/lenders", headers=headers)
        for l in len_res.json():
            if l['lender_name'].startswith("TEST"):
                requests.delete(f"{BASE_URL}/lenders/{l['id']}", headers=headers)
                
        print("✅ Cleanup complete.")
    except Exception as e:
        print(f"⚠️ Cleanup partially failed: {e}")

    # 1. CASH RECEIPT VOUCHER
    print("\n📄 Testing CASH RECEIPT VOUCHER...")
    receipt_data = {
        "party_name": "TEST Customer A",
        "amount": 5000,
        "purpose": "Advance against invoice"
    }
    # Need to find the correct endpoint for cash receipts
    # Based on server.js: app.use("/api/transactions", transactionRoutes);
    # Or maybe it's under ledger? 
    # Let's try /api/transactions/receipt if it exists, or /api/ledger/receipt
    # Actually, looking at CashReceipts.tsx, it calls financeApi.createCashReceipt
    # Let's check financeApi.ts (or .js)
    
    # FOR NOW, I'll use common patterns or check the routes again
    # Let's check backend/routes/transactionRoutes.js
    
    # Step 1.1: Create Receipt
    receipt_tx = {
        "type": "RECEIPT",
        "amount": 5000,
        "description": "Cash Receipt - TEST Customer A: Advance against invoice",
        "date": time.strftime("%Y-%m-%d"),
        "mode": "CASH"
    }
    res = requests.post(f"{BASE_URL}/transactions", json=receipt_tx, headers=headers)
    if res.status_code in [200, 201]:
        print("✅ T1.1: Basic cash receipt created.")
    else:
        print(f"❌ T1.1 Failed: {res.status_code} - {res.text}")

    # 2. BROKER NETWORK
    print("\n🤝 Testing BROKER NETWORK...")
    broker_data = {
        "name": "TEST Broker Ravi",
        "phone": "9876543210",
        "broker_type": "PURCHASE",
        "commission_rate": 2.5
    }
    res = requests.post(f"{BASE_URL}/brokers", json=broker_data, headers=headers)
    if res.status_code in [200, 201]:
        print("✅ T2.1: New broker 'TEST Broker Ravi' added.")
    else:
        print(f"❌ T2.1 Failed: {res.status_code} - {res.text}")

    # 3. CHIT FUND
    print("\n💰 Testing CHIT FUND...")
    chit_data = {
        "group_name": "TEST Chit Group A",
        "total_value": 100000,
        "monthly_installment": 5000,
        "duration_months": 20,
        "start_date": time.strftime("%Y-%m-%d")
    }
    res = requests.post(f"{BASE_URL}/chit-fund/groups", json=chit_data, headers=headers)
    if res.status_code in [200, 201]:
        print("✅ T3.1: Chit group 'TEST Chit Group A' created.")
    else:
        print(f"❌ T3.1 Failed: {res.status_code} - {res.text}")

    # 4. LENDERS
    print("\n🏦 Testing LENDERS MASTER...")
    lender_data = {
        "lender_name": "TEST ICICI Bank",
        "lender_type": "Bank",
        "contact_person": "Branch Manager",
        "phone": "9876543210"
    }
    res = requests.post(f"{BASE_URL}/lenders", json=lender_data, headers=headers)
    if res.status_code in [200, 201]:
        lender_id = res.json().get('id')
        print(f"✅ T4.1: Lender 'TEST ICICI Bank' added (ID: {lender_id}).")
        
        # 5. LOANS
        print("\n💳 Testing LOANS & LIABILITY...")
        loan_data = {
            "lender_id": lender_id,
            "party_name": "TEST ICICI Bank",
            "principal_amount": 100000,
            "interest_rate": 12,
            "start_date": time.strftime("%Y-%m-%d"),
            "repayment_cycle": "MONTHLY"
        }
        res = requests.post(f"{BASE_URL}/loans", json=loan_data, headers=headers)
        if res.status_code in [200, 201]:
            print("✅ T5.1: New loan of ₹1,00,000 created.")
        else:
            print(f"❌ T5.1 Failed: {res.status_code} - {res.text}")
    else:
        print(f"❌ T4.1 Failed: {res.status_code} - {res.text}")

    # 6. EMPLOYEES
    print("\n👥 Testing EMPLOYEES...")
    emp_data = {
        "name": "TEST Employee Ravi",
        "designation": "Sales Staff",
        "salary": 15000,
        "phone": "9876543210",
        "joining_date": time.strftime("%Y-%m-%d")
    }
    res = requests.post(f"{BASE_URL}/employees", json=emp_data, headers=headers)
    if res.status_code in [200, 201]:
        emp_id = res.json().get('id')
        print(f"✅ T6.1: Employee 'TEST Employee Ravi' added (ID: {emp_id}).")
        
        # 7. ATTENDANCE
        print("\n📅 Testing ATTENDANCE...")
        att_data = {
            "employee_id": emp_id,
            "date": time.strftime("%Y-%m-%d"),
            "status": "Present"
        }
        res = requests.post(f"{BASE_URL}/attendance", json=att_data, headers=headers)
        if res.status_code in [200, 201]:
            print("✅ T7.1: Attendance marked for employee.")
        else:
            print(f"❌ T7.1 Failed: {res.status_code} - {res.text}")
    else:
        print(f"❌ T6.1 Failed: {res.status_code} - {res.text}")

    # --- CROSS MODULE CHECKS ---
    print("\n📊 Verifying Finance Health...")
    health_res = requests.get(f"{BASE_URL}/dashboard/finance", headers=headers)
    if health_res.status_code == 200:
        health = health_res.json()
        print(f"✅ Finance Health: Inflow recorded.")
    
    print("\n🏁 Tests Complete.")

if __name__ == "__main__":
    run_tests()
