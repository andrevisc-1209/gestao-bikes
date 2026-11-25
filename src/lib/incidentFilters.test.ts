import { describe, it, expect } from 'vitest';
import { EMPTY_FILTERS, filterIncidents, hasActiveFilters, periodRange, repeatBikes, type FilterableIncident } from './incidentFilters';

const NOW = new Date(2026, 10, 25, 15, 0); // 25/11/2026 15:00 local

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

const incident = (tag: string, created_at: string, extra: Partial<FilterableIncident> = {}): FilterableIncident => ({
  reason: 'Pneu murcho',
  status: 'open',
  created_at,
  bikes: { tag_number: tag, unit_block: 'Bloco A • Apto 505', owner_name: 'José Antônio' },
  ...extra,
});

describe('periodRange', () => {
  it('starts today at local midnight and counts 7 days including today', () => {
    expect(periodRange({ ...EMPTY_FILTERS, period: 'today' }, NOW).start).toEqual(new Date(2026, 10, 25));
    expect(periodRange({ ...EMPTY_FILTERS, period: '7d' }, NOW).start).toEqual(new Date(2026, 10, 19));
    expect(periodRange({ ...EMPTY_FILTERS, period: '30d' }, NOW).start).toEqual(new Date(2026, 9, 27));
  });

  it('includes the whole "até" day in a custom range and allows open ends', () => {
    expect(periodRange({ ...EMPTY_FILTERS, period: 'custom', from: '2026-11-10', to: '2026-11-12' }, NOW)).toEqual({
      start: new Date(2026, 10, 10),
      end: new Date(2026, 10, 13),
    });
    expect(periodRange({ ...EMPTY_FILTERS, period: 'custom', from: '', to: '' }, NOW)).toEqual({ start: null, end: null });
  });
});

describe('filterIncidents', () => {
  const list = [
    incident('004', at(2026, 11, 25, 9)),
    incident('005', at(2026, 11, 19, 1), { status: 'resolved', reason: 'Cabo solto' }),
    incident('012', at(2026, 11, 18, 23)),
  ];

  it('keeps only the period', () => {
    expect(filterIncidents(list, { ...EMPTY_FILTERS, period: 'today' }, NOW)).toHaveLength(1);
    expect(filterIncidents(list, { ...EMPTY_FILTERS, period: '7d' }, NOW)).toHaveLength(2);
  });

  it('searches the bike number without leading zeros, the unit and the owner without accents', () => {
    expect(filterIncidents(list, { ...EMPTY_FILTERS, search: '4' }, NOW).map((i) => i.bikes?.tag_number)).toEqual(['004']);
    expect(filterIncidents(list, { ...EMPTY_FILTERS, search: '12' }, NOW).map((i) => i.bikes?.tag_number)).toEqual(['012']);
    expect(filterIncidents(list, { ...EMPTY_FILTERS, search: 'apto 505' }, NOW)).toHaveLength(3);
    expect(filterIncidents(list, { ...EMPTY_FILTERS, search: 'jose antonio' }, NOW)).toHaveLength(3);
  });

  it('filters by status and reason', () => {
    expect(filterIncidents(list, { ...EMPTY_FILTERS, status: 'resolved' }, NOW)).toHaveLength(1);
    expect(filterIncidents(list, { ...EMPTY_FILTERS, reason: 'Pneu murcho' }, NOW)).toHaveLength(2);
  });

  it('drops incidents without a bike when searching', () => {
    expect(filterIncidents([{ ...incident('1', at(2026, 11, 1)), bikes: null }], { ...EMPTY_FILTERS, search: '1' }, NOW)).toHaveLength(0);
  });
});

describe('repeatBikes', () => {
  it('lists bikes reported more than once, most first', () => {
    const list = ['004', '005', '004', '005', '004', '009'].map((tag) => incident(tag, at(2026, 11, 1)));
    expect(repeatBikes(list)).toEqual([
      { tag: '004', count: 3 },
      { tag: '005', count: 2 },
    ]);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the empty filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: '  ' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, period: '7d' })).toBe(true);
  });
});
