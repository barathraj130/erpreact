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
    }
};
