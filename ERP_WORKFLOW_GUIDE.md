# Enterprise ERP: Total Process & Workflow Guide

This document provides a comprehensive overview of the Enterprise ERP system, detailing the core modules, operational workflows, and the underlying accounting logic.

---

## 1. System Architecture & Tech Stack
- **Frontend**: React 19, Vite, Vanilla CSS (Premium Aesthetics), Framer Motion (Animations).
- **Backend**: Node.js Express, PostgreSQL (Atomic Transactions).
- **Key Utilities**: 
  - **AI Engine**: automated data extraction from bills and receipts.
  - **PDF Engine**: Server-side PDF generation for invoices and reports.
  - **Auth**: JWT-based secure authentication.

---

## 2. Core Operational Modules

### A. Sales Module (Order-to-Cash)
1. **Invoice Creation**:
   - Support for **Tax Invoice (GST)**, **Retail Bill**, and **Nominal Tax Invoice**.
   - Real-time GST calculation (Intra-state vs Inter-state).
   - **Broker Integration**: Assign brokers with custom commission rates.
2. **Payment Handling**:
   - Record partial or full payments at the time of sale.
   - Support for multiple payment modes (Cash, Bank, Wallet).
3. **Accounting Impact**:
   - Automatically debits **Customer Ledger** (if credit) or **Cash/Bank Ledger**.
   - Automatically credits **Sales Ledger** and **GST Payable Ledgers**.

### B. Purchases Module (Procure-to-Pay)
1. **Purchase Billing**:
   - **AI-Powered Scanning**: Upload a PDF/Image of a purchase bill; the system extracts items, rates, and HSN codes automatically.
   - Manual entry fallback for manual verification.
2. **Inventory Integration**:
   - Successful purchase bills automatically increment **Inventory Stock Levels**.
3. **Accounting Impact**:
   - Automatically debits **Purchase Ledger** and **Input GST Ledgers**.
   - Automatically credits **Supplier Ledger** (Accounts Payable).

### C. Finance & Accounting (The Core Engine)
1. **Double-Entry Ledger**:
   - Every transaction in Sales, Purchases, or Payments triggers a balanced Journal Entry.
2. **Ledger Groups**:
   - Organized into Assets, Liabilities, Income, and Expenses.
3. **Reports**:
   - **Day Book**: Daily transaction log.
   - **Trial Balance**: Real-time balance verification.
   - **Profit & Loss / Balance Sheet**: Financial health snapshots.

### D. Inventory Management
1. **Stock Tracking**: Real-time monitoring of quantity on hand.
2. **Low Stock Alerts**: Visual indicators when stock falls below the defined threshold.
3. **Product Catalog**: Centralized database for SKU, HSN, and pricing.

---

## 3. Key Business Workflows

### Workflow 1: The "Perfect Sale"
1. Navigate to **Sales > Create Invoice**.
2. Select a **Customer** (system auto-fills GST and Address).
3. Add **Products** (system auto-calculates totals and tax).
4. (Optional) Assign a **Broker**.
5. Save: The system generates a PDF, updates the Customer's balance, records the broker's commission, and posts to the General Ledger.

### Workflow 2: Intelligent Purchase
1. Navigate to **Purchases > New Purchase Bill**.
2. Upload the supplier's bill.
3. Use the **AI Intelligence Suite** to extract data.
4. Verify the items and click **Save**.
5. Result: Inventory increases instantly, and the Supplier's payable balance is updated.

### Workflow 3: Financial Reconciliation
1. Navigate to **Finance > Ledgers**.
2. Select a Customer or Supplier to view their **Transaction History**.
3. Record a **Payment/Receipt** to settle outstanding balances.
4. The system updates the "Current Balance" and clears the ledger entries.

---

## 4. Advanced Intelligence Suite
- **AI Insights**: Predictive analysis of sales trends and inventory turnover.
- **Auto-Categorization**: Intelligent mapping of expenses to ledger groups.
- **Anomaly Detection**: Flags duplicate invoices or suspicious transaction patterns.

---

## 5. Security & Data Integrity
- **Role-Based Access (RBAC)**: Distinct permissions for Admin, Accountant, and Sales Staff.
- **Audit Logs**: Every sensitive action (delete, edit, payment) is logged with a timestamp and user ID.
- **Database Snapshots**: Automated backups to prevent data loss.

---

*Document Generated for: Enterprise Resource Planning System*
*Version: 2.0 (Stable Production Build)*
