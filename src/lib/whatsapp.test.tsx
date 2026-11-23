import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildWhatsappPreview } from './whatsapp';

describe('buildWhatsappPreview', () => {
  it('returns structured data without a note when note is omitted', () => {
    const data = buildWhatsappPreview('Carlos', '014', 'Caloi E-Vibe Urbis', 'Pneu murcho');
    expect(data.ownerFirstName).toBe('Carlos');
    expect(data.tag).toBe('014');
    expect(data.model).toBe('Caloi E-Vibe Urbis');
    expect(data.reason).toBe('Pneu murcho');
    expect(data.note).toBeUndefined();
  });

  it('includes the note when one is given', () => {
    const data = buildWhatsappPreview(
      'Carlos',
      '014',
      'Caloi E-Vibe Urbis',
      'Pneu murcho',
      'Perto da saída'
    );
    expect(data.note).toBe('Perto da saída');
  });

  it('does not HTML-escape or sanitize the raw data itself (that is the renderer\'s job)', () => {
    // buildWhatsappPreview just packages the values; it must not be the only
    // place guarding against injection. Rendering (tested below / in
    // PublicBikePage) is what has to escape this safely.
    const data = buildWhatsappPreview(
      '<img src=x onerror=alert(1)>',
      '014',
      'Caloi',
      'Pneu murcho',
      '<script>alert(1)</script>'
    );
    expect(data.ownerFirstName).toBe('<img src=x onerror=alert(1)>');
    expect(data.note).toBe('<script>alert(1)</script>');
  });
});

describe('whatsapp preview rendering (XSS safety)', () => {
  it('renders malicious owner/model/note values as literal text, never as executable HTML', () => {
    const data = buildWhatsappPreview(
      '<img src=x onerror="window.__xss=true">',
      '014',
      '<script>window.__xss2=true</script>',
      'Pneu murcho',
      '<img src=x onerror="window.__xss3=true">'
    );

    // Mirrors the JSX structure PublicBikePage renders for the confirmation
    // panel: all dynamic values passed as plain JSX children, which React
    // escapes automatically instead of being interpolated into an HTML
    // string and injected via dangerouslySetInnerHTML.
    render(
      <div>
        <p>
          Olá, <strong>{data.ownerFirstName}</strong>! Sua bicicleta elétrica{' '}
          <strong>{data.tag}</strong> ({data.model}) recebeu uma notificação colaborativa no
          bicicletário:
        </p>
        <p>
          <strong>Motivo:</strong> {data.reason}
        </p>
        {data.note && (
          <p>
            <strong>Obs.:</strong> &quot;{data.note}&quot;
          </p>
        )}
      </div>
    );

    // The malicious strings show up as literal visible text...
    expect(screen.getAllByText(/img src=x onerror/).length).toBeGreaterThan(0);
    expect(screen.getByText(/script.*window\.__xss2/)).toBeInTheDocument();

    // ...and never execute: no <img>/<script> element was actually created,
    // and none of the onerror/script payloads ran.
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect((window as unknown as Record<string, unknown>).__xss).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__xss2).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__xss3).toBeUndefined();
  });
});
