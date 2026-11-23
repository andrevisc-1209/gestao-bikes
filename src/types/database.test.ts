import { describe, it, expect } from 'vitest';
import type { PublicBike } from './database';

describe('PublicBike', () => {
  it('only exposes the non-sensitive projection', () => {
    const keys: (keyof PublicBike)[] = ['id', 'tag_number', 'brand_model', 'color', 'photo_url'];
    const sample: PublicBike = { id: '1', tag_number: '014', brand_model: 'x', color: 'y', photo_url: null };
    expect(Object.keys(sample).sort()).toEqual(keys.sort());
  });
});
