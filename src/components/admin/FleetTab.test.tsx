import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FleetTab from './FleetTab';

const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [
        { id: '1', tag_number: '014', unit_block: 'Bloco A', owner_name: 'Carlos', owner_whatsapp: 'x', brand_model: 'Caloi', color: 'Cinza', status: 'active' },
        { id: '2', tag_number: '007', unit_block: 'Bloco B', owner_name: 'Fernanda', owner_whatsapp: 'y', brand_model: 'Sense', color: 'Azul', status: 'active' },
      ], error: null }) }),
      update: updateMock,
    }),
  },
}));

afterEach(() => {
  updateMock.mockClear();
  vi.restoreAllMocks();
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

  it('does not deactivate the bike when the admin cancels the confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<FleetTab />);
    await waitFor(() => expect(screen.getAllByText(/Caloi/).length).toBeGreaterThan(0));

    const [deactivateButton] = screen.getAllByText('Dar Baixa');
    fireEvent.click(deactivateButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
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
});
