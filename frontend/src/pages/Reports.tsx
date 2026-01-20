// frontend/src/pages/Reports.tsx
// World-Class Reports & Analytics - Real Data Only (No Mock Data)
import React, { useEffect, useState } from 'react';
import {
    FaArrowDown,
    FaArrowUp,
    FaBuilding,
    FaCalendarAlt,
    FaChartBar,
    FaChartLine,
    FaChartPie,
    FaCheckCircle,
    FaClipboardList,
    FaCoins,
    FaCreditCard,
    FaExclamationTriangle,
    FaFileExcel,
    FaFilePdf,
    FaHandHoldingUsd,
    FaPercentage,
    FaPrint,
    FaShoppingCart,
    FaSyncAlt,
    FaTruck,
    FaUsers,
    FaWallet
} from 'react-icons/fa';

interface ReportData {
    revenue: number;
    expenses: number;
    grossProfit: number;
    netProfit: number;
    receivables: number;
    payables: number;
    inventory: number;
    salesCount: number;
    purchaseCount: number;
    customerCount: number;
    supplierCount: number;
    topProducts: Array<{ name: string; revenue: number; quantity: number; cost: number }>;
    topCustomers: Array<{ name: string; revenue: number; transactions: number }>;
    topSuppliers: Array<{ name: string; amount: number; transactions: number }>;
    monthlyRevenue: Array<{ month: string; year: number; revenue: number; expenses: number; profit: number }>;
    expenseBreakdown: Array<{ category: string; amount: number; percentage: number }>;
    revenueByCategory: Array<{ category: string; amount: number; percentage: number }>;
    cashFlow: Array<{ month: string; inflow: number; outflow: number; net: number }>;
    agingReceivables: Array<{ range: string; amount: number; count: number }>;
    agingPayables: Array<{ range: string; amount: number; count: number }>;
    inventoryByCategory: Array<{ category: string; value: number; quantity: number }>;
    lowStockProducts: Array<{ name: string; stock: number; reorderLevel: number }>;
    salesByPaymentStatus: { paid: number; partial: number; unpaid: number };
    purchasesByPaymentStatus: { paid: number; partial: number; unpaid: number };
}

