import { describe, it, expect } from 'vitest';
import { formatBrazilPhone, formatPhoneForDisplay } from './phone';

describe('formatPhoneForDisplay', () => {
  it('formats an 11-digit number', () => {
    expect(formatPhoneForDisplay('21999990000')).toBe('(21) 99999-0000');
  });

  it('formats a 10-digit number the same way formatBrazilPhone does', () => {
    expect(formatPhoneForDisplay('2133334444')).toBe(formatBrazilPhone('2133334444'));
    expect(formatPhoneForDisplay('2133334444')).toBe('(21) 33334-444');
  });

  it('keeps an already punctuated number the same', () => {
    expect(formatPhoneForDisplay('(21) 99999-0000')).toBe('(21) 99999-0000');
  });

  it('returns odd-length legacy data unchanged (not truncated)', () => {
    expect(formatPhoneForDisplay('5555555555555555')).toBe('5555555555555555');
  });

  it('returns an empty string for empty or nullish input', () => {
    expect(formatPhoneForDisplay('')).toBe('');
    expect(formatPhoneForDisplay(null)).toBe('');
    expect(formatPhoneForDisplay(undefined)).toBe('');
  });
});

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
