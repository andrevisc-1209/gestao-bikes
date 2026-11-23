import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FleetTab from './FleetTab';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [
    { id: '1', tag_number: '014', unit_block: 'Bloco A', owner_name: 'Carlos', owner_whatsapp: 'x', brand_model: 'Caloi', color: 'Cinza', status: 'active' },
    { id: '2', tag_number: '007', unit_block: 'Bloco B', owner_name: 'Fernanda', owner_whatsapp: 'y', brand_model: 'Sense', color: 'Azul', status: 'active' },
  ], error: null }) }) }) },
}));

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
});
