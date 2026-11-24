import { describe, it, expect } from 'vitest';
import { formatBrazilPhone } from './phone';

describe('formatBrazilPhone', () => {
  it('formats a full 11-digit number', () => {
    expect(formatBrazilPhone('21999990000')).toBe('(21) 99999-0000');
  });

  it('formats partial input as the user types, digit by digit', () => {
    expect(formatBrazilPhone('2')).toBe('(2');
    expect(formatBrazilPhone('21')).toBe('(21');
    expect(formatBrazilPhone('219')).toBe('(21) 9');
    expect(formatBrazilPhone('21999990')).toBe('(21) 99999-0');
    expect(formatBrazilPhone('219999900')).toBe('(21) 99999-00');
  });

  it('strips non-digit characters before formatting, so a pasted formatted number re-formats correctly', () => {
    expect(formatBrazilPhone('(21) 99999-0000')).toBe('(21) 99999-0000');
  });

  it('truncates input beyond 11 digits instead of overflowing the mask', () => {
    expect(formatBrazilPhone('219999900001234')).toBe('(21) 99999-0000');
  });

  it('returns an empty string for empty input', () => {
    expect(formatBrazilPhone('')).toBe('');
  });
});
