// frontend/src/api/authApi.ts
import { apiFetch } from "../utils/api";

export interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    active_company_id?: number;
    signature_url?: string;
    permissions?: any[]; // Added to support the new permission system
}

interface LoginResponse {
    success: boolean;
    token: string;
}

export async function login(email: string, password: string, companyCode: string): Promise<LoginResponse> {
    const res = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password, company_code: companyCode }
    });
    return res.json();
}

export async function getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem("erp-token");
    if (!token) return null;

    try {
        const res = await apiFetch("/auth/me");
        if (!res.ok) {
            throw new Error("Failed to fetch user");
        }
        return res.json();
    } catch (error) {
        console.error("Failed to fetch current user", error);
        throw error; // Throw so App.tsx can show the error screen
    }
}