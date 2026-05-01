import requests
import json
from datetime import datetime, timedelta

API_URL = "http://localhost:5001/api/finance"
COMPANY_ID = 1

def seed_data():
    print("🚀 Seeding real-world finance data...")
    
    # 1. Setup Company COA
    try:
        requests.post(f"{API_URL}/setup", json={"company_id": COMPANY_ID})
        print("✅ Chart of Accounts initialized.")
    except:
        print("❌ Server not running? Make sure app.py is started on port 5000.")
        return

    # 2. Add some Bank Accounts (via direct DB if needed, but let's assume we have endpoint or use automation)
    # Since BankAccount creation endpoint wasn't made, let's assume COA covers it, 
    # but for reconciliation we need BankAccount records.
    # We can add a simple internal route or just rely on the automation posting.
    
    # Let's post some loans
    loans = [
        {
            "company_id": COMPANY_ID,
            "party_name": "Michael Corleone",
            "party_type": "EMPLOYEE",
            "loan_direction": "GIVEN",
            "principal_amount": 150000,
            "interest_rate": 10.5,
            "interest_type": "EMI",
            "start_date": (datetime.now() - timedelta(days=60)).strftime('%Y-%m-%d'),
            "duration_months": 12
        },
        {
            "company_id": COMPANY_ID,
            "party_name": "Stark Industries",
            "party_type": "VENDOR",
            "loan_direction": "GIVEN",
            "principal_amount": 1000000,
            "interest_rate": 12.0,
            "interest_type": "SIMPLE",
            "start_date": (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'),
            "duration_months": 24
        }
    ]
    
    for loan in loans:
        requests.post(f"{API_URL}/loans", json=loan)
        print(f"✅ Loan created for {loan['party_name']}")

    # 3. Post some cash receipts
    receipts = [
        {
            "company_id": COMPANY_ID,
            "party_name": "Michael Corleone",
            "amount": 12500,
            "purpose": "Monthly EMI Repayment",
            "loan_id": 1,
            "created_by": 1
        }
    ]
    
    for r in receipts:
        requests.post(f"{API_URL}/cash-receipt", json=r)
        print(f"✅ Cash receipt posted for {r['party_name']}")

    print("\n✨ Seeding completed. You can now view real-time data in the Finance Module.")

if __name__ == "__main__":
    seed_data()
