import { describe, it, expect } from 'vitest';
import { buildWhatsappPreview } from './whatsapp';

describe('buildWhatsappPreview', () => {
  it('includes tag, model and reason without the note block when note is omitted', () => {
    const msg = buildWhatsappPreview('Carlos', '014', 'Caloi E-Vibe Urbis', 'Pneu murcho');
    expect(msg).toContain('Carlos');
    expect(msg).toContain('014');
    expect(msg).toContain('Pneu murcho');
    expect(msg).not.toContain('Obs.:');
  });
  it('includes the note block when a note is given', () => {
    const msg = buildWhatsappPreview('Carlos', '014', 'Caloi E-Vibe Urbis', 'Pneu murcho', 'Perto da saída');
    expect(msg).toContain('Obs.:');
    expect(msg).toContain('Perto da saída');
  });
});
