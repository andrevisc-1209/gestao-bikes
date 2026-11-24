import { describe, it, expect } from 'vitest';
import { safeHttpUrl } from './safeUrl';

describe('safeHttpUrl', () => {
  it('accepts https URLs', () => {
    expect(safeHttpUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
  });
  it('accepts http URLs', () => {
    expect(safeHttpUrl('http://example.com/a.jpg')).toBe('http://example.com/a.jpg');
  });
  it('rejects javascript: URLs', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
  });
  it('rejects data: URLs', () => {
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });
  it('rejects garbage without throwing', () => {
    expect(safeHttpUrl('not a url')).toBeNull();
  });
  it('returns null for null, undefined and empty', () => {
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl('')).toBeNull();
  });
});
