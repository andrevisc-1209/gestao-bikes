/**
 * Builds the structured data for the WhatsApp message preview shown to the
 * reporter after a public incident report. The actual send is out of scope
 * here (see PublicBikePage) — this only prepares the values for rendering.
 *
 * This deliberately returns plain data rather than an HTML string: the
 * owner's first name, the bike's tag/model, and the reporter's free-text
 * reason/note can all contain attacker-controlled content (the bike is
 * registered by an anonymous resident, and the incident is reported by an
 * anonymous passerby), so they must never be interpolated into HTML and
 * injected with `dangerouslySetInnerHTML`. The caller renders these values
 * as normal JSX children, which React escapes automatically.
 */
export interface WhatsappPreviewData {
  ownerFirstName: string;
  tag: string;
  model: string;
  reason: string;
  note?: string;
}

export function buildWhatsappPreview(
  ownerFirstName: string,
  tag: string,
  model: string,
  reason: string,
  note?: string
): WhatsappPreviewData {
  return {
    ownerFirstName,
    tag,
    model,
    reason,
    note: note || undefined,
  };
}
