import { describe, it, expect } from 'vitest';
import { buildStickerRows, matchTags, parseTagList, MAX_RANGE, type BikeSummary } from './stickerSelection';
import type { Sticker } from '../types/database';

const sticker = (tag_number: string, status: Sticker['status'], bike_id: string | null = null): Sticker => ({
  tag_number,
  status,
  bike_id,
  created_at: '2026-01-01',
});

const bike = (id: string, tag_number: string | null, status: BikeSummary['status']): BikeSummary => ({
  id,
  tag_number,
  status,
  owner_name: `Dono ${id}`,
  unit_block: 'Apto 101',
  brand_model: 'Caloi',
});

describe('buildStickerRows', () => {
  it('marks reserve, in-use and deactivated-bike stickers', () => {
    const rows = buildStickerRows(
      [sticker('010', 'available'), sticker('004', 'assigned', 'b1'), sticker('005', 'assigned', 'b2')],
      [bike('b1', '004', 'active'), bike('b2', '005', 'inactive')],
    );
    expect(rows.map((r) => [r.tag_number, r.state])).toEqual([
      ['004', 'active'],
      ['005', 'inactive'],
      ['010', 'reserve'],
    ]);
    expect(rows[0].bike?.owner_name).toBe('Dono b1');
  });

  it('adds bikes numbered before the sticker pool existed', () => {
    const rows = buildStickerRows([sticker('004', 'available')], [bike('old', '002', 'active'), bike('p', null, 'pending')]);
    expect(rows.map((r) => [r.tag_number, r.state])).toEqual([
      ['002', 'active'],
      ['004', 'reserve'],
    ]);
  });
});

describe('parseTagList', () => {
  it('reads numbers and ranges split by commas, semicolons or spaces', () => {
    expect(parseTagList('002, 3; 010-012  2')).toEqual({ numbers: [2, 3, 10, 11, 12], invalid: [] });
  });

  it('reports what it cannot read, including reversed or huge ranges', () => {
    expect(parseTagList(`abc 9-5 1-${MAX_RANGE + 1}`).invalid).toEqual(['abc', '9-5', `1-${MAX_RANGE + 1}`]);
  });
});

describe('matchTags', () => {
  it('matches regardless of leading zeros and lists missing numbers padded', () => {
    const rows = buildStickerRows([sticker('002', 'assigned'), sticker('003', 'available')], []);
    expect(matchTags([2, 3, 99], rows)).toEqual({ tags: ['002', '003'], missing: ['099'] });
  });
});
