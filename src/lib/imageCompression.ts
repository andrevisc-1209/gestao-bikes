import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

const BUCKET = 'bike-photos';
const USER_ERROR = 'Não foi possível enviar a foto. Tente novamente.';

export type CompressAndUploadResult = { url: string } | { error: string };

/**
 * Compresses a photo client-side and uploads it to the `bike-photos` bucket.
 * Never throws: callers keep their form state and show `error` inline.
 */
export async function compressAndUpload(
  file: File,
  pathPrefix: string
): Promise<CompressAndUploadResult> {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
    });

    const path = `${pathPrefix}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, compressed, { contentType: 'image/jpeg' });
    if (error) {
      return { error: USER_ERROR };
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl };
  } catch {
    return { error: USER_ERROR };
  }
}
