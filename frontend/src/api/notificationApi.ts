// frontend/src/api/notificationApi.ts

import { apiFetch } from '../utils/api';

export interface Notification {
    id: number;
    user_id: number;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    link: string | null;
    is_read: boolean;
    created_at: string;
}

/**
 * Fetches all notifications for the current user.
 */
export const fetchNotifications = async (): Promise<Notification[]> => {
    const res = await apiFetch('/notifications'); 
    return res.json();
};

/**
 * Marks a specific notification as read.
 */
export const markAsRead = async (id: number): Promise<{ message: string }> => {
    const res = await apiFetch(`/notifications/${id}/read`, {
        method: 'PUT',
    });
    return res.json();
};