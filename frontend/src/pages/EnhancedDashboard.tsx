// frontend/src/pages/EnhancedDashboard.tsx
import axios from "axios";
import React, { useEffect, useState } from "react";
import {
    FiAlertCircle, FiBriefcase,
    FiCreditCard,
    FiDollarSign,
    FiShoppingCart, FiUsers
} from "react-icons/fi";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend, ResponsiveContainer,
    Tooltip,
    XAxis, YAxis
} from "recharts";

interface DashboardData {
    finance: {
        bank: { total_balance: number; accounts: any[] };
        loans: { summary: { total_borrowed: number; total_outstanding: number } };
        sales: { outstanding_invoices: { amount: number } };
    };
    operations: {
        inventory: { critical_count: number };
    };
    hr: { total_employees: number; attendance_today: any };
}

const EnhancedDashboard: React.FC = () => {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [financialData, setFinancialData] = useState<any>(null);
    const [kpis, setKPIs] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("accessToken");
            const headers = { Authorization: `Bearer ${token}` };

            const [dashResponse, finResponse, kpiResponse] = await Promise.all([
                axios.get("/api/dashboard", { headers }),
                axios.get("/api/dashboard/finance", { headers }),
                axios.get("/api/dashboard/kpis", { headers })
            ]);

            setDashboardData(dashResponse.data.data);
            setFinancialData(finResponse.data.data);
            setKPIs(kpiResponse.data.data);
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to load dashboard");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg m-4">
                <div className="flex items-center gap-3">
                    <FiAlertCircle className="text-red-600 text-xl" />
                    <p className="text-red-800">{error}</p>
                </div>
            </div>
        );
    }

    const SummaryCard = ({ icon: Icon, title, value, unit, color }: any) => (
        <div className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${color}`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-gray-600 text-sm font-medium">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
                        <span className="text-lg text-gray-500 ml-2">{unit}</span>
                    </p>
                </div>
                <Icon className={`text-3xl ${color.replace("border", "text")}`} />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-600 mt-2">
                        {new Date().toLocaleDateString("en-IN", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric"
                        })}
                    </p>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <SummaryCard
                        icon={FiDollarSign}
                        title="Total Bank Balance"
                        value={dashboardData?.finance.bank.total_balance || 0}
                        unit="₹"
                        color="border-blue-500 text-blue-600"
                    />
                    <SummaryCard
                        icon={FiCreditCard}
                        title="Outstanding Receivables"
                        value={kpis?.outstanding_receivables || 0}
                        unit="₹"
                        color="border-orange-500 text-orange-600"
                    />
                    <SummaryCard
                        icon={FiBriefcase}
                        title="Total Loan Exposure"
                        value={kpis?.total_loan_exposure || 0}
                        unit="₹"
                        color="border-red-500 text-red-600"
                    />
                    <SummaryCard
                        icon={FiUsers}
                        title="Total Employees"
                        value={dashboardData?.hr.total_employees || 0}
                        unit=""
                        color="border-green-500 text-green-600"
                    />
                </div>

                {/* Financial Overview */}
                {financialData && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Monthly Income vs Expense</h2>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={financialData.monthly_trend || []}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="sales" fill="#3b82f6" name="Sales" />
                                    <Bar dataKey="tax" fill="#10b981" name="Tax" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Financial Summary</h2>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-gray-600 text-sm">Total Income</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        ₹{financialData.summary?.total_income.toLocaleString("en-IN")}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-gray-600 text-sm">Total Expenses</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        ₹{financialData.summary?.total_expenses.toLocaleString("en-IN")}
                                    </p>
                                </div>
                                <div className="border-t pt-4">
                                    <p className="text-gray-600 text-sm">Net Profit</p>
                                    <p className={`text-2xl font-bold ${financialData.summary?.net_profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        ₹{financialData.summary?.net_profit.toLocaleString("en-IN")}
                                    </p>
                                    <p className="text-gray-500 text-xs mt-2">
                                        Profit Margin: {financialData.summary?.profit_margin_percent}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Operational Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <FiShoppingCart className="text-blue-600" />
                            Inventory Status
                        </h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-green-50 rounded">
                                <p className="text-gray-600 text-sm">OK Stock</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {dashboardData?.operations.inventory ? 
                                        (dashboardData.operations.inventory as any).all_stocks?.length - 
                                        (dashboardData.operations.inventory as any).critical_count : 0}
                                </p>
                            </div>
                            <div className="text-center p-4 bg-yellow-50 rounded">
                                <p className="text-gray-600 text-sm">Low Stock</p>
                                <p className="text-2xl font-bold text-yellow-600">
                                    {(dashboardData?.operations.inventory as any)?.low_stock_items?.length || 0}
                                </p>
                            </div>
                            <div className="text-center p-4 bg-red-50 rounded">
                                <p className="text-gray-600 text-sm">Out of Stock</p>
                                <p className="text-2xl font-bold text-red-600">
                                    {(dashboardData?.operations.inventory as any)?.out_of_stock_items?.length || 0}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <FiUsers className="text-purple-600" />
                            HR Status
                        </h2>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Present Today</span>
                                <span className="font-bold text-green-600">
                                    {dashboardData?.hr.attendance_today?.present || 0}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Absent Today</span>
                                <span className="font-bold text-red-600">
                                    {dashboardData?.hr.attendance_today?.absent || 0}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Not Marked</span>
                                <span className="font-bold text-gray-600">
                                    {dashboardData?.hr.attendance_today?.not_marked || 0}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alerts & Notifications */}
                {(dashboardData?.operations.inventory as any)?.critical_count > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
                        <div className="flex items-center gap-3">
                            <FiAlertCircle className="text-yellow-600 text-xl" />
                            <div>
                                <p className="font-bold text-yellow-900">
                                    ⚠️ {(dashboardData?.operations.inventory as any)?.critical_count} Products Need Attention
                                </p>
                                <p className="text-yellow-800 text-sm">
                                    Low stock or out of stock items require immediate attention
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnhancedDashboard;
