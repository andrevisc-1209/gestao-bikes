// Builds the wa.me link the admin uses to tell a resident why their
// registration was rejected. Returns null when there is no usable phone.
export function rejectionWhatsappUrl(
  bike: { owner_name: string | null; owner_whatsapp: string | null; brand_model: string; unit_block: string },
  reason: string,
  notes = '',
): string | null {
  const digits = (bike.owner_whatsapp ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const phone = digits.length <= 11 ? `55${digits}` : digits;
  const firstName = (bike.owner_name ?? '').trim().split(/\s+/)[0];
  const greeting = firstName ? `Olá, ${firstName}!` : 'Olá!';
  const detail = notes.trim() ? ` (${notes.trim()})` : '';
  const text =
    `${greeting} Seu cadastro da bike ${bike.brand_model} (${bike.unit_block}) não foi aprovado. ` +
    `Motivo: ${reason}${detail}. Por favor, faça um novo cadastro com as informações corretas.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
