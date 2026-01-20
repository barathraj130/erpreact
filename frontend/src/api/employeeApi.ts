import { apiFetch } from '../utils/api';

export interface Employee {
    id: number;
    name: string;
    designation: string;
    email: string;
    phone: string;
    salary: number;
    joining_date: string;
    status: 'Active' | 'On Leave' | 'Resigned';
}

export const fetchEmployees = async (): Promise<Employee[]> => {
    const res = await apiFetch('/employees');
    return res.json();
};

export const createEmployee = async (data: any): Promise<any> => {
    const res = await apiFetch('/employees', {
        method: 'POST',
        body: data
    });
    return res.json();
};

export const updateEmployee = async (id: number, data: any): Promise<any> => {
    const res = await apiFetch(`/employees/${id}`, {
        method: 'PUT',
        body: data
    });
    return res.json();
};

export const deleteEmployee = async (id: number): Promise<any> => {
    const res = await apiFetch(`/employees/${id}`, { method: 'DELETE' });
    return res.json();
};