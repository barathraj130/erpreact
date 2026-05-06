# 📋 ERP API Quick Reference

## Base URL

```text
http://localhost:3000/api
```

## Default Headers

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```---

## 🔐 Authentication

### Login
```bash
POST /auth/login
{
  "company_code": "DEFAULT",
  "email": "admin@company.com",
  "password": "admin123"
}

Response:
{
  "success": true,
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": 1,
    "name": "Admin User",
    "role": "admin",
    "company": "My Company"
  }
}
```

### Refresh Token
```bash
POST /auth/refresh
{
  "refreshToken": "eyJhbGc..."
}

Response:
{
  "success": true,
  "accessToken": "eyJhbGc..."
}
```

### Get Current User
```bash
GET /auth/me

Response:
{
  "id": 1,
  "email": "admin@company.com",
  "role": "admin",
  "permissions": [...]
}
```

### Logout
```bash
POST /auth/logout
{
  "refreshToken": "eyJhbGc..."
}
```

---

## 📊 Dashboard

### Get Complete Dashboard
```bash
GET /dashboard

Response:
{
  "timestamp": "2026-02-24T10:30:00Z",
  "finance": {
    "bank": { "total_balance": 50000, "accounts": [...] },
    "loans": { "summary": {...} },
    "sales": { "outstanding_invoices": {...} }
  },
  "operations": {
    "inventory": { "critical_count": 3 }
  },
  "hr": { "total_employees": 15, "attendance_today": {...} }
}
```

### Financial Dashboard
```bash
GET /dashboard/finance?startDate=2026-02-01&endDate=2026-02-28

Response:
{
  "summary": {
    "total_income": 500000,
    "total_expenses": 200000,
    "net_profit": 300000,
    "profit_margin_percent": 60,
    "cash_balance": 50000
  },
  "monthly_trend": [...]
}
```

### Customer Analytics
```bash
GET /dashboard/customers

Response:
{
  "top_customers": [...],
  "aging_analysis": [
    { "age_bucket": "Current", "invoice_count": 5, "outstanding_amount": 25000 }
  ]
}
```

### KPI Summary
```bash
GET /dashboard/kpis

Response:
{
  "monthly_sales": 100000,
  "ytd_sales": 500000,
  "outstanding_receivables": 50000,
  "outstanding_payables": 30000,
  "active_loans": 2,
  "total_loan_exposure": 200000,
  "inventory_turnover_ratio": 4.5
}
```

---

## 💰 Finance - Bank

### Add Bank Account
```bash
POST /bank/accounts
{
  "account_name": "Current Account",
  "account_number": "1234567890",
  "bank_name": "ICICI Bank",
  "ifsc_code": "ICIC0000001",
  "account_type": "current",
  "opening_balance": 100000,
  "is_primary": true
}

Response:
{
  "id": 1,
  "account_name": "Current Account",
  "account_number": "1234567890"
}
```

### Get Bank Accounts
```bash
GET /bank/accounts

Response:
[
  {
    "id": 1,
    "account_name": "Current Account",
    "balance": 150000,
    "is_primary": true
  }
]
```

### Import Transactions
```bash
POST /bank/import
{
  "bank_account_id": 1,
  "transactions": [
    {
      "transaction_date": "2026-02-20",
      "description": "Client Payment",
      "amount": 50000,
      "type": "credit",
      "reference_no": "CHQ-001"
    }
  ]
}

Response:
{
  "imported_count": 1,
  "transactions": [...]
}
```

---

## 💳 Finance - Loans

### Create Loan
```bash
POST /loans
{
  "lender_id": 5,
  "loan_amount": 500000,
  "loan_type": "borrowed",
  "interest_type": "compound",
  "interest_rate": 12,
  "loan_period_months": 60,
  "start_date": "2026-01-01"
}

Response:
{
  "id": 1,
  "emi": 11122.24,
  "total_interest": 66934.40
}
```

### Get Loan Details
```bash
GET /loans/1

Response:
{
  "id": 1,
  "loan_amount": 500000,
  "emi": 11122.24,
  "schedule": [
    {
      "installment_number": 1,
      "due_date": "2026-02-01",
      "emi_amount": 11122.24,
      "principal_amount": 9600,
      "interest_amount": 1522.24,
      "status": "PENDING"
    }
  ],
  "payments": [...]
}
```

### Record Loan Payment
```bash
POST /loans/1/payment
{
  "installment_id": 1,
  "amount_paid": 11122.24,
  "payment_date": "2026-02-01",
  "payment_method": "bank_transfer"
}

Response:
{
  "id": 1,
  "status": "COMPLETED"
}
```

### Get Upcoming Due Dates
```bash
GET /loans/upcoming?days=30

Response:
[
  {
    "id": 1,
    "due_date": "2026-03-01",
    "emi_amount": 11122.24,
    "loan_id": 1,
    "party_name": "Bank XYZ"
  }
]
```

---

## 📋 Finance - Accounting

### Create Journal Entry
```bash
POST /accounting/journal
{
  "entry_date": "2026-02-24",
  "entry_number": "JE-001",
  "description": "Sales Recording",
  "reference_type": "invoice",
  "reference_id": 100,
  "line_items": [
    { "account_id": 1, "debit": 100000, "credit": 0, "description": "Debtors" },
    { "account_id": 2, "debit": 0, "credit": 100000, "description": "Sales" }
  ]
}

