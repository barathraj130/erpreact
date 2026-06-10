// backend/middlewares/validate.js
import { z } from 'zod';

export const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (err) {
        return res.status(400).json({ 
            error: "Validation failed", 
            details: err.errors.map(e => ({ path: e.path, message: e.message })) 
        });
    }
};

// Common Schemas
export const loginSchema = z.object({
    body: z.object({
        username: z.string().min(3),
        password: z.string().min(6),
    }),
});

export const createInvoiceSchema = z.object({
    body: z.object({
        customer_id: z.number().int(),
        invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        total_amount: z.number().positive(),
        items: z.array(z.object({
            product_id: z.number().int(),
            quantity: z.number().positive(),
            unit_price: z.number().nonnegative(),
        })).min(1),
    }),
});

export const createEmployeeSchema = z.object({
    body: z.object({
        name: z.string().min(2),
        email: z.string().email(),
        role: z.string(),
        salary: z.number().nonnegative(),
    }),
});
