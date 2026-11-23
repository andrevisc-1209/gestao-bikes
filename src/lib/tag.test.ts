import { describe, it, expect } from 'vitest';
import { formatTagNumber } from './tag';

describe('formatTagNumber', () => {
  it('pads single digits to 3 characters', () => {
    expect(formatTagNumber(1)).toBe('001');
  });
  it('pads double digits to 3 characters', () => {
    expect(formatTagNumber(14)).toBe('014');
  });
  it('keeps triple digits as-is', () => {
    expect(formatTagNumber(123)).toBe('123');
  });
});
