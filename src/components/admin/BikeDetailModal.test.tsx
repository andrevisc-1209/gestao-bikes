import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BikeDetailModal from './BikeDetailModal';
import type { Bike } from '../../types/database';

const rpcMock = vi.fn();
type HistorySingleResult = {
  data: { edited_at: string; reason: string; notes: string } | null;
  error: { message: string } | null;
};
const historySingleMock = vi.fn(
  (): Promise<HistorySingleResult> => Promise.resolve({ data: null, error: { message: 'no rows' } }),
);
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                single: () => historySingleMock(),
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

const bike: Bike = {
  id: 'bike-1', tag_number: '005', unit_block: 'Bloco A • Apto 504',
  owner_name: 'Mariana Costa', owner_whatsapp: '21999990000',
  brand_model: 'Caloi E-Vibe City', color: 'Preta', photo_url: null,
  status: 'active', created_at: '2026-01-01T00:00:00Z',
};

describe('BikeDetailModal', () => {
  it('shows every field read-only by default', () => {
    render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText('Bloco A • Apto 504')).toBeInTheDocument();
    expect(screen.getByText('21999990000')).toBeInTheDocument();
    expect(screen.getByText('Caloi E-Vibe City')).toBeInTheDocument();
  });

  it('splits unit_block into Bloco and Apartamento when editing', () => {
    render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByLabelText(/^bloco/i)).toHaveValue('Bloco A');
    expect(screen.getByLabelText(/apartamento/i)).toHaveValue('504');
  });

  it('falls back to putting the whole string in Apartamento when unit_block is malformed', () => {
    render(<BikeDetailModal bike={{ ...bike, unit_block: 'unidade sem formato' }} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByLabelText(/apartamento/i)).toHaveValue('unidade sem formato');
  });

  it('pre-selects Outra cor with the original text when color does not match any option', () => {
    render(<BikeDetailModal bike={{ ...bike, color: 'Roxo Metálico' }} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByLabelText(/^cor/i)).toHaveValue('Outra cor');
    expect(screen.getByLabelText(/especifique a cor/i)).toHaveValue('Roxo Metálico');
  });

  it('keeps Marca/Modelo as a single free-text field pre-filled with the stored value', () => {
    render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByLabelText(/marca\s*\/\s*modelo/i)).toHaveValue('Caloi E-Vibe City');
  });

  it('saves via update_bike_registration and calls onSaved with the updated bike', async () => {
    rpcMock.mockResolvedValue({ error: null });
    const onSaved = vi.fn();
    render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/marca\s*\/\s*modelo/i), { target: { value: 'Caloi E-Vibe City v2' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('update_bike_registration', {
        p_bike_id: 'bike-1',
        p_unit_block: 'Bloco A • Apto 504',
        p_owner_name: 'Mariana Costa',
        p_owner_whatsapp: '21999990000',
        p_brand_model: 'Caloi E-Vibe City v2',
        p_color: 'Preta',
      });
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ brand_model: 'Caloi E-Vibe City v2' }));
    });
  });

  it('shows the RPC error and does not call onSaved when the update fails', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'bike not found' } });
    const onSaved = vi.fn();
    render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => {
      expect(screen.getByText('bike not found')).toBeInTheDocument();
    });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('shows the generic fallback message when the RPC error has no message', async () => {
    rpcMock.mockResolvedValue({ error: {} });
    const onSaved = vi.fn();
    render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => {
      expect(screen.getByText(/não foi possível salvar/i)).toBeInTheDocument();
    });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('blocks saving and shows a validation error when a required field is left empty', async () => {
    rpcMock.mockResolvedValue({ error: null });
    const callsBefore = rpcMock.mock.calls.length;
    const onSaved = vi.fn();
    render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/marca\s*\/\s*modelo/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => {
      expect(screen.getByText('Preencha todos os campos antes de salvar.')).toBeInTheDocument();
    });
    expect(rpcMock.mock.calls.length).toBe(callsBefore);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('trims whitespace-padded fields before calling the RPC', async () => {
    rpcMock.mockResolvedValue({ error: null });
    const onSaved = vi.fn();
    render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/marca\s*\/\s*modelo/i), { target: { value: '  Caloi E-Vibe City v2  ' } });
    fireEvent.change(screen.getByLabelText(/nome do morador/i), { target: { value: '  Mariana Costa  ' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('update_bike_registration', {
        p_bike_id: 'bike-1',
        p_unit_block: 'Bloco A • Apto 504',
        p_owner_name: 'Mariana Costa',
        p_owner_whatsapp: '21999990000',
        p_brand_model: 'Caloi E-Vibe City v2',
        p_color: 'Preta',
      });
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ brand_model: 'Caloi E-Vibe City v2', owner_name: 'Mariana Costa' }));
  });

  it('discards edits and returns to read-only on Cancelar', () => {
    render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/marca\s*\/\s*modelo/i), { target: { value: 'rascunho' } });
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.getByText('Caloi E-Vibe City')).toBeInTheDocument();
  });

  it('always shows the registration date', () => {
    const bikeActive = { ...bike, status: 'active' as const };
    render(<BikeDetailModal bike={bikeActive} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument();
  });

  it('does not show a deactivation section for an active bike', () => {
    const bikeActive = { ...bike, status: 'active' as const };
    render(<BikeDetailModal bike={bikeActive} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByText(/baixa em/i)).not.toBeInTheDocument();
  });

  it('shows the deactivation date, reason and notes for an inactive bike with a matching history row', async () => {
    const bikeInactive = { ...bike, status: 'inactive' as const };
    historySingleMock.mockResolvedValueOnce({
      data: { edited_at: '2026-01-15T10:00:00Z', reason: 'Roubo/Furto', notes: 'BO anexado' },
      error: null,
    });
    render(<BikeDetailModal bike={bikeInactive} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/baixa em/i)).toBeInTheDocument();
      expect(screen.getByText('Roubo/Furto')).toBeInTheDocument();
      expect(screen.getByText('BO anexado')).toBeInTheDocument();
    });
  });

  it('shows no deactivation section for an inactive bike with no matching history row, without crashing', async () => {
    const bikeInactive = { ...bike, status: 'inactive' as const };
    historySingleMock.mockResolvedValueOnce({ data: null, error: { message: 'no rows' } });
    render(<BikeDetailModal bike={bikeInactive} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument());
    expect(screen.queryByText(/baixa em/i)).not.toBeInTheDocument();
  });
});
