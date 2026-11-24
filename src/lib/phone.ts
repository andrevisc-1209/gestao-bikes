/**
 * Formats a digit-only Brazilian phone number for display, progressively
 * applying `(XX) XXXXX-XXXX` punctuation as digits are supplied.
 *
 * This is a display-only helper: it never changes how the phone number is
 * stored (digits only). Strips any non-digit characters first, so pasting an
 * already-punctuated number re-formats correctly instead of producing a
 * mangled result.
 */
export function formatBrazilPhone(digits: string): string {
  const cleaned = digits.replace(/\D/g, '').slice(0, 11);

  if (cleaned.length === 0) {
    return '';
  }

  if (cleaned.length <= 2) {
    return `(${cleaned}`;
  }

  const areaCode = cleaned.slice(0, 2);
  const rest = cleaned.slice(2);

  if (rest.length <= 5) {
    return `(${areaCode}) ${rest}`;
  }

  return `(${areaCode}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

/**
 * Formats a stored phone for read-only display. Only 10/11-digit values are
 * formatted; anything else (legacy or odd data) is shown as stored, trimmed,
 * so it is never truncated.
 */
export function formatPhoneForDisplay(stored: string | null | undefined): string {
  if (!stored) return '';
  const digits = stored.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    return formatBrazilPhone(digits);
  }
  return stored.trim();
}
