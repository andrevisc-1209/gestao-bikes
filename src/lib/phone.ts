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

  if (rest.length < 9) {
    return `(${areaCode}) ${rest.slice(0, 5)}`;
  }

  const firstPart = rest.slice(0, 5);
  const lastPart = rest.slice(5, 9);
  return `(${areaCode}) ${firstPart}-${lastPart}`;
}
