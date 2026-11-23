import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressAndUpload } from './imageCompression';
import { supabase } from './supabase';

// jsdom cannot decode images, so the real compressor never resolves here.
vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}));

const upload = vi.fn();
const getPublicUrl = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({ upload, getPublicUrl })),
    },
  },
}));

const file = new File([new Uint8Array([1, 2, 3])], 'bike.jpg', { type: 'image/jpeg' });

describe('compressAndUpload', () => {
  beforeEach(() => {
    upload.mockReset();
    getPublicUrl.mockReset();
  });

  it('returns a user-safe error instead of throwing when upload fails', async () => {
    upload.mockRejectedValue(new Error('network'));

    const result = await compressAndUpload(file, 'incidents');

    expect('error' in result).toBe(true);
  });

  it('returns a user-safe error when storage reports an error object', async () => {
    upload.mockResolvedValue({ data: null, error: { message: 'denied' } });

    const result = await compressAndUpload(file, 'incidents');

    expect(result).toEqual({ error: expect.any(String) });
  });

  it('uploads under the prefix as a jpg and returns the public URL', async () => {
    upload.mockResolvedValue({ data: { path: 'x' }, error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example/p.jpg' } });

    const result = await compressAndUpload(file, 'incidents');

    expect(supabase.storage.from).toHaveBeenCalledWith('bike-photos');
    const path = upload.mock.calls[0][0] as string;
    expect(path).toMatch(/^incidents\/[0-9a-f-]{36}\.jpg$/);
    expect(getPublicUrl).toHaveBeenCalledWith(path);
    expect(result).toEqual({ url: 'https://cdn.example/p.jpg' });
  });
});
