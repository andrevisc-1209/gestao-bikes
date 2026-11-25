import type { IncidentStatus } from '../types/database';

// The fields the filters read. Kept minimal so the filters work on the
// incident rows OccurrencesTab loads (incident joined with its bike).
export interface FilterableIncident {
  reason: string;
  status: IncidentStatus;
  created_at: string;
  bikes: { tag_number: string | null; unit_block: string; owner_name: string | null } | null;
}

export type PeriodFilter = 'all' | 'today' | '7d' | '30d' | 'custom';
export type StatusFilter = 'all' | IncidentStatus;

export interface IncidentFilters {
  period: PeriodFilter;
  from: string; // yyyy-mm-dd, used when period is 'custom'
  to: string; // yyyy-mm-dd, inclusive
  search: string; // bike number, unit or owner
  reason: string; // '' means any
  status: StatusFilter;
}

export const EMPTY_FILTERS: IncidentFilters = {
  period: 'all',
  from: '',
  to: '',
  search: '',
  reason: '',
  status: 'all',
};

export function hasActiveFilters(filters: IncidentFilters): boolean {
  return (
    filters.period !== 'all' ||
    filters.search.trim() !== '' ||
    filters.reason !== '' ||
    filters.status !== 'all'
  );
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

// The [start, end) window of a period, in the admin's local time. "7 dias"
// counts today plus the 6 days before it.
export function periodRange(filters: IncidentFilters, now: Date): { start: Date | null; end: Date | null } {
  const today = startOfLocalDay(now);
  const daysBack = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  switch (filters.period) {
    case 'today':
      return { start: today, end: null };
    case '7d':
      return { start: daysBack(6), end: null };
    case '30d':
      return { start: daysBack(29), end: null };
    case 'custom': {
      const from = parseLocalDate(filters.from);
      const to = parseLocalDate(filters.to);
      return {
        start: from,
        end: to ? new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1) : null,
      };
    }
    default:
      return { start: null, end: null };
  }
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Search matches the bike number ignoring leading zeros ("4" finds 004), or
// any part of the unit or owner name, ignoring accents and case.
function matchesSearch(incident: FilterableIncident, search: string): boolean {
  const query = normalize(search);
  if (!query) return true;
  const bike = incident.bikes;
  if (!bike) return false;
  const tag = bike.tag_number ?? '';
  if (/^\d+$/.test(query) && tag && Number(tag) === Number(query)) return true;
  return [tag, bike.unit_block, bike.owner_name ?? ''].some((field) => normalize(field).includes(query));
}

export function filterIncidents<T extends FilterableIncident>(
  incidents: T[],
  filters: IncidentFilters,
  now: Date = new Date(),
): T[] {
  const { start, end } = periodRange(filters, now);
  return incidents.filter((incident) => {
    const created = new Date(incident.created_at);
    if (start && created < start) return false;
    if (end && created >= end) return false;
    if (filters.status !== 'all' && incident.status !== filters.status) return false;
    if (filters.reason && incident.reason !== filters.reason) return false;
    return matchesSearch(incident, filters.search);
  });
}

// The bikes reported more than once in the given incidents, most first, so
// the admin spots repeat problems. Ties keep the lower bike number first.
export function repeatBikes(incidents: FilterableIncident[], limit = 5): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const incident of incidents) {
    const tag = incident.bikes?.tag_number;
    if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}
