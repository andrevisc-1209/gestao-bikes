import { describe, it, expect } from 'vitest';
import { occupancyPercent } from './KpiCards';

describe('occupancyPercent', () => {
  it('clamps at 100 when active bikes exceed capacity', () => {
    expect(occupancyPercent(60, 50)).toBe(100);
  });
  it('computes a normal percentage otherwise', () => {
    expect(occupancyPercent(38, 50)).toBe(76);
  });
  it('returns 0 when capacity is zero', () => {
    expect(occupancyPercent(0, 0)).toBe(0);
  });
  it('returns 0 when capacity is negative', () => {
    expect(occupancyPercent(5, -10)).toBe(0);
  });
});
