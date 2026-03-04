# 🏗️ MULTI-TENANT ERP PLATFORM - ARCHITECTURE

## 📐 SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + TypeScript)                │
│                         http://localhost:5173                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐       │
│  │  Login Page    │  │  ERP Workspace │  │ Platform Admin │       │
│  │  ────────────  │  │  ────────────  │  │  ────────────  │       │
│  │  • Company Code│  │  • Dashboard   │  │  • Onboarding  │       │
│  │  • Email       │  │  • Sales       │  │  • Tenant List │       │
│  │  • Password    │  │  • Inventory   │  │  • Governance  │       │
│  │                │  │  • Finance     │  │                │       │
│  │  Multi-Tenant  │  │  • HR          │  │  SuperAdmin    │       │
│  │  Authentication│  │  • Reports     │  │  Only          │       │
│  └────────────────┘  └────────────────┘  └────────────────┘       │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │              TENANT CONTEXT PROVIDER                      │      │
│  │  • Active Company ID                                      │      │
│  │  • Active Branch ID                                       │      │
│  │  • Subscription Details                                   │      │
│  │  • Enabled Modules                                        │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP/REST API
                           │ JWT Authentication
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express)                     │
│                        http://localhost:5000                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                   MIDDLEWARE LAYER                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │    │
│  │  │ JWT Auth     │  │ Subscription │  │ Permission   │     │    │
│  │  │ Middleware   │  │ Middleware   │  │ Check        │     │    │
│  │  │ ────────────│  │ ────────────│  │ ────────────│     │    │
│  │  │ • Verify JWT │  │ • Check Mods │  │ • Role Check │     │    │
│  │  │ • Extract    │  │ • Enforce    │  │ • Action     │     │    │
│  │  │   company_id │  │   Limits     │  │   Validate   │     │    │
│  │  │ • Branch     │  │ • Expiry     │  │              │     │    │
│  │  │   Isolation  │  │   Check      │  │              │     │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                      API ROUTES                             │    │
│  │  ┌──────────────────────────────────────────────────┐      │    │
│  │  │ /api/jwt-auth/login  (Multi-tenant login)        │      │    │
│  │  │ /api/jwt-auth/me     (Get user + subscription)   │      │    │
│  │  │ /api/company         (Onboarding + management)   │      │    │
│  │  │ /api/branches        (Branch CRUD + limits)      │      │    │
│  │  │ /api/invoices        (Sales operations)          │      │    │
│  │  │ /api/products        (Inventory management)      │      │    │
│  │  │ /api/purchase-bills  (Purchase + stock update)   │      │    │
│  │  │ /api/transactions    (Finance + ledger)          │      │    │
│  │  │ /api/employees       (HR management)             │      │    │
│  │  │ /api/reports         (Consolidated analytics)    │      │    │
│  │  │ /api/subscriptions   (Provider governance)       │      │    │
│  │  └──────────────────────────────────────────────────┘      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ SQL Queries
                           │ Transactional Operations
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              MULTI-TENANT DATA SCHEMA                       │    │
│  │                                                              │    │
│  │  ┌──────────────────────────────────────────────────┐      │    │
│  │  │  TENANT MANAGEMENT                                │      │    │
│  │  │  • companies (id, company_name, subscription_id) │      │    │
│  │  │  • subscriptions (plan, limits, modules, expiry) │      │    │
│  │  │  • branches (id, company_id, branch_name)        │      │    │
│  │  │  • users (id, company_id, branch_id, role)       │      │    │
│  │  └──────────────────────────────────────────────────┘      │    │
│  │                                                              │    │
│  │  ┌──────────────────────────────────────────────────┐      │    │
│  │  │  OPERATIONAL DATA (All with company_id)          │      │    │
│  │  │  • invoices (company_id, branch_id, ...)         │      │    │
│  │  │  • invoice_line_items                            │      │    │
│  │  │  • products (company_id, current_stock, ...)     │      │    │
│  │  │  • purchase_bills (company_id, branch_id, ...)   │      │    │
│  │  │  • purchase_bill_items (bill_id, product_id, qty)│      │    │
│  │  │  • transactions (company_id, branch_id, ...)     │      │    │
│  │  │  • ledger_entries (company_id, account_id, ...)  │      │    │
│  │  │  • employees (company_id, branch_id, ...)        │      │    │
│  │  │  • attendance (company_id, employee_id, ...)     │      │    │
│  │  └──────────────────────────────────────────────────┘      │    │
│  │                                                              │    │
│  │  ┌──────────────────────────────────────────────────┐      │    │
│  │  │  DATA ISOLATION MECHANISM                        │      │    │
│  │  │  Every query automatically filtered:             │      │    │
│  │  │  WHERE company_id = $1 AND branch_id = $2        │      │    │
│  │  └──────────────────────────────────────────────────┘      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 AUTHENTICATION FLOW

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. Enter: company_code, email, password
     ▼
