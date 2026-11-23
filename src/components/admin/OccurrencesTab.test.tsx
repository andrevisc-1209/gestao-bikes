import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OccurrencesTab from './OccurrencesTab';

const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [
        {
          id: '1',
          bike_id: '1',
          reason: 'Pneu furado',
          notes: null,
          photo_url: null,
          status: 'open',
          created_at: '2026-11-01T10:00:00Z',
          resolved_at: null,
          bikes: { tag_number: '014', unit_block: 'Bloco A' },
        },
      ], error: null }) }),
      update: updateMock,
    }),
  },
}));

afterEach(() => {
  updateMock.mockClear();
  vi.restoreAllMocks();
});

describe('OccurrencesTab', () => {
  it('does not resolve the incident when the admin cancels the confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<OccurrencesTab />);
    await waitFor(() => expect(screen.getByText('Marcar Resolvida')).toBeTruthy());

    fireEvent.click(screen.getByText('Marcar Resolvida'));

    expect(window.confirm).toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
