// frontend/src/utils/sanitize.ts
import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS
 */
export const sanitizeHTML = (html: string): string => {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'target']
    });
};

/**
 * Sanitizes plain text by removing any HTML-like sequences
 */
export const sanitizeText = (text: string): string => {
    return text.replace(/<[^>]*>?/gm, '');
};