const Reports: React.FC = () => {
    const [activeReport, setActiveReport] = useState<string>('overview');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of year
        end: new Date().toISOString().split('T')[0]
    });
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ReportData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const API_BASE = '/api';

    useEffect(() => {
        fetchReportData();
    }, [dateRange]);

    const fetchReportData = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const token = localStorage.getItem('erp-token');
            const headers = { 'Authorization': `Bearer ${token}` };

            // Fetch all data from API endpoints
            const [salesRes, purchasesRes, customersRes, suppliersRes, productsRes] = await Promise.all([
                fetch(`${API_BASE}/invoices?type=SALE`, { headers }),
                fetch(`${API_BASE}/invoices?type=PURCHASE`, { headers }),
                fetch(`${API_BASE}/customers`, { headers }),
                fetch(`${API_BASE}/suppliers`, { headers }),
                fetch(`${API_BASE}/products`, { headers })
            ]);

            // Parse responses
            const allSales = await salesRes.json() || [];
            const allPurchases = await purchasesRes.json() || [];
            const customers = await customersRes.json() || [];
            const suppliers = await suppliersRes.json() || [];
            const products = await productsRes.json() || [];

            // Filter by date range
            const startDate = new Date(dateRange.start);
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);

            const sales = allSales.filter((inv: any) => {
                const d = new Date(inv.date || inv.created_at);
                return d >= startDate && d <= endDate;
            });

            const purchases = allPurchases.filter((inv: any) => {
                const d = new Date(inv.date || inv.created_at);
                return d >= startDate && d <= endDate;
            });

            // Calculate Revenue
            const totalRevenue = sales.reduce((sum: number, inv: any) => 
                sum + (Number(inv.total) || Number(inv.grand_total) || 0), 0);

            // Calculate Expenses (Purchases)
            const totalExpenses = purchases.reduce((sum: number, inv: any) => 
                sum + (Number(inv.total) || Number(inv.grand_total) || 0), 0);

            // Calculate Receivables (Unpaid Sales)
            const receivables = sales
                .filter((s: any) => s.status !== 'PAID' && s.status !== 'paid')
                .reduce((sum: number, inv: any) => 
                    sum + (Number(inv.balance_due) || Number(inv.total) - (Number(inv.amount_paid) || 0) || 0), 0);

            // Calculate Payables (Unpaid Purchases)
            const payables = purchases
                .filter((p: any) => p.status !== 'PAID' && p.status !== 'paid')
                .reduce((sum: number, inv: any) => 
                    sum + (Number(inv.balance_due) || Number(inv.total) - (Number(inv.amount_paid) || 0) || 0), 0);

            // Calculate Inventory Value
            const inventoryValue = products.reduce((sum: number, p: any) => {
                const stock = Number(p.stock) || Number(p.quantity) || 0;
                const cost = Number(p.cost_price) || Number(p.purchase_price) || Number(p.price) * 0.7 || 0;
                return sum + (stock * cost);
            }, 0);

            // Gross and Net Profit
            const grossProfit = totalRevenue - totalExpenses;
            const netProfit = grossProfit;

            // Top Products
            const topProducts = calculateTopProducts(sales, products);

            // Top Customers
            const topCustomers = calculateTopCustomers(sales);

            // Top Suppliers
            const topSuppliers = calculateTopSuppliers(purchases);

            // Monthly Revenue
            const monthlyRevenue = calculateMonthlyData(sales, purchases);

            // Revenue by Category
            const revenueByCategory = calculateRevenueByCategory(sales, totalRevenue);

            // Expense Breakdown
            const expenseBreakdown = calculateExpenseBreakdown(purchases, totalExpenses);

            // Cash Flow
            const cashFlow = calculateCashFlow(sales, purchases);

            // Aging Analysis
            const agingReceivables = calculateAging(sales.filter((s: any) => 
                s.status !== 'PAID' && s.status !== 'paid'));
            const agingPayables = calculateAging(purchases.filter((p: any) => 
                p.status !== 'PAID' && p.status !== 'paid'));

            // Inventory by Category
            const inventoryByCategory = calculateInventoryByCategory(products);

            // Low Stock Products
            const lowStockProducts = products
                .filter((p: any) => {
                    const stock = Number(p.stock) || 0;
                    const reorder = Number(p.reorder_level) || Number(p.min_stock) || 10;
                    return stock <= reorder && stock > 0;
                })
                .map((p: any) => ({
                    name: p.name || p.product_name,
                    stock: Number(p.stock) || 0,
                    reorderLevel: Number(p.reorder_level) || Number(p.min_stock) || 10
                }))
                .slice(0, 10);

            // Payment Status Summary
            const salesByPaymentStatus = {
                paid: sales.filter((s: any) => s.status === 'PAID' || s.status === 'paid').length,
                partial: sales.filter((s: any) => s.status === 'PARTIAL' || s.status === 'partial').length,
                unpaid: sales.filter((s: any) => s.status === 'UNPAID' || s.status === 'unpaid' || s.status === 'PENDING').length
            };

            const purchasesByPaymentStatus = {
                paid: purchases.filter((p: any) => p.status === 'PAID' || p.status === 'paid').length,
                partial: purchases.filter((p: any) => p.status === 'PARTIAL' || p.status === 'partial').length,
                unpaid: purchases.filter((p: any) => p.status === 'UNPAID' || p.status === 'unpaid' || p.status === 'PENDING').length
            };

            setData({
                revenue: totalRevenue,
                expenses: totalExpenses,
                grossProfit,
                netProfit,
                receivables,
                payables,
                inventory: inventoryValue,
                salesCount: sales.length,
                purchaseCount: purchases.length,
                customerCount: customers.length,
                supplierCount: suppliers.length,
                topProducts,
                topCustomers,
                topSuppliers,
                monthlyRevenue,
                expenseBreakdown,
                revenueByCategory,
                cashFlow,
                agingReceivables,
                agingPayables,
                inventoryByCategory,
                lowStockProducts,
                salesByPaymentStatus,
                purchasesByPaymentStatus
            });

        } catch (err) {
            console.error('Error fetching report data:', err);
            setError('Failed to load report data. Please try again.');
            // Set empty data structure
            setData({
                revenue: 0, expenses: 0, grossProfit: 0, netProfit: 0,
                receivables: 0, payables: 0, inventory: 0,
                salesCount: 0, purchaseCount: 0, customerCount: 0, supplierCount: 0,
                topProducts: [], topCustomers: [], topSuppliers: [],
                monthlyRevenue: [], expenseBreakdown: [], revenueByCategory: [],
                cashFlow: [], agingReceivables: [], agingPayables: [],
                inventoryByCategory: [], lowStockProducts: [],
                salesByPaymentStatus: { paid: 0, partial: 0, unpaid: 0 },
                purchasesByPaymentStatus: { paid: 0, partial: 0, unpaid: 0 }
            });
        } finally {
            setLoading(false);
        }
    };

    // Helper function: Calculate Top Products
    function calculateTopProducts(sales: any[], products: any[]) {
        const productMap: Record<string, { revenue: number; quantity: number; cost: number }> = {};

        sales.forEach((sale: any) => {
            const items = sale.items || sale.line_items || [];
            items.forEach((item: any) => {
                const name = item.product_name || item.name || item.description || 'Unknown Product';
                if (!productMap[name]) {
                    productMap[name] = { revenue: 0, quantity: 0, cost: 0 };
                }
                const qty = Number(item.quantity) || 1;
                const total = Number(item.total) || Number(item.amount) || (qty * (Number(item.price) || 0));
                const cost = Number(item.cost_price) || Number(item.cost) || total * 0.7;
                
                productMap[name].revenue += total;
                productMap[name].quantity += qty;
                productMap[name].cost += cost * qty;
            });
        });

        return Object.entries(productMap)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }

    // Helper function: Calculate Top Customers
    function calculateTopCustomers(sales: any[]) {
        const customerMap: Record<string, { revenue: number; transactions: number }> = {};

        sales.forEach((sale: any) => {
            const name = sale.customer_name || sale.party_name || sale.customer?.name || 'Walk-in Customer';
            if (!customerMap[name]) {
                customerMap[name] = { revenue: 0, transactions: 0 };
            }
            customerMap[name].revenue += Number(sale.total) || Number(sale.grand_total) || 0;
            customerMap[name].transactions += 1;
        });

        return Object.entries(customerMap)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }

    // Helper function: Calculate Top Suppliers
    function calculateTopSuppliers(purchases: any[]) {
        const supplierMap: Record<string, { amount: number; transactions: number }> = {};

        purchases.forEach((purchase: any) => {
            const name = purchase.supplier_name || purchase.party_name || purchase.supplier?.name || 'Unknown Supplier';
            if (!supplierMap[name]) {
                supplierMap[name] = { amount: 0, transactions: 0 };
            }
            supplierMap[name].amount += Number(purchase.total) || Number(purchase.grand_total) || 0;
            supplierMap[name].transactions += 1;
        });

        return Object.entries(supplierMap)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10);
    }

    // Helper function: Calculate Monthly Data
    function calculateMonthlyData(sales: any[], purchases: any[]) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyMap: Record<string, { revenue: number; expenses: number }> = {};

        sales.forEach((sale: any) => {
            const date = new Date(sale.date || sale.created_at);
            const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
            if (!monthlyMap[key]) {
                monthlyMap[key] = { revenue: 0, expenses: 0 };
            }
            monthlyMap[key].revenue += Number(sale.total) || Number(sale.grand_total) || 0;
        });

        purchases.forEach((purchase: any) => {
            const date = new Date(purchase.date || purchase.created_at);
            const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
            if (!monthlyMap[key]) {
                monthlyMap[key] = { revenue: 0, expenses: 0 };
            }
            monthlyMap[key].expenses += Number(purchase.total) || Number(purchase.grand_total) || 0;
        });

        return Object.entries(monthlyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, data]) => {
                const [year, monthIdx] = key.split('-');
                return {
                    month: monthNames[parseInt(monthIdx)],
                    year: parseInt(year),
                    revenue: data.revenue,
                    expenses: data.expenses,
                    profit: data.revenue - data.expenses
                };
            });
    }

    // Helper function: Calculate Revenue by Category
    function calculateRevenueByCategory(sales: any[], totalRevenue: number) {
        if (totalRevenue === 0) return [];

        const categoryMap: Record<string, number> = {};

        sales.forEach((sale: any) => {
            const items = sale.items || sale.line_items || [];
            if (items.length === 0) {
                // No items, group by sale type or default
                const cat = sale.category || 'General Sales';
                categoryMap[cat] = (categoryMap[cat] || 0) + (Number(sale.total) || 0);
            } else {
                items.forEach((item: any) => {
                    const cat = item.category || item.product_category || 'General';
                    const amount = Number(item.total) || Number(item.amount) || 
                        (Number(item.quantity) || 1) * (Number(item.price) || 0);
                    categoryMap[cat] = (categoryMap[cat] || 0) + amount;
                });
            }
        });

        // If no categories found, use total as "Product Sales"
        if (Object.keys(categoryMap).length === 0 && totalRevenue > 0) {
            categoryMap['Product Sales'] = totalRevenue;
        }

        return Object.entries(categoryMap)
            .map(([category, amount]) => ({
                category,
                amount,
                percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0
            }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 6);
    }

    // Helper function: Calculate Expense Breakdown
    function calculateExpenseBreakdown(purchases: any[], totalExpenses: number) {
        if (totalExpenses === 0) return [];

        const categoryMap: Record<string, number> = {};

        purchases.forEach((purchase: any) => {
            const cat = purchase.category || purchase.expense_category || purchase.type || 'Purchases';
            categoryMap[cat] = (categoryMap[cat] || 0) + (Number(purchase.total) || Number(purchase.grand_total) || 0);
        });

        // If no categories, use total as "Cost of Goods"
        if (Object.keys(categoryMap).length === 0 && totalExpenses > 0) {
            categoryMap['Cost of Goods Sold'] = totalExpenses;
        }

        return Object.entries(categoryMap)
            .map(([category, amount]) => ({
                category,
                amount,
                percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
            }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 6);
    }

    // Helper function: Calculate Cash Flow
    function calculateCashFlow(sales: any[], purchases: any[]) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const cashMap: Record<string, { inflow: number; outflow: number }> = {};

        // Inflows from paid/partially paid sales
        sales.forEach((sale: any) => {
            const amountPaid = Number(sale.amount_paid) || 
                (sale.status === 'PAID' || sale.status === 'paid' ? Number(sale.total) : 0);
            if (amountPaid > 0) {
                const date = new Date(sale.date || sale.created_at);
                const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
                if (!cashMap[key]) {
                    cashMap[key] = { inflow: 0, outflow: 0 };
                }
                cashMap[key].inflow += amountPaid;
            }
        });

        // Outflows from paid/partially paid purchases
        purchases.forEach((purchase: any) => {
            const amountPaid = Number(purchase.amount_paid) || 
                (purchase.status === 'PAID' || purchase.status === 'paid' ? Number(purchase.total) : 0);
            if (amountPaid > 0) {
                const date = new Date(purchase.date || purchase.created_at);
                const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
                if (!cashMap[key]) {
                    cashMap[key] = { inflow: 0, outflow: 0 };
                }
                cashMap[key].outflow += amountPaid;
            }
        });

        return Object.entries(cashMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, data]) => ({
                month: monthNames[parseInt(key.split('-')[1])],
                inflow: data.inflow,
                outflow: data.outflow,
                net: data.inflow - data.outflow
            }));
    }

    // Helper function: Calculate Aging
    function calculateAging(invoices: any[]) {
        const today = new Date();
        const aging: Record<string, { amount: number; count: number }> = {
            'Current (0-30 days)': { amount: 0, count: 0 },
            '31-60 days': { amount: 0, count: 0 },
            '61-90 days': { amount: 0, count: 0 },
            'Over 90 days': { amount: 0, count: 0 }
        };

        invoices.forEach((inv: any) => {
            const invDate = new Date(inv.date || inv.created_at);
            const daysDiff = Math.floor((today.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
            const amount = Number(inv.balance_due) || 
                (Number(inv.total) - (Number(inv.amount_paid) || 0)) || 
                Number(inv.total) || 0;

            if (daysDiff <= 30) {
                aging['Current (0-30 days)'].amount += amount;
                aging['Current (0-30 days)'].count += 1;
            } else if (daysDiff <= 60) {
                aging['31-60 days'].amount += amount;
                aging['31-60 days'].count += 1;
            } else if (daysDiff <= 90) {
                aging['61-90 days'].amount += amount;
                aging['61-90 days'].count += 1;
            } else {
                aging['Over 90 days'].amount += amount;
                aging['Over 90 days'].count += 1;
            }
        });

        return Object.entries(aging)
            .filter(([_, data]) => data.amount > 0 || data.count > 0)
            .map(([range, data]) => ({ range, ...data }));
    }

    // Helper function: Calculate Inventory by Category
    function calculateInventoryByCategory(products: any[]) {
        const categoryMap: Record<string, { value: number; quantity: number }> = {};

        products.forEach((p: any) => {
            const cat = p.category || p.product_category || 'General';
            const stock = Number(p.stock) || Number(p.quantity) || 0;
            const cost = Number(p.cost_price) || Number(p.purchase_price) || Number(p.price) * 0.7 || 0;

            if (!categoryMap[cat]) {
                categoryMap[cat] = { value: 0, quantity: 0 };
            }
            categoryMap[cat].value += stock * cost;
            categoryMap[cat].quantity += stock;
        });

        return Object.entries(categoryMap)
            .map(([category, data]) => ({ category, ...data }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }

    // Format currency
    const formatCurrency = (value: number) => {
        if (value === 0) return '₹0';
        if (Math.abs(value) >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
        if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
        if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
        return `₹${value.toLocaleString('en-IN')}`;
    };

    // Report tabs configuration
    const reportTabs = [
        { id: 'overview', label: 'Executive Summary', icon: <FaChartPie /> },
        { id: 'pnl', label: 'Profit & Loss', icon: <FaChartLine /> },
        { id: 'cashflow', label: 'Cash Flow', icon: <FaWallet /> },
        { id: 'receivables', label: 'Receivables', icon: <FaHandHoldingUsd /> },
        { id: 'payables', label: 'Payables', icon: <FaCreditCard /> },
        { id: 'inventory', label: 'Inventory', icon: <FaClipboardList /> }
    ];

    // Styles
    const cardStyle: React.CSSProperties = {
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)'
    };

    const metricCardStyle: React.CSSProperties = {
        ...cardStyle,
        padding: '20px',
        position: 'relative' as const,
        overflow: 'hidden'
    };

    // Loading State
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <FaSyncAlt size={40} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: '16px', color: '#64748b' }}>Loading financial data...</p>
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

    if (!data) return null;

    // Calculate key metrics
    const grossMargin = data.revenue > 0 ? (data.grossProfit / data.revenue) * 100 : 0;
    const netMargin = data.revenue > 0 ? (data.netProfit / data.revenue) * 100 : 0;
    const hasData = data.revenue > 0 || data.salesCount > 0 || data.purchaseCount > 0 || data.customerCount > 0;

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                padding: '32px 40px',
                marginBottom: '24px',
                borderRadius: '0 0 24px 24px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2rem', color: 'white', fontWeight: 700 }}>
                            Financial Reports & Analytics
                        </h1>
                        <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '1rem' }}>
                            Enterprise Intelligence Dashboard • Real-time Business Insights
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 20px', background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px',
                            color: 'white', cursor: 'pointer', fontWeight: 500
                        }}>
                            <FaFilePdf /> Export PDF
                        </button>
                        <button style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 20px', background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px',
                            color: 'white', cursor: 'pointer', fontWeight: 500
                        }}>
                            <FaFileExcel /> Export Excel
                        </button>
                        <button style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 20px', background: '#3b82f6',
                            border: 'none', borderRadius: '10px',
                            color: 'white', cursor: 'pointer', fontWeight: 600
                        }}>
                            <FaPrint /> Print Report
                        </button>
                    </div>
                </div>

                {/* Date Range & Filters */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '8px' }}>
                        <FaCalendarAlt color="rgba(255,255,255,0.7)" />
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.9rem', outline: 'none' }}
                        />
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>to</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.9rem', outline: 'none' }}
                        />
                    </div>
                    <button
                        onClick={fetchReportData}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '10px 16px', background: 'rgba(255,255,255,0.15)',
                            border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer'
                        }}
                    >
                        <FaSyncAlt /> Refresh
                    </button>
                    <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                        Last updated: {new Date().toLocaleString()}
                    </div>
                </div>
            </div>

            <div style={{ padding: '0 40px 40px' }}>
                {/* Error State */}
                {error && (
                    <div style={{ ...cardStyle, marginBottom: '24px', background: '#fef2f2', border: '1px solid #fecaca' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#991b1b' }}>
                            <FaExclamationTriangle size={20} />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                {/* Report Navigation Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {reportTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveReport(tab.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '12px 20px', border: 'none',
                                borderRadius: '10px', cursor: 'pointer',
                                background: activeReport === tab.id ? '#1e293b' : 'white',
                                color: activeReport === tab.id ? 'white' : '#64748b',
                                fontWeight: 600, fontSize: '0.9rem',
                                boxShadow: activeReport === tab.id ? '0 4px 12px rgba(30,41,59,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
                                transition: 'all 0.2s', whiteSpace: 'nowrap'
                            }}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* No Data State */}
                {!hasData && (
                    <div style={{ ...cardStyle, textAlign: 'center', padding: '80px 40px' }}>
                        <FaChartBar size={60} color="#cbd5e1" />
                        <h2 style={{ margin: '24px 0 12px', color: '#1e293b' }}>No Data Available</h2>
                        <p style={{ color: '#64748b', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
                            There are no transactions recorded for the selected period ({dateRange.start} to {dateRange.end}).<br />
                            Create sales invoices and purchase bills to see your financial reports here.
                        </p>
                    </div>
                )}

                {/* ==================== EXECUTIVE SUMMARY ==================== */}
                {hasData && activeReport === 'overview' && (
                    <>
                        {/* Key Performance Indicators */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
                            {/* Revenue Card */}
                            <div style={{ ...metricCardStyle, borderTop: '4px solid #10b981' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Total Revenue</p>
                                        <h2 style={{ margin: '8px 0 4px', fontSize: '1.75rem', color: '#1e293b' }}>{formatCurrency(data.revenue)}</h2>
                                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>{data.salesCount} invoices</p>
                                    </div>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FaChartLine color="#10b981" size={22} />
                                    </div>
                                </div>
                            </div>

                            {/* Expenses Card */}
                            <div style={{ ...metricCardStyle, borderTop: '4px solid #ef4444' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Total Expenses</p>
                                        <h2 style={{ margin: '8px 0 4px', fontSize: '1.75rem', color: '#1e293b' }}>{formatCurrency(data.expenses)}</h2>
                                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>{data.purchaseCount} purchases</p>
                                    </div>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FaTruck color="#ef4444" size={22} />
                                    </div>
                                </div>
                            </div>

                            {/* Net Profit Card */}
                            <div style={{ ...metricCardStyle, borderTop: `4px solid ${data.netProfit >= 0 ? '#3b82f6' : '#ef4444'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Net Profit</p>
                                        <h2 style={{ margin: '8px 0 4px', fontSize: '1.75rem', color: data.netProfit >= 0 ? '#1e293b' : '#ef4444' }}>
                                            {formatCurrency(data.netProfit)}
                                        </h2>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {data.netProfit >= 0 ? <FaArrowUp color="#10b981" size={12} /> : <FaArrowDown color="#ef4444" size={12} />}
                                            <span style={{ color: netMargin >= 0 ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>
                                                {netMargin.toFixed(1)}% margin
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FaCoins color="#3b82f6" size={22} />
                                    </div>
                                </div>
                            </div>

                            {/* Outstanding Card */}
                            <div style={{ ...metricCardStyle, borderTop: '4px solid #f59e0b' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Receivables</p>
                                        <h2 style={{ margin: '8px 0 4px', fontSize: '1.75rem', color: '#1e293b' }}>{formatCurrency(data.receivables)}</h2>
                                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>To collect</p>
                                    </div>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FaHandHoldingUsd color="#f59e0b" size={22} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Revenue vs Expenses Chart */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
                            <div style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem' }}>Revenue vs Expenses Trend</h3>
                                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>Monthly comparison</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }}></div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Revenue</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444' }}></div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Expenses</span>
                                        </div>
                                    </div>
                                </div>

                                {data.monthlyRevenue.length > 0 ? (
                                    <div style={{ height: '280px', display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '0 8px' }}>
                                        {data.monthlyRevenue.map((month, idx) => {
                                            const maxValue = Math.max(...data.monthlyRevenue.map(m => Math.max(m.revenue, m.expenses)));
                                            const revenueHeight = maxValue > 0 ? (month.revenue / maxValue) * 220 : 0;
                                            const expenseHeight = maxValue > 0 ? (month.expenses / maxValue) * 220 : 0;
                                            return (
                                                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '220px' }}>
                                                        <div
                                                            style={{
                                                                width: '18px',
                                                                height: `${Math.max(revenueHeight, 2)}px`,
                                                                background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                                                                borderRadius: '4px 4px 0 0'
                                                            }}
                                                            title={`Revenue: ${formatCurrency(month.revenue)}`}
                                                        ></div>
                                                        <div
                                                            style={{
                                                                width: '18px',
                                                                height: `${Math.max(expenseHeight, 2)}px`,
                                                                background: 'linear-gradient(180deg, #f87171 0%, #ef4444 100%)',
                                                                borderRadius: '4px 4px 0 0'
                                                            }}
                                                            title={`Expenses: ${formatCurrency(month.expenses)}`}
                                                        ></div>
                                                    </div>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>{month.month}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                        No monthly data available
                                    </div>
                                )}
                            </div>

                            {/* Revenue Breakdown */}
                            <div style={cardStyle}>
                                <h3 style={{ margin: '0 0 20px', color: '#1e293b', fontSize: '1.1rem' }}>Revenue Breakdown</h3>
                                {data.revenueByCategory.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {data.revenueByCategory.map((cat, idx) => (
                                            <div key={idx}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '0.9rem', color: '#374151' }}>{cat.category}</span>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{formatCurrency(cat.amount)}</span>
                                                </div>
                                                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: `${cat.percentage}%`,
                                                        background: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'][idx % 6],
                                                        borderRadius: '4px'
                                                    }}></div>
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{cat.percentage.toFixed(1)}% of total</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>No category data</div>
                                )}
                            </div>
                        </div>

                        {/* Secondary Metrics */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px' }}>
                            {[
                                { label: 'Gross Margin', value: `${grossMargin.toFixed(1)}%`, icon: <FaPercentage />, color: '#10b981' },
                                { label: 'Sales Count', value: data.salesCount, icon: <FaShoppingCart />, color: '#3b82f6' },
                                { label: 'Purchase Count', value: data.purchaseCount, icon: <FaTruck />, color: '#8b5cf6' },
                                { label: 'Customers', value: data.customerCount, icon: <FaUsers />, color: '#f59e0b' },
                                { label: 'Suppliers', value: data.supplierCount, icon: <FaBuilding />, color: '#ec4899' },
                                { label: 'Inventory Value', value: formatCurrency(data.inventory), icon: <FaClipboardList />, color: '#06b6d4' }
                            ].map((metric, idx) => (
                                <div key={idx} style={{ ...cardStyle, padding: '16px', textAlign: 'center' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: `${metric.color}15`, margin: '0 auto 12px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: metric.color
                                    }}>
                                        {metric.icon}
                                    </div>
                                    <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{metric.value}</p>
                                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>{metric.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Top Products & Customers */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                            {/* Top Products */}
                            <div style={cardStyle}>
                                <h3 style={{ margin: '0 0 20px', color: '#1e293b', fontSize: '1.1rem' }}>Top Performing Products</h3>
                                {data.topProducts.length > 0 ? (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                                <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Product</th>
                                                <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Revenue</th>
                                                <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.topProducts.slice(0, 5).map((product, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '14px 8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{
                                                                width: '28px', height: '28px', borderRadius: '6px',
                                                                background: ['#eff6ff', '#f0fdf4', '#fef3c7', '#fce7f3', '#f0fdfa'][idx],
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                color: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6'][idx],
                                                                fontWeight: 700, fontSize: '0.75rem'
                                                            }}>
                                                                #{idx + 1}
                                                            </div>
                                                            <span style={{ fontWeight: 500, color: '#1e293b', fontSize: '0.9rem' }}>{product.name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                                                        {formatCurrency(product.revenue)}
                                                    </td>
                                                    <td style={{ padding: '14px 8px', textAlign: 'right', color: '#64748b' }}>
                                                        {product.quantity}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>No product data</div>
                                )}
                            </div>

                            {/* Top Customers */}
                            <div style={cardStyle}>
                                <h3 style={{ margin: '0 0 20px', color: '#1e293b', fontSize: '1.1rem' }}>Top Customers</h3>
                                {data.topCustomers.length > 0 ? (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                                <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Customer</th>
                                                <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Revenue</th>
                                                <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Orders</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.topCustomers.slice(0, 5).map((customer, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '14px 8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{
                                                                width: '28px', height: '28px', borderRadius: '50%',
                                                                background: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][idx],
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                color: 'white', fontWeight: 600, fontSize: '0.75rem'
                                                            }}>
                                                                {customer.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span style={{ fontWeight: 500, color: '#1e293b', fontSize: '0.9rem' }}>{customer.name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                                                        {formatCurrency(customer.revenue)}
                                                    </td>
                                                    <td style={{ padding: '14px 8px', textAlign: 'right', color: '#64748b' }}>
                                                        {customer.transactions}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>No customer data</div>
                                )}
                            </div>
                        </div>

                        {/* Aging Analysis */}
                        {(data.agingReceivables.length > 0 || data.agingPayables.length > 0) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                {/* Receivables Aging */}
                                <div style={cardStyle}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                        <div>
                                            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem' }}>Receivables Aging</h3>
                                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>Outstanding payments</p>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(data.receivables)}</p>
                                    </div>
                                    {data.agingReceivables.length > 0 ? (
                                        data.agingReceivables.map((item, idx) => (
                                            <div key={idx} style={{ marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '0.85rem', color: '#374151' }}>{item.range}</span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatCurrency(item.amount)} ({item.count})</span>
                                                </div>
                                                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: data.receivables > 0 ? `${(item.amount / data.receivables) * 100}%` : '0%',
                                                        background: ['#22c55e', '#f59e0b', '#f97316', '#ef4444'][idx],
                                                        borderRadius: '4px'
                                                    }}></div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ textAlign: 'center', color: '#10b981', padding: '20px' }}>
                                            <FaCheckCircle size={24} />
                                            <p style={{ margin: '8px 0 0' }}>All invoices paid!</p>
                                        </div>
                                    )}
                                </div>

                                {/* Payables Aging */}
                                <div style={cardStyle}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                        <div>
                                            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem' }}>Payables Aging</h3>
                                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>Outstanding bills</p>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(data.payables)}</p>
                                    </div>
                                    {data.agingPayables.length > 0 ? (
                                        data.agingPayables.map((item, idx) => (
                                            <div key={idx} style={{ marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '0.85rem', color: '#374151' }}>{item.range}</span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatCurrency(item.amount)} ({item.count})</span>
                                                </div>
                                                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: data.payables > 0 ? `${(item.amount / data.payables) * 100}%` : '0%',
                                                        background: ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'][idx],
                                                        borderRadius: '4px'
                                                    }}></div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ textAlign: 'center', color: '#10b981', padding: '20px' }}>
                                            <FaCheckCircle size={24} />
                                            <p style={{ margin: '8px 0 0' }}>All bills paid!</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ==================== PROFIT & LOSS ==================== */}
                {hasData && activeReport === 'pnl' && (
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #f1f5f9' }}>
                            <div>
                                <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem' }}>Profit & Loss Statement</h2>
                                <p style={{ margin: '4px 0 0', color: '#64748b' }}>Period: {dateRange.start} to {dateRange.end}</p>
                            </div>
                            {netMargin !== 0 && (
                                <span style={{
                                    padding: '6px 12px',
                                    background: netMargin >= 0 ? '#f0fdf4' : '#fef2f2',
                                    color: netMargin >= 0 ? '#16a34a' : '#dc2626',
                                    borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600
                                }}>
                                    Net Margin: {netMargin.toFixed(1)}%
                                </span>
                            )}
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0' }}>Particulars</th>
                                    <th style={{ padding: '16px', textAlign: 'right', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0' }}>Amount</th>
                                    <th style={{ padding: '16px', textAlign: 'right', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0' }}>% of Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Revenue Section */}
                                <tr style={{ background: '#f0fdf4' }}>
                                    <td colSpan={3} style={{ padding: '12px 16px', fontWeight: 700, color: '#166534', fontSize: '1rem' }}>REVENUE</td>
                                </tr>
                                {data.revenueByCategory.length > 0 ? (
                                    data.revenueByCategory.map((cat, idx) => (
                                        <tr key={idx}>
                                            <td style={{ padding: '12px 16px 12px 32px', color: '#374151' }}>{cat.category}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(cat.amount)}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>{cat.percentage.toFixed(1)}%</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td style={{ padding: '12px 16px 12px 32px', color: '#374151' }}>Sales Revenue</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(data.revenue)}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>100.0%</td>
                                    </tr>
                                )}
                                <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1e293b' }}>Total Revenue</td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a', fontSize: '1.1rem' }}>{formatCurrency(data.revenue)}</td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>100.0%</td>
                                </tr>

                                {/* Expenses Section */}
                                <tr style={{ background: '#fef2f2' }}>
                                    <td colSpan={3} style={{ padding: '12px 16px', fontWeight: 700, color: '#991b1b', fontSize: '1rem' }}>EXPENSES</td>
                                </tr>
                                {data.expenseBreakdown.length > 0 ? (
                                    data.expenseBreakdown.map((expense, idx) => (
                                        <tr key={idx}>
                                            <td style={{ padding: '12px 16px 12px 32px', color: '#374151' }}>{expense.category}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(expense.amount)}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>
                                                {data.revenue > 0 ? ((expense.amount / data.revenue) * 100).toFixed(1) : '0.0'}%
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td style={{ padding: '12px 16px 12px 32px', color: '#374151' }}>Purchases / COGS</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(data.expenses)}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>
                                            {data.revenue > 0 ? ((data.expenses / data.revenue) * 100).toFixed(1) : '0.0'}%
                                        </td>
                                    </tr>
                                )}
                                <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1e293b' }}>Total Expenses</td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#dc2626', fontSize: '1.1rem' }}>{formatCurrency(data.expenses)}</td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>
                                        {data.revenue > 0 ? ((data.expenses / data.revenue) * 100).toFixed(1) : '0.0'}%
                                    </td>
                                </tr>

                                {/* Net Profit */}
                                <tr style={{ borderTop: '3px solid #3b82f6', background: '#1e293b' }}>
                                    <td style={{ padding: '16px', fontWeight: 700, color: 'white', fontSize: '1.1rem' }}>NET PROFIT / (LOSS)</td>
                                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 700, color: data.netProfit >= 0 ? '#4ade80' : '#f87171', fontSize: '1.25rem' }}>
                                        {formatCurrency(data.netProfit)}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 700, color: '#94a3b8' }}>{netMargin.toFixed(1)}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ==================== CASH FLOW ==================== */}
                {hasData && activeReport === 'cashflow' && (
                    <div style={cardStyle}>
                        <div style={{ marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem' }}>Cash Flow Statement</h2>
                            <p style={{ margin: '4px 0 0', color: '#64748b' }}>Monthly cash inflows and outflows</p>
                        </div>

                        {data.cashFlow.length > 0 ? (
                            <>
                                {/* Summary Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                                    <div style={{ padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                        <p style={{ margin: 0, color: '#166534', fontSize: '0.85rem', fontWeight: 500 }}>Total Inflows</p>
                                        <h3 style={{ margin: '8px 0 0', color: '#166534', fontSize: '1.5rem' }}>
                                            {formatCurrency(data.cashFlow.reduce((s, c) => s + c.inflow, 0))}
                                        </h3>
                                    </div>
                                    <div style={{ padding: '20px', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                                        <p style={{ margin: 0, color: '#991b1b', fontSize: '0.85rem', fontWeight: 500 }}>Total Outflows</p>
                                        <h3 style={{ margin: '8px 0 0', color: '#991b1b', fontSize: '1.5rem' }}>
                                            {formatCurrency(data.cashFlow.reduce((s, c) => s + c.outflow, 0))}
                                        </h3>
                                    </div>
                                    <div style={{ padding: '20px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                                        <p style={{ margin: 0, color: '#1e40af', fontSize: '0.85rem', fontWeight: 500 }}>Net Cash Flow</p>
                                        <h3 style={{ margin: '8px 0 0', color: '#1e40af', fontSize: '1.5rem' }}>
                                            {formatCurrency(data.cashFlow.reduce((s, c) => s + c.net, 0))}
                                        </h3>
                                    </div>
                                </div>

                                {/* Cash Flow Chart */}
                                <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', gap: '24px', padding: '0 16px', marginBottom: '24px' }}>
                                    {data.cashFlow.map((cf, idx) => {
                                        const maxVal = Math.max(...data.cashFlow.map(c => Math.max(c.inflow, c.outflow)));
                                        return (
                                            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '240px', marginBottom: '12px' }}>
                                                    <div
                                                        style={{
                                                            width: '28px',
                                                            height: maxVal > 0 ? `${Math.max((cf.inflow / maxVal) * 200, 2)}px` : '2px',
                                                            background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
                                                            borderRadius: '6px 6px 0 0'
                                                        }}
                                                        title={`Inflow: ${formatCurrency(cf.inflow)}`}
                                                    ></div>
                                                    <div
                                                        style={{
                                                            width: '28px',
                                                            height: maxVal > 0 ? `${Math.max((cf.outflow / maxVal) * 200, 2)}px` : '2px',
                                                            background: 'linear-gradient(180deg, #f87171 0%, #dc2626 100%)',
                                                            borderRadius: '6px 6px 0 0'
                                                        }}
                                                        title={`Outflow: ${formatCurrency(cf.outflow)}`}
                                                    ></div>
                                                </div>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>{cf.month}</p>
                                                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: cf.net >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                                                    {cf.net >= 0 ? '+' : ''}{formatCurrency(cf.net)}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Legend */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '32px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#22c55e' }}></div>
                                        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Cash Inflows (Collections)</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#ef4444' }}></div>
                                        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Cash Outflows (Payments)</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                                <FaWallet size={48} />
                                <p style={{ margin: '16px 0 0' }}>No cash flow data available for this period</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ==================== RECEIVABLES ==================== */}
                {hasData && activeReport === 'receivables' && (
                    <div style={cardStyle}>
                        <h2 style={{ margin: '0 0 24px', color: '#1e293b', fontSize: '1.5rem' }}>Accounts Receivable</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                            {/* Summary */}
                            <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '12px' }}>
                                <p style={{ margin: 0, color: '#64748b' }}>Total Outstanding</p>
                                <h2 style={{ margin: '12px 0', fontSize: '2.5rem', color: '#1e293b' }}>{formatCurrency(data.receivables)}</h2>
                                <div style={{ marginTop: '16px' }}>
                                    <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '0.85rem' }}>Payment Status</p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <span style={{ padding: '4px 8px', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '0.8rem' }}>
                                            Paid: {data.salesByPaymentStatus.paid}
                                        </span>
                                        <span style={{ padding: '4px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', fontSize: '0.8rem' }}>
                                            Partial: {data.salesByPaymentStatus.partial}
                                        </span>
                                        <span style={{ padding: '4px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontSize: '0.8rem' }}>
                                            Unpaid: {data.salesByPaymentStatus.unpaid}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Aging */}
                            <div>
                                <h3 style={{ margin: '0 0 16px', color: '#1e293b' }}>Aging Analysis</h3>
                                {data.agingReceivables.length > 0 ? (
                                    data.agingReceivables.map((a, i) => (
                                        <div key={i} style={{ marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <span style={{ color: '#374151' }}>{a.range}</span>
                                                <span style={{ fontWeight: 600 }}>{formatCurrency(a.amount)} ({a.count} invoices)</span>
                                            </div>
                                            <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px' }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: data.receivables > 0 ? `${(a.amount / data.receivables) * 100}%` : '0%',
                                                    background: ['#22c55e', '#f59e0b', '#f97316', '#ef4444'][i],
                                                    borderRadius: '6px'
                                                }}></div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#10b981', padding: '40px' }}>
                                        <FaCheckCircle size={32} />
                                        <p style={{ margin: '12px 0 0' }}>All invoices have been paid!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== PAYABLES ==================== */}
                {hasData && activeReport === 'payables' && (
                    <div style={cardStyle}>
                        <h2 style={{ margin: '0 0 24px', color: '#1e293b', fontSize: '1.5rem' }}>Accounts Payable</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                            {/* Summary */}
                            <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '12px' }}>
                                <p style={{ margin: 0, color: '#64748b' }}>Total Outstanding</p>
                                <h2 style={{ margin: '12px 0', fontSize: '2.5rem', color: '#1e293b' }}>{formatCurrency(data.payables)}</h2>
                                <div style={{ marginTop: '16px' }}>
                                    <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '0.85rem' }}>Payment Status</p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <span style={{ padding: '4px 8px', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '0.8rem' }}>
                                            Paid: {data.purchasesByPaymentStatus.paid}
                                        </span>
                                        <span style={{ padding: '4px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', fontSize: '0.8rem' }}>
                                            Partial: {data.purchasesByPaymentStatus.partial}
                                        </span>
                                        <span style={{ padding: '4px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontSize: '0.8rem' }}>
                                            Unpaid: {data.purchasesByPaymentStatus.unpaid}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Aging */}
                            <div>
                                <h3 style={{ margin: '0 0 16px', color: '#1e293b' }}>Aging Analysis</h3>
                                {data.agingPayables.length > 0 ? (
                                    data.agingPayables.map((a, i) => (
                                        <div key={i} style={{ marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <span style={{ color: '#374151' }}>{a.range}</span>
                                                <span style={{ fontWeight: 600 }}>{formatCurrency(a.amount)} ({a.count} bills)</span>
                                            </div>
                                            <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px' }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: data.payables > 0 ? `${(a.amount / data.payables) * 100}%` : '0%',
                                                    background: ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'][i],
                                                    borderRadius: '6px'
                                                }}></div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#10b981', padding: '40px' }}>
                                        <FaCheckCircle size={32} />
                                        <p style={{ margin: '12px 0 0' }}>All bills have been paid!</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top Suppliers */}
                        {data.topSuppliers.length > 0 && (
                            <div style={{ marginTop: '24px' }}>
                                <h3 style={{ margin: '0 0 16px', color: '#1e293b' }}>Top Suppliers by Amount</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                            <th style={{ padding: '12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Supplier</th>
                                            <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Amount</th>
                                            <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Transactions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.topSuppliers.slice(0, 5).map((supplier, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '12px' }}>{supplier.name}</td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(supplier.amount)}</td>
                                                <td style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>{supplier.transactions}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ==================== INVENTORY ==================== */}
                {hasData && activeReport === 'inventory' && (
                    <div style={cardStyle}>
                        <h2 style={{ margin: '0 0 24px', color: '#1e293b', fontSize: '1.5rem' }}>Inventory Report</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                            {/* Inventory Value */}
                            <div style={{ padding: '24px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                                <p style={{ margin: 0, color: '#0369a1' }}>Total Inventory Value</p>
                                <h2 style={{ margin: '12px 0 0', fontSize: '2rem', color: '#0c4a6e' }}>{formatCurrency(data.inventory)}</h2>
                            </div>

                            {/* Low Stock Alert */}
                            <div style={{ padding: '24px', background: data.lowStockProducts.length > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '12px', border: `1px solid ${data.lowStockProducts.length > 0 ? '#fecaca' : '#bbf7d0'}` }}>
                                <p style={{ margin: 0, color: data.lowStockProducts.length > 0 ? '#991b1b' : '#166534' }}>Low Stock Items</p>
                                <h2 style={{ margin: '12px 0 0', fontSize: '2rem', color: data.lowStockProducts.length > 0 ? '#7f1d1d' : '#14532d' }}>
                                    {data.lowStockProducts.length}
                                </h2>
                            </div>
                        </div>

                        {/* Inventory by Category */}
                        {data.inventoryByCategory.length > 0 && (
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ margin: '0 0 16px', color: '#1e293b' }}>Inventory by Category</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                    {data.inventoryByCategory.map((cat, idx) => (
                                        <div key={idx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>{cat.category}</p>
                                            <p style={{ margin: '8px 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(cat.value)}</p>
                                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>{cat.quantity} units</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Low Stock Products */}
                        {data.lowStockProducts.length > 0 && (
                            <div>
                                <h3 style={{ margin: '0 0 16px', color: '#1e293b' }}>
                                    <FaExclamationTriangle color="#f59e0b" style={{ marginRight: '8px' }} />
                                    Low Stock Alert
                                </h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                            <th style={{ padding: '12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Product</th>
                                            <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Current Stock</th>
                                            <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Reorder Level</th>
                                            <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.lowStockProducts.map((product, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '12px', fontWeight: 500 }}>{product.name}</td>
                                                <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{product.stock}</td>
                                                <td style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>{product.reorderLevel}</td>
                                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                                    <span style={{ padding: '4px 8px', background: '#fef2f2', color: '#991b1b', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                        Reorder Now
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;