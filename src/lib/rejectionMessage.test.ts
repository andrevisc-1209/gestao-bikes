import { describe, it, expect } from 'vitest';
import { rejectionWhatsappUrl } from './rejectionMessage';

const bike = { owner_name: 'André Souza', owner_whatsapp: '(21) 99999-0000', brand_model: 'Onn N1 Lite', unit_block: 'Bloco A • Apto 502' };

describe('rejectionWhatsappUrl', () => {
  it('adds the country code and greets by first name', () => {
    const url = rejectionWhatsappUrl(bike, 'Foto ilegível ou sem a bike');
    expect(url).toMatch(/^https:\/\/wa\.me\/5521999990000\?text=/);
    const text = decodeURIComponent(url!.split('text=')[1]);
    expect(text).toBe(
      'Olá, André! Seu cadastro da bike Onn N1 Lite (Bloco A • Apto 502) não foi aprovado. ' +
        'Motivo: Foto ilegível ou sem a bike. Por favor, faça um novo cadastro com as informações corretas.',
    );
  });

  it('keeps a number that already has the country code', () => {
    expect(rejectionWhatsappUrl({ ...bike, owner_whatsapp: '5521999990000' }, 'Outro')).toMatch(/wa\.me\/5521999990000\?/);
  });

  it('returns null without a usable phone', () => {
    expect(rejectionWhatsappUrl({ ...bike, owner_whatsapp: null }, 'Outro')).toBeNull();
    expect(rejectionWhatsappUrl({ ...bike, owner_whatsapp: '1234' }, 'Outro')).toBeNull();
  });
});
