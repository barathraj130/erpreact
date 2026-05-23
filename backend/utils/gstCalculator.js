/**
 * gstCalculator.js
 * Centralised GST logic for FLUXORA ERP.
 *
 * Business rules:
 *  - Same state as company (Tamil Nadu / code 33) → CGST + SGST (split equally)
 *  - Different state → IGST only (full rate)
 *  - NON_TAX_INVOICE / isNonTax → zero GST regardless of state
 *
 * Company is always JBS Knit Wear, Tamil Nadu, state code 33.
 */

export const COMPANY_STATE_CODE = '33'; // Tamil Nadu

/**
 * All Indian state codes → state names.
 * Used to derive state_code from a state name string when state_code is absent.
 */
export const STATE_CODE_MAP = {
    '01': 'JAMMU AND KASHMIR', '02': 'HIMACHAL PRADESH', '03': 'PUNJAB',
    '04': 'CHANDIGARH', '05': 'UTTARAKHAND', '06': 'HARYANA', '07': 'DELHI',
    '08': 'RAJASTHAN', '09': 'UTTAR PRADESH', '10': 'BIHAR', '11': 'SIKKIM',
    '12': 'ARUNACHAL PRADESH', '13': 'NAGALAND', '14': 'MANIPUR', '15': 'MIZORAM',
    '16': 'TRIPURA', '17': 'MEGHALAYA', '18': 'ASSAM', '19': 'WEST BENGAL',
    '20': 'JHARKHAND', '21': 'ODISHA', '22': 'CHHATTISGARH', '23': 'MADHYA PRADESH',
    '24': 'GUJARAT', '25': 'DAMAN AND DIU', '26': 'DADRA AND NAGAR HAVELI',
    '27': 'MAHARASHTRA', '28': 'ANDHRA PRADESH', '29': 'KARNATAKA', '30': 'GOA',
    '31': 'LAKSHADWEEP', '32': 'KERALA', '33': 'TAMIL NADU', '34': 'PUDUCHERRY',
    '35': 'ANDAMAN AND NICOBAR', '36': 'TELANGANA', '37': 'ANDHRA PRADESH',
    '38': 'LADAKH',
};

// Reverse map: state name → code
const NAME_TO_CODE = {};
for (const [code, name] of Object.entries(STATE_CODE_MAP)) {
    NAME_TO_CODE[name] = code;
    // Aliases
    if (name === 'TAMIL NADU') { NAME_TO_CODE['TN'] = code; NAME_TO_CODE['TAMILNADU'] = code; }
    if (name === 'UTTAR PRADESH') { NAME_TO_CODE['UP'] = code; }
    if (name === 'MADHYA PRADESH') { NAME_TO_CODE['MP'] = code; }
    if (name === 'WEST BENGAL') { NAME_TO_CODE['WB'] = code; }
    if (name === 'ANDHRA PRADESH') { NAME_TO_CODE['AP'] = code; }
}

/**
 * Resolve a GST state code from any input:
 *  - A 2-digit numeric string  → returned as-is
 *  - A state name string       → looked up in the map
 *  - A GSTIN (≥2 chars)        → first 2 chars
 *  - null / undefined          → returns null
 */
export function resolveStateCode(value) {
    if (!value) return null;
    const s = String(value).trim().toUpperCase();
    if (/^\d{2}$/.test(s)) return s;                          // already a code
    if (NAME_TO_CODE[s]) return NAME_TO_CODE[s];              // state name
    if (/^\d{15}$/.test(s) || s.length >= 2) {
        const prefix = s.substring(0, 2);
        if (/^\d{2}$/.test(prefix)) return prefix;            // GSTIN prefix
    }
    return null;
}

/**
 * Determine GST type by comparing customer state code with company (TN=33).
 *
 * @param {string|null} customerStateCode
 * @param {string|null} customerStateName   Fallback if code is absent
 * @param {string|null} customerGstin       Fallback: derive from first 2 digits
 * @returns {'INTRA_STATE'|'INTER_STATE'}
 */
export function determineGstType(customerStateCode, customerStateName, customerGstin) {
    // Resolve customer's state code from whatever is available
    const code = resolveStateCode(customerStateCode)
              || resolveStateCode(customerStateName)
              || resolveStateCode(customerGstin);

    if (!code) return 'INTRA_STATE';          // unknown → default to TN (intra)
    return code === COMPANY_STATE_CODE ? 'INTRA_STATE' : 'INTER_STATE';
}

/**
 * Calculate GST for a single line item.
 *
 * @param {number} taxableAmount
 * @param {number} gstPercent   e.g. 18 for 18%
 * @param {string} gstType      'INTRA_STATE' | 'INTER_STATE'
 * @param {boolean} isNonTax    True for NON_TAX invoices
 * @returns {{cgstRate,sgstRate,igstRate,cgstAmount,sgstAmount,igstAmount,totalGst}}
 */
export function calculateLineGST(taxableAmount, gstPercent, gstType, isNonTax = false) {
    if (isNonTax || !gstPercent || gstPercent <= 0) {
        return { cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalGst: 0 };
    }
    const total = (taxableAmount * gstPercent) / 100;
    if (gstType === 'INTRA_STATE') {
        const half = total / 2;
        return {
            cgstRate: gstPercent / 2, sgstRate: gstPercent / 2, igstRate: 0,
            cgstAmount: half, sgstAmount: half, igstAmount: 0, totalGst: total,
        };
    } else {
        return {
            cgstRate: 0, sgstRate: 0, igstRate: gstPercent,
            cgstAmount: 0, sgstAmount: 0, igstAmount: total, totalGst: total,
        };
    }
}
