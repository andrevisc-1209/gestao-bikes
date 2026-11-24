import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OccurrencesTab from './OccurrencesTab';

const mockState = vi.hoisted(() => ({ override: null as unknown[] | null }));

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
              data: mockState.override ?? [
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
                {
                  id: '2',
                  bike_id: '2',
                  reason: 'Roda torta',
                  notes: null,
                  photo_url: 'https://example.com/foto.jpg',
                  status: 'open',
                  created_at: '2026-11-02T10:00:00Z',
                  resolved_at: null,
                  bikes: {
                    tag_number: '015',
                    unit_block: 'Bloco B',
                    owner_name: 'Carlos Lima',
                    owner_whatsapp: '21988880000',
                  },
                },
              ],
              error: null,
            }),
        }),
      };
    },
  },
}));

vi.mock('./ResolveIncidentModal', () => ({
  default: ({ onResolved }: { incident: { id: string }; onResolved: () => void }) => (
    <div>
      <p>Resolve Incident Mock</p>
      <button type="button" onClick={onResolved}>
        Confirmar Mock
      </button>
    </div>
  ),
}));

describe('OccurrencesTab', () => {
  it('opens ResolveIncidentModal instead of window.confirm when "Marcar Resolvida" is clicked, and refreshes on success', async () => {
    render(<OccurrencesTab onResolved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Mariana Costa')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /marcar resolvida/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /confirmar mock/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /confirmar mock/i })).not.toBeInTheDocument();
    });
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
    fireEvent.click(screen.getAllByRole('button', { name: /ver cadastro completo/i })[0]);
    await waitFor(() => {
      expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument();
    });
  });

  it('shows a clickable photo thumbnail instead of just a "Foto anexada" badge when an incident has a photo', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<OccurrencesTab />);
    const img = await screen.findByRole('img', { name: /foto da ocorrência/i });
    expect(img).toHaveAttribute('src', 'https://example.com/foto.jpg');
    expect(screen.queryByText(/foto anexada/i)).not.toBeInTheDocument();
    fireEvent.click(img);
    expect(openSpy).toHaveBeenCalledWith('https://example.com/foto.jpg', '_blank', 'noopener,noreferrer');
    // the click must not bubble to the card and open the detail modal
    expect(screen.queryByText(/reportado em/i)).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it('opens the detail modal when the card body is clicked', async () => {
    render(<OccurrencesTab />);
    await waitFor(() => expect(screen.getByText('Pneu furado')).toBeInTheDocument());
    expect(screen.queryByText(/reportado em/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Pneu furado'));
    expect(await screen.findByText(/reportado em/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(screen.queryByText(/reportado em/i)).not.toBeInTheDocument();
  });

  it('does not open the detail modal when "Marcar Resolvida" or "Ver cadastro completo" is clicked', async () => {
    render(<OccurrencesTab />);
    await waitFor(() => expect(screen.getByText('Pneu furado')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /ver cadastro completo/i })[0]);
    await waitFor(() => expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument());
    expect(screen.queryByText(/reportado em/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /marcar resolvida/i })[0]);
    expect(screen.getByText('Resolve Incident Mock')).toBeInTheDocument();
    expect(screen.queryByText(/reportado em/i)).not.toBeInTheDocument();
  });

  it('opens the detail modal with resolution info from the resolved list', async () => {
    mockState.override = [
      {
        id: '5', bike_id: '5', reason: 'Roda solta', notes: null, photo_url: null,
        status: 'resolved', created_at: '2026-11-02T10:00:00Z', resolved_at: '2026-11-03T10:00:00Z',
        resolution: 'Reparo feito', resolution_notes: null,
        bikes: { tag_number: '050', unit_block: 'Bloco D', owner_name: 'Y', owner_whatsapp: '2' },
      },
    ];
    try {
      render(<OccurrencesTab />);
      await waitFor(() => expect(screen.getByText('Roda solta')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Roda solta'));
      expect(await screen.findByText(/resolvida em/i)).toBeInTheDocument();
      expect(screen.getByText('Reparo feito')).toBeInTheDocument();
    } finally {
      mockState.override = null;
    }
  });

  it('shows no photo element at all for an incident with no photo_url', async () => {
    render(<OccurrencesTab />);
    await waitFor(() => expect(screen.getByText('Mariana Costa')).toBeInTheDocument());
    // only the one incident that has a photo renders a thumbnail
    expect(screen.getAllByRole('img', { name: /foto da ocorrência/i })).toHaveLength(1);
  });

  it('renders no img and never exposes a javascript: photo_url', async () => {
    mockState.override = [
      {
        id: '9', bike_id: '9', reason: 'Malicioso', notes: null,
        photo_url: 'javascript:alert(1)', status: 'open',
        created_at: '2026-11-02T10:00:00Z', resolved_at: null,
        bikes: { tag_number: '099', unit_block: 'Bloco C', owner_name: 'X', owner_whatsapp: '1' },
      },
    ];
    try {
      render(<OccurrencesTab />);
      await waitFor(() => expect(screen.getByText('Malicioso')).toBeInTheDocument());
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    } finally {
      mockState.override = null;
    }
  });
});
