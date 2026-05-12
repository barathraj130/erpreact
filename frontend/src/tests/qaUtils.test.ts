import { describe, it, expect } from 'vitest';
import { validateGSTIN } from '../qa/QAHelperFunctions';

describe('QA Utility Tests', () => {
  it('should correctly validate Tamil Nadu GSTINs (State 33)', () => {
    // Valid GSTINs
    expect(validateGSTIN('33AABCS1234A1Z5')).toBe(true);
    expect(validateGSTIN('33BBCFS5678B2Z6')).toBe(true);
    
    // Invalid GSTINs
    expect(validateGSTIN('29AABCS1234A1Z5')).toBe(false); // Wrong state code (Karnataka)
    expect(validateGSTIN('33ABC1234')).toBe(false);       // Too short
    expect(validateGSTIN('33AABCS1234A1Z@')).toBe(false); // Invalid special character at end
  });
});
