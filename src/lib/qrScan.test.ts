import { describe, it, expect } from 'vitest';
import { extractBikeTagPath } from './qrScan';

describe('extractBikeTagPath', () => {
  it('extracts the /b/:tag path from a full sticker URL', () => {
    expect(extractBikeTagPath('https://andrevisc-1209.github.io/gestao-bikes/#/b/007')).toBe('/b/007');
  });

  it('returns null for a URL with no matching hash path', () => {
    expect(extractBikeTagPath('https://example.com/#/admin')).toBeNull();
  });

  it('returns null for an unrelated or garbled scan result', () => {
    expect(extractBikeTagPath('not a url at all')).toBeNull();
    expect(extractBikeTagPath('')).toBeNull();
  });
});