┌─────────────────────────────────────────┐
│  POST /api/jwt-auth/login               │
├─────────────────────────────────────────┤
│  1. Find company by company_code        │
│  2. Check subscription status           │
│  3. Validate user credentials           │
│  4. Load permissions                    │
│  5. Generate JWT with:                  │
│     • user_id                           │
│     • company_id                        │
│     • branch_id                         │
│     • role                              │
│     • enabled_modules                   │
│     • permissions                       │
└────┬────────────────────────────────────┘
     │ 6. Return JWT token
     ▼
┌──────────────────────────────────────────┐
│  Frontend stores token                   │
│  Redirects to /dashboard                 │
└──────────────────────────────────────────┘
```

---

## 🏢 TENANT ISOLATION FLOW

```
┌──────────────────────────────────────────────────────────┐
│  User makes API request with JWT                         │
└────┬─────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────┐
│  JWT Middleware                                           │
│  • Decode token                                           │
│  • Extract company_id = 123                               │
│  • Extract branch_id = 5 (or from header)                 │
│  • Attach to req.user                                     │
└────┬─────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────┐
│  Subscription Middleware (if applicable)                  │
│  • Check if module enabled                                │
│  • Check if limit reached                                 │
│  • Allow/Deny request                                     │
└────┬─────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────┐
│  Route Handler                                            │
│  • Uses req.user.company_id in queries                    │
│  • Uses req.user.branch_id for filtering                  │
│                                                            │
│  Example:                                                 │
│  SELECT * FROM invoices                                   │
│  WHERE company_id = 123                                   │
│  AND branch_id = 5                                        │
└────┬─────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────┐
│  Database returns ONLY data for company 123, branch 5     │
└──────────────────────────────────────────────────────────┘
```

---

## 📦 INVENTORY AUTOMATION FLOW

```
┌──────────────────────────────────────────────────────────┐
│  User creates Purchase Bill                               │
│  • Supplier: ABC Supplies                                 │
│  • Items:                                                 │
│    - Laptop (product_id: 10), Qty: 5, Price: ₹50,000     │
│    - Mouse (product_id: 15), Qty: 20, Price: ₹500        │
└────┬─────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────┐
│  POST /api/purchase-bills                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │  BEGIN TRANSACTION                                  │  │
│  │                                                      │  │
│  │  1. INSERT INTO purchase_bills                      │  │
│  │     (company_id, branch_id, supplier_id, ...)       │  │
│  │     RETURNING id = 100                              │  │
│  │                                                      │  │
│  │  2. For each line item:                             │  │
│  │     INSERT INTO purchase_bill_items                 │  │
│  │     (bill_id=100, product_id, qty, price)           │  │
│  │                                                      │  │
│  │  3. For each line item:                             │  │
│  │     UPDATE products                                 │  │
│  │     SET current_stock = current_stock + qty         │  │
│  │     WHERE id = product_id                           │  │
│  │     AND company_id = 123                            │  │
│  │                                                      │  │
│  │     • Laptop: stock 10 → 15 (+5)                    │  │
│  │     • Mouse: stock 50 → 70 (+20)                    │  │
│  │                                                      │  │
│  │  4. (Optional) Create accounting entries            │  │
│  │     DR: Inventory Asset                             │  │
│  │     CR: Accounts Payable                            │  │
│  │                                                      │  │
│  │  COMMIT                                             │  │
│  └────────────────────────────────────────────────────┘  │
└────┬─────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────┐
│  ✅ Stock automatically updated                           │
│  ✅ Purchase recorded                                     │
│  ✅ Accounting entries posted                             │
│  ✅ All changes atomic (transaction)                      │
└──────────────────────────────────────────────────────────┘
```

---

## 🌳 BRANCH HIERARCHY

```
Company: ACME Corporation (company_id: 123)
│
├── Subscription: Enterprise Plan
│   ├── max_branches: 10
│   ├── max_users: 100
│   ├── enabled_modules: "sales,inventory,finance,hr,ai"
│   └── expiry_date: 2027-12-31
│
├── Branch 1: Main Office (branch_id: 1)
│   ├── Users: 25
│   ├── Invoices: 150
│   ├── Products: 50
│   └── Transactions: 300
│
├── Branch 2: North Branch (branch_id: 2)
│   ├── Users: 15
│   ├── Invoices: 80
│   ├── Products: 50 (shared catalog)
│   └── Transactions: 150
│
└── Branch 3: South Branch (branch_id: 3)
    ├── Users: 10
    ├── Invoices: 60
    ├── Products: 50 (shared catalog)
    └── Transactions: 100

