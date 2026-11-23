/**
 * Builds the HTML preview of the WhatsApp message that would be sent to the
 * bike owner after a public incident report. The actual send is out of
 * scope here (see PublicBikePage) — this only renders the confirmation
 * preview shown to the reporter.
 */
export function buildWhatsappPreview(
  ownerFirstName: string,
  tag: string,
  model: string,
  reason: string,
  note?: string
): string {
  let message = `Olá, <strong>${ownerFirstName}</strong>! Sua bicicleta elétrica <strong>${tag}</strong> (${model}) recebeu uma notificação colaborativa no bicicletário:<br><br>📌 <strong>Motivo:</strong> ${reason}`;

  if (note) {
    message += `<br>💬 <strong>Obs.:</strong> "${note}"`;
  }

  message += `<br><br>Por favor, verifique assim que possível. Obrigado pela colaboração!`;

  return message;
}
