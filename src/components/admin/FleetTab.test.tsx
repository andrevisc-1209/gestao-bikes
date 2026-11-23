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
    await waitFor(() => screen.getByText(/Caloi/));
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: '007' } });
    expect(screen.queryByText(/Caloi/)).not.toBeInTheDocument();
    expect(screen.getByText(/Sense/)).toBeInTheDocument();
  });
});
