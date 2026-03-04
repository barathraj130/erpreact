// frontend/src/api/tocApi.ts
import { apiFetch } from '../utils/api';

export interface Constraint {
    id: number;
    company_id: number;
    constraint_name: string;
    constraint_type: string;
    area: string;
    description: string;
    identified_date: string;
    status: 'ACTIVE' | 'RESOLVED' | 'ELEVATED';
    capacity: number;
    demand: number;
    utilization_percent: number;
    priority: number;
    action_count?: number;
    completed_actions?: number;
}

export interface ConstraintAction {
    id: number;
    constraint_id: number;
    step_number: number;
    step_name: string;
    action_description: string;
    assigned_to: number;
    assigned_to_name?: string;
    due_date: string;
    completion_date?: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    notes: string;
}

export interface ThroughputMetrics {
    id: number;
    period_start: string;
    period_end: string;
    total_sales: number;
    totally_variable_costs: number;
    throughput: number;
    raw_materials: number;
    work_in_process: number;
    finished_goods: number;
    total_investment: number;
    operating_expense: number;
    net_profit: number;
    return_on_investment: number;
    productivity: number;
    investment_turns: number;
}

export const fetchConstraints = async (): Promise<Constraint[]> => {
    const res = await apiFetch('/toc/constraints');
    return res.json();
};

export const createConstraint = async (data: Partial<Constraint>): Promise<Constraint> => {
    const res = await apiFetch('/toc/constraints', {
        method: 'POST',
        body: data
    });
    return res.json();
};

export const updateConstraint = async (id: number, data: Partial<Constraint>): Promise<Constraint> => {
    const res = await apiFetch(`/toc/constraints/${id}`, {
        method: 'PUT',
        body: data
    });
    return res.json();
};

export const fetchConstraintActions = async (constraintId: number): Promise<ConstraintAction[]> => {
    const res = await apiFetch(`/toc/constraints/${constraintId}/actions`);
    return res.json();
};

export const createConstraintAction = async (constraintId: number, data: Partial<ConstraintAction>): Promise<ConstraintAction> => {
    const res = await apiFetch(`/toc/constraints/${constraintId}/actions`, {
        method: 'POST',
        body: data
    });
    return res.json();
};

export const updateActionStatus = async (actionId: number, data: { status: string, notes?: string }): Promise<ConstraintAction> => {
    const res = await apiFetch(`/toc/actions/${actionId}`, {
        method: 'PUT',
        body: data
    });
    return res.json();
};

export const fetchThroughputMetrics = async (params?: { period_start?: string, period_end?: string }): Promise<ThroughputMetrics[]> => {
    let url = '/toc/throughput';
    if (params?.period_start && params?.period_end) {
        url += `?period_start=${params.period_start}&period_end=${params.period_end}`;
    }
    const res = await apiFetch(url);
    return res.json();
};

export const calculateThroughput = async (data: any): Promise<ThroughputMetrics> => {
    const res = await apiFetch('/toc/throughput/calculate', {
        method: 'POST',
        body: data
    });
    return res.json();
};

export const fetchTocDashboard = async () => {
    const res = await apiFetch('/toc/dashboard');
    return res.json();
};
