/**
 * sendWelcomeWhatsApp.js
 * Sends a branded welcome / confirmation WhatsApp message when a new record
 * is created.  Covered: customer, employee, lender, broker, employee_advance.
 * NOT sent for: suppliers.
 *
 * All failures are silent (non-blocking) — they must never break the main request.
 */

import { sendWhatsApp } from './whatsapp.js';

const d = (v) => new Date(v).toLocaleDateString('en-IN');

export async function sendWelcomeWhatsApp(type, data) {
    try {
        let phone = data.phone;
        if (!phone) return;

        // Normalise phone (remove non-digits, prefix 91 if needed)
        phone = String(phone).replace(/\D/g, '');
        if (!phone || phone.length < 10) return;

        let msg = '';

        switch (type) {

            case 'customer':
                msg =
`Dear ${data.name || data.username},

👋 Welcome to JBS Knit Wear!

Your account has been created successfully.

You can now:
✅ Receive invoices on WhatsApp
✅ Get payment reminders
✅ Track your account balance

For any queries:
📞 8148232205
JBS Knit Wear, Tiruppur`;
                break;

            case 'employee':
                msg =
`Dear ${data.name},

👋 Welcome to JBS Knit Wear Team!

You have been added as ${data.designation || 'Employee'}.
Department: ${data.department || 'General'}
Salary Type: ${(data.salary_type || 'monthly').charAt(0).toUpperCase() + (data.salary_type || 'monthly').slice(1)}
${data.salary_type === 'weekly'  ? `Weekly Rate: ₹${Number(data.weekly_rate || 0).toLocaleString('en-IN')}`
: data.salary_type === 'daily'   ? `Daily Rate: ₹${Number(data.daily_rate || 0).toLocaleString('en-IN')}`
: `Monthly Salary: ₹${Number(data.salary || 0).toLocaleString('en-IN')}`}
Join Date: ${data.joining_date ? d(data.joining_date) : 'Today'}

Welcome aboard! 🎉
JBS Knit Wear
📞 8148232205`;
                break;

            case 'lender':
                msg =
`Dear ${data.contact_person || data.lender_name},

👋 Your lending account has been created at JBS Knit Wear.

${data.opening_balance > 0 ? `Loan Amount: ₹${Number(data.opening_balance).toLocaleString('en-IN')}
Type: ${data.lender_type || 'Private'}` : ''}

Thank you for your support! 🙏
JBS Knit Wear, Tiruppur
📞 8148232205`;
                break;

            case 'broker':
                msg =
`Dear ${data.name},

👋 Welcome as our Broker Partner at JBS Knit Wear!

${data.commission_rate ? `Commission Rate: ${data.commission_rate}%` : ''}

You will receive notifications for:
✅ New orders linked to you
✅ Commission payments

JBS Knit Wear, Tiruppur
📞 8148232205`;
                break;

            case 'employee_advance':
                msg =
`Dear ${data.name},

💸 Salary Advance Approved!

Amount: ₹${Number(data.amount || 0).toLocaleString('en-IN')}
Date: ${d(data.date || new Date())}
Purpose: ${data.reason || 'Not specified'}
${data.total_pending ? `Total Pending: ₹${Number(data.total_pending).toLocaleString('en-IN')}` : ''}

This will be deducted from your salary.
JBS Knit Wear
📞 8148232205`;
                break;

            default:
                return;
        }

        await sendWhatsApp(phone, msg);
    } catch (_) {
        // Always silent — must never crash the calling route
    }
}