Response:
{
  "id": 1,
  "entry_number": "JE-001",
  "total_debit": 100000,
  "total_credit": 100000
}
```

### Get Profit & Loss
```bash
GET /accounting/reports/pl?startDate=2026-01-01&endDate=2026-02-28

Response:
{
  "period": { "start": "2026-01-01", "end": "2026-02-28" },
  "revenues": {
    "details": [...],
    "total": 500000
  },
  "expenses": {
    "details": [...],
    "total": 200000
  },
  "net_profit": 300000
}
```

### Get Balance Sheet
```bash
GET /accounting/reports/balancesheet?asOfDate=2026-02-28

Response:
{
  "as_of_date": "2026-02-28",
  "assets": { "details": [...], "total": 1000000 },
  "liabilities": { "details": [...], "total": 500000 },
  "equity": { "details": [...], "total": 500000 },
  "validation": { "balanced": true }
}
```

---

## 📦 Inventory

### Add Stock
```bash
POST /inventory/stock
{
  "product_id": 1,
  "quantity": 100,
  "entry_type": "purchase",
  "cost_per_unit": 500
}

Response:
{
  "product_id": 1,
  "new_quantity": 100,
  "valuation": 50000
}
```

### Get Stock Levels
```bash
GET /inventory/levels

Response:
{
  "all_stocks": [...],
  "low_stock_items": [
    { "id": 1, "product_name": "Product A", "current_stock": 5, "status": "LOW_STOCK" }
  ],
  "out_of_stock_items": [],
  "critical_count": 3
}
```

### Get Inventory Valuation
```bash
GET /inventory/valuation

Response:
{
  "items": [...],
  "total_inventory_value": 500000,
  "total_units": 1000
}
```

---

## 🧾 Sales

### Create Invoice
```bash
POST /invoice
{
  "customer_id": 5,
  "invoice_date": "2026-02-24",
  "due_date": "2026-03-10",
  "line_items": [
    { "product_id": 1, "quantity": 10, "unit_price": 1000, "tax_rate": 18 }
  ]
}

Response:
{
  "invoice_id": 100,
  "invoice_number": 1001,
  "total_amount": 11800
}
```

### Get Invoice
```bash
GET /invoice/100

Response:
{
  "id": 100,
  "invoice_number": 1001,
  "customer_id": 5,
  "total_amount": 11800,
  "status": "DRAFT",
  "line_items": [...]
}
```

### Record Payment
```bash
POST /invoice/100/payment
{
  "amount_paid": 11800,
  "payment_date": "2026-02-25",
  "payment_method": "bank_transfer"
}

Response:
{
  "payment_id": 1,
  "invoice_status": "PAID"
}
```

---

## 👥 HR

### Add Employee
```bash
POST /employees
{
  "name": "John Doe",
  "email": "john@company.com",
  "designation": "Manager",
  "salary": 50000,
  "joining_date": "2026-01-01"
}

Response:
{
  "id": 1,
  "name": "John Doe",
  "email": "john@company.com"
}
```

### Mark Attendance
```bash
POST /hr/attendance
{
  "employee_id": 1,
  "attendance_date": "2026-02-24",
  "status": "present"
}

Response:
{
  "id": 1,
  "status": "success"
}
```

### Calculate Salary
```bash
POST /hr/salary
{
  "employee_id": 1,
  "month": 2,
  "year": 2026
}

Response:
{
  "basic_salary": 50000,
  "deductions": 5000,
  "net_salary": 45000
}
```

### Generate Payslip
```bash
POST /hr/payslips
{
  "employee_id": 1,
  "month": 2,
  "year": 2026
}

Response:
{
  "payslip_id": 1,
  "net_salary": 45000
}
```

---

## 💾 Backup & Recovery

### Create Backup
```bash
POST /backups/create

Response:
{
  "backup_file": "/app/backups/backup_1_2026-02-24.sql",
  "size": 5242880
}
```

### List Backups
```bash
GET /backups/list

Response:
[
  {
    "id": 1,
    "backup_file": "backup_1_2026-02-24.sql",
    "backup_size": 5242880,
    "created_at": "2026-02-24T02:00:00Z"
  }
]
```

### Restore Backup
```bash
POST /backups/1/restore

Response:
{
  "restored": true,
  "backup_id": 1
}
```

### Get Backup Stats
```bash
GET /backups/stats

Response:
{
  "total_backups": 30,
  "total_size_gb": 2.5,
  "last_backup": "2026-02-24T02:00:00Z"
}
```

---

## ⚠️ Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests (Rate Limited) |
| 500 | Server Error |

---

## 🚀 Quick Tips

1. **Always include** `Authorization` header with valid token
2. **Rate limit** is 100 requests per 15 minutes per IP
3. **Tokens expire** in 1 hour - use refresh token to get new access token
4. **Dates** are in ISO format: `YYYY-MM-DD`
5. **Currency** is in rupees (₹) by default
6. **Decimal places** are rounded to 2 for financial data
7. **Empty response** means resource not found (404)
8. **Errors** include `error` field with description

---

**Last Updated**: February 24, 2026
