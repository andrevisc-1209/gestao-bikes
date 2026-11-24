const BIKE_TAG_PATH_PATTERN = /^\/b\/\d+$/;

/**
 * Parses a decoded QR scan result and extracts the bike-tag path (e.g. "/b/007")
 * from its hash fragment, if present.
 *
 * The stickers printed by FleetTab/StickersTab encode the full page URL,
 * e.g. `${window.location.origin}${window.location.pathname}#/b/007`, so a
 * successful camera scan returns that whole URL as `decodedText`. This
 * function extracts just the `/b/:tag` path, or returns `null` when the
 * scanned text doesn't match that shape (unrelated URL, garbled input, etc).
 *
 * Never throws, regardless of input.
 */
export function extractBikeTagPath(decodedText: string): string | null {
  try {
    if (typeof decodedText !== 'string' || decodedText.length === 0) {
      return null;
    }

    const hashIndex = decodedText.indexOf('#');
    if (hashIndex === -1) {
      return null;
    }

    const afterHash = decodedText.slice(hashIndex + 1);
    return BIKE_TAG_PATH_PATTERN.test(afterHash) ? afterHash : null;
  } catch {
    return null;
  }
}
