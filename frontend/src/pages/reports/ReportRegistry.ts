export const reportRegistry: Record<string, any> = {
    "sales-register": {
        title: "Sales Register",
        endpoint: "/reports/sales/register",
        showTaxFilter: true,
        columns: [
            { header: "Date", key: "date", type: "date" },
            { header: "Invoice No", key: "invoice_no" },
            { header: "Customer", key: "customer_name" },
            { header: "Taxable Value", key: "taxable_amount", type: "amount", align: "right" },
            { header: "GST", key: "total_tax", type: "amount", align: "right" },
            { header: "Total", key: "total_amount", type: "amount", align: "right" },
            { header: "Payment Status", key: "status", type: "status" },
            { header: "Broker", key: "broker_name" }
        ]
    },
    "customer-sales": {
        title: "Customer-wise Sales Summary",
        endpoint: "/reports/sales/customer-wise",
        columns: [
            { header: "Customer Name", key: "customer_name" },
            { header: "Total Invoices", key: "invoice_count" },
            { header: "Total Sales", key: "total_sales", type: "amount", align: "right" },
            { header: "Total Paid", key: "total_paid", type: "amount", align: "right" },
            { header: "Balance", key: "balance", type: "amount", align: "right" },
            { header: "Last Activity", key: "last_date", type: "date" }
        ]
    },
    "product-sales": {
        title: "Product-wise Sales Analysis",
        endpoint: "/reports/sales/product-wise",
        columns: [
            { header: "Product Name", key: "product_name" },
            { header: "Qty Sold", key: "total_qty" },
            { header: "Avg Price", key: "avg_price", type: "amount", align: "right" },
            { header: "Revenue", key: "revenue", type: "amount", align: "right" },
            { header: "Profit Margin", key: "margin_pct", align: "right" }
        ]
    },
    "stock-summary": {
        title: "Inventory Stock Summary",
        endpoint: "/reports/inventory/summary",
        columns: [
            { header: "Product Name", key: "name" },
            { header: "SKU", key: "sku" },
            { header: "Current Stock", key: "current_stock" },
            { header: "Unit", key: "unit" },
            { header: "Avg Cost", key: "avg_cost", type: "amount", align: "right" },
            { header: "Stock Value", key: "stock_value", type: "amount", align: "right" }
        ]
    },
    "day-book": {
        title: "General Day Book",
        endpoint: "/reports/finance/day-book",
        columns: [
            { header: "Time", key: "created_at" },
            { header: "Type", key: "entry_type" },
            { header: "Particulars", key: "description" },
            { header: "Debit (Out)", key: "debit", type: "amount", align: "right" },
            { header: "Credit (In)", key: "credit", type: "amount", align: "right" },
            { header: "Voucher #", key: "id" }
        ]
    },
    "trial-balance": {
        title: "Trial Balance Statement",
        endpoint: "/reports/finance/trial-balance",
        columns: [
            { header: "Account Name", key: "ledger_name" },
            { header: "Opening Balance", key: "opening", type: "amount", align: "right" },
            { header: "Debit", key: "debit", type: "amount", align: "right" },
            { header: "Credit", key: "credit", type: "amount", align: "right" },
            { header: "Closing Balance", key: "closing", type: "amount", align: "right" }
        ]
    },
    "purchase-register": {
        title: "Purchase Register",
        endpoint: "/reports/purchase/register",
        showTaxFilter: true,
        columns: [
            { header: "Date", key: "date", type: "date" },
            { header: "Bill No", key: "bill_no" },
            { header: "Supplier", key: "supplier_name" },
            { header: "Taxable Value", key: "taxable_amount", type: "amount", align: "right" },
            { header: "Input GST", key: "total_tax", type: "amount", align: "right" },
            { header: "Total Amount", key: "total_amount", type: "amount", align: "right" },
            { header: "Status", key: "status" }
        ]
    },
    "supplier-purchase": {
        title: "Supplier-wise Purchase Report",
        endpoint: "/reports/purchase/supplier-wise",
        columns: [
            { header: "Supplier Name", key: "supplier_name" },
            { header: "Total Bills", key: "bill_count" },
            { header: "Total Purchase", key: "total_purchase", type: "amount", align: "right" },
            { header: "Total Paid", key: "total_paid", type: "amount", align: "right" },
            { header: "Outstanding", key: "balance", type: "amount", align: "right" }
        ]
    },
    "payment-collection": {
        title: "Payment Collection Report",
        endpoint: "/reports/sales/payment-collection",
        columns: [
            { header: "Date", key: "date", type: "date" },
            { header: "Customer", key: "customer_name" },
            { header: "Method", key: "method" },
            { header: "Reference", key: "reference" },
            { header: "Collected Amount", key: "amount", type: "amount", align: "right" }
        ]
    },
    "gst-summary": {
        title: "GST Summary Report",
        endpoint: "/reports/gst/summary",
        columns: [
            { header: "Month", key: "month" },
            { header: "Output CGST", key: "output_cgst", type: "amount", align: "right" },
            { header: "Output SGST", key: "output_sgst", type: "amount", align: "right" },
            { header: "Input CGST", key: "input_cgst", type: "amount", align: "right" },
            { header: "Input SGST", key: "input_sgst", type: "amount", align: "right" },
            { header: "Net Liability", key: "net_liability", type: "amount", align: "right" }
        ]
    },
    "itc-report": {
        title: "Input Tax Credit (ITC) Report",
        endpoint: "/reports/gst/itc",
        columns: [
            { header: "Supplier", key: "supplier_name" },
            { header: "Bill No", key: "bill_no" },
            { header: "Date", key: "date", type: "date" },
            { header: "Taxable Value", key: "taxable_amount", type: "amount", align: "right" },
            { header: "Total Tax", key: "total_tax", type: "amount", align: "right" },
            { header: "GSTIN", key: "gstin" }
        ]
    },
    "stock-movement": {
        title: "Stock Movement Report",
        endpoint: "/reports/inventory/movement",
        columns: [
            { header: "Date", key: "date", type: "date" },
            { header: "Product", key: "product_name" },
            { header: "Type", key: "type" },
            { header: "Ref #", key: "reference" },
            { header: "Qty In", key: "qty_in" },
            { header: "Qty Out", key: "qty_out" },
            { header: "Balance", key: "balance" }
        ]
    },
    "attendance-report": {
        title: "Employee Attendance Summary",
        endpoint: "/reports/hr/attendance",
        columns: [
            { header: "Employee", key: "name" },
            { header: "Present", key: "present_days" },
            { header: "Absent", key: "absent_days" },
            { header: "On-Duty", key: "od_days" },
            { header: "Attendance %", key: "pct" }
        ]
    },
    "salary-report": {
        title: "Salary Register",
        endpoint: "/reports/hr/salary",
        columns: [
            { header: "Employee", key: "name" },
            { header: "Gross Salary", key: "gross", type: "amount", align: "right" },
            { header: "Deductions", key: "deductions", type: "amount", align: "right" },
            { header: "Net Paid", key: "net", type: "amount", align: "right" },
            { header: "Status", key: "status" }
        ]
    },
    "broker-sales": {
        title: "Broker-wise Sales",
        endpoint: "/reports/sales/broker-wise",
        columns: [
            { header: "Broker Name", key: "broker_name" },
            { header: "Invoices Generated", key: "invoice_count" },
            { header: "Total Sales", key: "total_sales", type: "amount", align: "right" },
            { header: "Commission", key: "commission", type: "amount", align: "right" }
        ]
    },
    "sales-return": {
        title: "Sales Return Report",
        endpoint: "/reports/sales/returns",
        columns: [
            { header: "Date", key: "date", type: "date" },
            { header: "Return Note No", key: "return_no" },
            { header: "Customer Name", key: "customer_name" },
            { header: "Amount", key: "amount", type: "amount", align: "right" }
        ]
    },
    "product-purchase": {
        title: "Product-wise Purchase Analysis",
        endpoint: "/reports/purchase/product-wise",
        columns: [
            { header: "Product Name", key: "product_name" },
            { header: "Qty Purchased", key: "total_qty" },
            { header: "Avg Cost", key: "avg_cost", type: "amount", align: "right" },
            { header: "Total Value", key: "total_value", type: "amount", align: "right" }
        ]
    },
    "broker-purchase": {
        title: "Broker-wise Purchase Report",
        endpoint: "/reports/purchase/broker-wise",
        columns: [
            { header: "Broker Name", key: "broker_name" },
            { header: "Total Bills", key: "bill_count" },
            { header: "Total Purchase", key: "total_purchase", type: "amount", align: "right" }
        ]
    },
    "purchase-payment": {
        title: "Purchase Payment Report",
        endpoint: "/reports/purchase/payments",
        columns: [
            { header: "Date", key: "date", type: "date" },
            { header: "Supplier", key: "supplier_name" },
            { header: "Payment Method", key: "method" },
            { header: "Amount Paid", key: "amount", type: "amount", align: "right" },
            { header: "Reference", key: "reference" }
        ]
    },
    "gstr-1": {
        title: "GSTR-1 Ready Report",
        endpoint: "/reports/gst/gstr-1",
        columns: [
            { header: "GSTIN/UIN", key: "gstin" },
            { header: "Receiver Name", key: "receiver_name" },
            { header: "Invoice No", key: "invoice_no" },
            { header: "Invoice Date", key: "date", type: "date" },
            { header: "Invoice Value", key: "total_amount", type: "amount", align: "right" },
            { header: "Taxable Value", key: "taxable_amount", type: "amount", align: "right" }
        ]
    },
    "gstr-3b": {
        title: "GSTR-3B Ready Report",
        endpoint: "/reports/gst/gstr-3b",
        columns: [
            { header: "Nature of Supplies", key: "supply_nature" },
            { header: "Total Taxable Value", key: "taxable_value", type: "amount", align: "right" },
            { header: "Integrated Tax", key: "igst", type: "amount", align: "right" },
            { header: "Central Tax", key: "cgst", type: "amount", align: "right" },
            { header: "State/UT Tax", key: "sgst", type: "amount", align: "right" }
        ]
    },
    "pl-statement": {
        title: "Profit & Loss Statement",
        endpoint: "/reports/finance/pl",
        columns: [
            { header: "Particulars", key: "particulars" },
            { header: "Amount", key: "amount", type: "amount", align: "right" }
        ]
    },
    "balance-sheet": {
        title: "Balance Sheet",
        endpoint: "/reports/finance/balance-sheet",
        columns: [
            { header: "Liabilities / Assets", key: "particulars" },
            { header: "Amount", key: "amount", type: "amount", align: "right" }
        ]
    },
    "cash-flow": {
        title: "Cash Flow Statement",
        endpoint: "/reports/finance/cash-flow",
        columns: [
            { header: "Activity", key: "activity" },
            { header: "Inflow", key: "inflow", type: "amount", align: "right" },
            { header: "Outflow", key: "outflow", type: "amount", align: "right" },
            { header: "Net", key: "net", type: "amount", align: "right" }
        ]
    },
    "ledger-report": {
        title: "Ledger Account Report",
        endpoint: "/reports/finance/ledger",
        columns: [
            { header: "Date", key: "date", type: "date" },
            { header: "Voucher Type", key: "type" },
            { header: "Particulars", key: "particulars" },
            { header: "Debit", key: "debit", type: "amount", align: "right" },
            { header: "Credit", key: "credit", type: "amount", align: "right" },
            { header: "Balance", key: "balance", type: "amount", align: "right" }
        ]
    },
    "stock-valuation": {
        title: "Stock Valuation Report",
        endpoint: "/reports/inventory/valuation",
        columns: [
            { header: "Product Name", key: "product_name" },
            { header: "Qty in Hand", key: "qty" },
            { header: "Rate", key: "rate", type: "amount", align: "right" },
            { header: "Value", key: "value", type: "amount", align: "right" }
        ]
    },
    "dead-stock": {
        title: "Dead Stock Report",
        endpoint: "/reports/inventory/dead-stock",
        columns: [
            { header: "Product Name", key: "product_name" },
            { header: "Last Movement", key: "last_date", type: "date" },
            { header: "Idle Days", key: "idle_days" },
            { header: "Stock Value", key: "value", type: "amount", align: "right" }
        ]
    },
    "loan-statement": {
        title: "Loan Statement Report",
        endpoint: "/reports/finance/loan-statement",
        columns: [
            { header: "Lender/Borrower", key: "entity_name" },
            { header: "Principal Amount", key: "principal", type: "amount", align: "right" },
            { header: "Interest Applied", key: "interest", type: "amount", align: "right" },
            { header: "Total Outstanding", key: "outstanding", type: "amount", align: "right" }
        ]
    },
    "chit-fund": {
        title: "Chit Fund Report",
        endpoint: "/reports/finance/chit-fund",
        columns: [
            { header: "Group Name", key: "group_name" },
            { header: "Total Value", key: "total_value", type: "amount", align: "right" },
            { header: "Paid Installments", key: "paid_count" },
            { header: "Total Paid", key: "total_paid", type: "amount", align: "right" }
        ]
    },
    "broker-commission": {
        title: "Broker Commission Report",
        endpoint: "/reports/finance/broker-commission",
        columns: [
            { header: "Broker Name", key: "broker_name" },
            { header: "Total Sales/Purchases", key: "total_volume", type: "amount", align: "right" },
            { header: "Earned", key: "earned", type: "amount", align: "right" },
            { header: "Paid", key: "paid", type: "amount", align: "right" },
            { header: "Outstanding", key: "outstanding", type: "amount", align: "right" }
        ]
    },
    "employee-ledger": {
        title: "Employee Ledger Report",
        endpoint: "/reports/hr/employee-ledger",
        columns: [
            { header: "Employee Name", key: "employee_name" },
            { header: "Advances/Loans", key: "advances", type: "amount", align: "right" },
            { header: "Salary Due", key: "salary_due", type: "amount", align: "right" },
            { header: "Net Payable", key: "net_payable", type: "amount", align: "right" }
        ]
    },
    "health-dashboard": {
        title: "Business Health Dashboard",
        endpoint: "/reports/executive/health",
        columns: [
            { header: "Metric", key: "metric" },
            { header: "Current Value", key: "value", type: "amount", align: "right" },
            { header: "MoM Growth", key: "growth" }
        ]
    },
    "day-closing": {
        title: "Day Closing Summary",
        endpoint: "/reports/executive/day-closing",
        columns: [
            { header: "Category", key: "category" },
            { header: "Total Count", key: "count" },
            { header: "Total Amount", key: "amount", type: "amount", align: "right" }
        ]
    }
};
