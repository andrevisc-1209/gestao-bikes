import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OccurrencesTab from './OccurrencesTab';

const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));

const fullBikeFixture = {
  id: '1',
  tag_number: '014',
  unit_block: 'Bloco A • Apto 101',
  owner_name: 'Mariana Costa',
  owner_whatsapp: '21999990000',
  brand_model: 'Caloi 10',
  color: 'Azul',
  photo_url: null,
  status: 'active',
  created_at: '2026-10-01T10:00:00Z',
};

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'bikes') {
        return {
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: fullBikeFixture, error: null }) }),
          }),
        };
      }

      return {
        select: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: '1',
                  bike_id: '1',
                  reason: 'Pneu furado',
                  notes: null,
                  photo_url: null,
                  status: 'open',
                  created_at: '2026-11-01T10:00:00Z',
                  resolved_at: null,
                  bikes: {
                    tag_number: '014',
                    unit_block: 'Bloco A',
                    owner_name: 'Mariana Costa',
                    owner_whatsapp: '21999990000',
                  },
                },
              ],
              error: null,
            }),
        }),
        update: updateMock,
      };
    },
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

  it('shows the owner name and WhatsApp inline on an open incident', async () => {
    render(<OccurrencesTab />);
    await waitFor(() => {
      expect(screen.getByText('Mariana Costa')).toBeInTheDocument();
      expect(screen.getByText('21999990000')).toBeInTheDocument();
    });
  });

  it('opens BikeDetailModal with the full bike when "Ver cadastro completo" is clicked', async () => {
    render(<OccurrencesTab />);
    await waitFor(() => expect(screen.getByText('Mariana Costa')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /ver cadastro completo/i }));
    await waitFor(() => {
      expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument();
    });
  });
});
