import { describe, it, expect } from 'vitest';
import { validateGSTIN } from '../qa/QAHelperFunctions';

describe('QA Utility Tests', () => {
  it('should correctly validate Tamil Nadu GSTINs (State 33)', () => {
    // Valid GSTINs (Supporting all India state codes)
    expect(validateGSTIN('33AABCS1234A1Z5')).toBe(true); // Tamil Nadu
    expect(validateGSTIN('29AABCS1234A1Z5')).toBe(true); // Karnataka (Now allowed)
    expect(validateGSTIN('07AABCS1234A1Z5')).toBe(true); // Delhi (Now allowed)
    expect(validateGSTIN('33ABC1234')).toBe(false);       // Too short
    expect(validateGSTIN('33AABCS1234A1Z@')).toBe(false); // Invalid special character at end
  });
});