Consolidated View (All Branches):
├── Total Users: 50
├── Total Invoices: 290
├── Total Revenue: ₹15,00,000
└── Total Transactions: 550
```

---

## 🔒 ROLE-BASED ACCESS CONTROL

```
┌─────────────────────────────────────────────────────────┐
│  SuperAdmin                                              │
│  • Access: ALL companies                                 │
│  • Can: Onboard tenants, manage subscriptions            │
│  • Special: Platform Nexus access                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Company Admin                                           │
│  • Access: Own company (all branches)                    │
│  • Can: Switch branches, manage users, full ERP access   │
│  • Restrictions: Subscription limits apply               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Branch Manager                                          │
│  • Access: Own company (assigned branch ONLY)            │
│  • Can: Manage branch operations, view branch data       │
│  • Restrictions: Cannot switch branches                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Staff                                                   │
│  • Access: Own company (assigned branch)                 │
│  • Can: Limited operations based on permissions          │
│  • Restrictions: Read-only or specific actions           │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 DATA FLOW EXAMPLE

### **Scenario: Create Invoice in Branch 2**

```
1. User (Company Admin) switches to Branch 2
   ├── Frontend: setActiveBranch({ id: 2, name: "North Branch" })
   └── Context: Updates active branch state

2. User creates invoice
   ├── Frontend: POST /api/invoices
   │   Headers: { Authorization: "Bearer <JWT>", x-branch-id: 2 }
   │   Body: { customer_id: 50, items: [...], total: 25000 }
   │
   └── Backend: authMiddleware extracts:
       ├── company_id: 123 (from JWT)
       └── branch_id: 2 (from header or JWT)

3. Database INSERT
   ├── INSERT INTO invoices
   │   (company_id, branch_id, customer_id, total, ...)
   │   VALUES (123, 2, 50, 25000, ...)
   │
   └── Result: Invoice created for Company 123, Branch 2

4. User switches to Branch 1
   ├── Frontend: setActiveBranch({ id: 1, name: "Main Office" })
   └── Context: Updates active branch state

5. User views invoices
   ├── Frontend: GET /api/invoices
   │   Headers: { Authorization: "Bearer <JWT>", x-branch-id: 1 }
   │
   └── Backend: SELECT * FROM invoices
       WHERE company_id = 123 AND branch_id = 1
       
   Result: Invoice from Branch 2 NOT visible ✓

6. User views consolidated report
   ├── Frontend: GET /api/reports/consolidated/financials
   │   (No branch filter)
   │
   └── Backend: SELECT SUM(total) FROM invoices
       WHERE company_id = 123
       
   Result: All branches aggregated ✓
```

---

## 🎯 KEY DESIGN PRINCIPLES

### **1. Shared-Nothing Architecture**
- Each company's data is completely isolated
- No cross-tenant data leakage possible
- Enforced at database query level

### **2. Subscription-Based Feature Gating**
- UI hides disabled modules
- API blocks access to disabled features
- Graceful degradation

### **3. Transactional Integrity**
- All multi-step operations use DB transactions
- Atomic commits (all or nothing)
- Data consistency guaranteed

### **4. Zero Functional Compromise**
- Every tenant gets 100% ERP functionality
- Multi-tenancy is transparent to users
- Identical UX for all companies

### **5. Scalable by Design**
- Add unlimited tenants without code changes
- Database indexed on company_id
- Efficient query performance

---

## 🚀 DEPLOYMENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│  Production Environment                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────┐      ┌────────────────┐            │
│  │  Load Balancer │─────▶│  Frontend      │            │
│  │  (Nginx/CDN)   │      │  (React SPA)   │            │
│  └────────────────┘      └────────────────┘            │
│         │                                                │
│         ▼                                                │
│  ┌────────────────────────────────────┐                │
│  │  Backend API Servers               │                │
│  │  (Node.js + Express)               │                │
│  │  • Horizontal scaling              │                │
│  │  • Stateless design                │                │
│  │  • JWT authentication              │                │
│  └────────────┬───────────────────────┘                │
│               │                                          │
│               ▼                                          │
│  ┌────────────────────────────────────┐                │
│  │  PostgreSQL Database               │                │
│  │  • Connection pooling              │                │
│  │  • Indexed on company_id           │                │
│  │  • Regular backups                 │                │
│  │  • Replication for HA              │                │
│  └────────────────────────────────────┘                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

**Architecture Status**: ✅ **PRODUCTION-READY**  
**Last Updated**: 2026-02-17 18:34:35 IST
