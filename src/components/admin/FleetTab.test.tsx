import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FleetTab from './FleetTab';

const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));

let fleetListData: Array<Record<string, unknown>> = [
  { id: '1', tag_number: '014', unit_block: 'Bloco A', owner_name: 'Carlos', owner_whatsapp: 'x', brand_model: 'Caloi', color: 'Cinza', status: 'active' },
  { id: '2', tag_number: '007', unit_block: 'Bloco B', owner_name: 'Fernanda', owner_whatsapp: 'y', brand_model: 'Sense', color: 'Azul', status: 'active' },
];

const fullBikeFixture = {
  id: '1',
  tag_number: '014',
  unit_block: 'Bloco A',
  owner_name: 'Carlos',
  owner_whatsapp: '21999990000',
  brand_model: 'Caloi',
  color: 'Cinza',
  photo_url: null,
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
};

vi.mock('./BikeDetailModal', () => ({
  default: ({ bike, onSaved }: { bike: { owner_whatsapp: string }; onSaved: (updated: unknown) => void }) => (
    <div>
      <p>{bike.owner_whatsapp}</p>
      <button type="button" onClick={() => onSaved({ ...bike, brand_model: 'Updated Brand' })}>
        Salvar Mock
      </button>
    </div>
  ),
}));

vi.mock('./DeactivateBikeModal', () => ({
  default: ({
    bike,
    onDeactivated,
  }: {
    bike: { tag_number: string | null };
    onDeactivated: () => void;
  }) => (
    <div>
      <h2>Dar baixa na bike #{bike.tag_number}</h2>
      <button type="button" onClick={onDeactivated}>
        Confirmar
      </button>
    </div>
  ),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: fleetListData, error: null }),
        eq: () => ({ single: () => Promise.resolve({ data: fullBikeFixture, error: null }) }),
      }),
      update: updateMock,
    }),
  },
}));

afterEach(() => {
  updateMock.mockClear();
  vi.restoreAllMocks();
  fleetListData = [
    { id: '1', tag_number: '014', unit_block: 'Bloco A', owner_name: 'Carlos', owner_whatsapp: 'x', brand_model: 'Caloi', color: 'Cinza', status: 'active' },
    { id: '2', tag_number: '007', unit_block: 'Bloco B', owner_name: 'Fernanda', owner_whatsapp: 'y', brand_model: 'Sense', color: 'Azul', status: 'active' },
  ];
});

describe('FleetTab', () => {
  it('filters the table by search text', async () => {
    render(<FleetTab />);
    await waitFor(() => expect(screen.getAllByText(/Caloi/).length).toBeGreaterThan(0));
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: '007' } });
    expect(screen.queryAllByText(/Caloi/)).toHaveLength(0);
    expect(screen.getAllByText(/Sense/).length).toBeGreaterThan(0);
  });

  it('renders bike data in both the mobile card list and the desktop table', async () => {
    render(<FleetTab />);
    await waitFor(() => expect(screen.getAllByText(/Caloi/).length).toBeGreaterThan(0));
    // Two renders of the same data (one per breakpoint) — use getAllByText, not getByText.
    expect(screen.getAllByText('Bloco A').length).toBeGreaterThanOrEqual(1);
  });

  it('opens DeactivateBikeModal instead of window.confirm when "Dar Baixa" is clicked, and refreshes the list on success', async () => {
    render(<FleetTab />);
    await waitFor(() => expect(screen.getAllByText(/Caloi/).length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: /dar baixa/i })[0]);
    expect(screen.getByText(/dar baixa na bike #014/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => {
      expect(screen.queryByText(/dar baixa na bike #014/i)).not.toBeInTheDocument();
    });
  });

  it('shows the QR code for an active bike when "Ver QR" is clicked', async () => {
    render(<FleetTab />);
    await waitFor(() => expect(screen.getAllByText(/Caloi/).length).toBeGreaterThan(0));

    expect(screen.queryByText('Adesivo da Bike')).not.toBeInTheDocument();

    const [viewQrButton] = screen.getAllByText('Ver QR');
    fireEvent.click(viewQrButton);

    expect(screen.getByText('Adesivo da Bike')).toBeInTheDocument();
    expect(screen.getByText('BIKE 014')).toBeInTheDocument();

    const modal = screen.getByText('Adesivo da Bike').closest('div')?.parentElement;
    const qrSvg = modal?.querySelector('svg[width="180"]');
    expect(qrSvg).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(screen.queryByText('Adesivo da Bike')).not.toBeInTheDocument();
  });

  it('opens BikeDetailModal with the full bike row when "Ver cadastro completo" is clicked', async () => {
    render(<FleetTab />);
    await waitFor(() => expect(screen.getAllByText(/Caloi/).length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: /ver cadastro completo/i })[0]);

    await waitFor(() => {
      expect(screen.getByText('21999990000')).toBeInTheDocument();
    });
  });

  it('refreshes the fleet list after a save in the modal', async () => {
    render(<FleetTab />);
    await waitFor(() => expect(screen.getAllByText(/Caloi/).length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: /ver cadastro completo/i })[0]);
    await waitFor(() => {
      expect(screen.getByText('21999990000')).toBeInTheDocument();
    });

    fleetListData = [{ ...fleetListData[0], brand_model: 'Updated Brand' }, fleetListData[1]];

    fireEvent.click(screen.getByText('Salvar Mock'));

    await waitFor(() => {
      expect(screen.getAllByText('Updated Brand').length).toBeGreaterThan(0);
    });
  });
});
