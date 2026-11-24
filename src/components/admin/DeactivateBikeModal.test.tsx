import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeactivateBikeModal from './DeactivateBikeModal';

const rpcMock = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpcMock(...args) } }));

const bike = { id: 'bike-1', tag_number: '005' };

afterEach(() => {
  rpcMock.mockClear();
});

describe('DeactivateBikeModal', () => {
  it('defaults to the first reason and calls deactivate_bike with the selected reason and notes', async () => {
    rpcMock.mockResolvedValue({ error: null });
    const onDeactivated = vi.fn();
    render(<DeactivateBikeModal bike={bike} onClose={vi.fn()} onDeactivated={onDeactivated} />);

    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'Roubo/Furto' } });
    fireEvent.change(screen.getByLabelText(/observações/i), { target: { value: 'Boletim de ocorrência anexado' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('deactivate_bike', {
        p_bike_id: 'bike-1',
        p_reason: 'Roubo/Furto',
        p_notes: 'Boletim de ocorrência anexado',
      });
      expect(onDeactivated).toHaveBeenCalled();
    });
  });

  it('shows the RPC error and does not call onDeactivated when the deactivation fails', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'bike not found or already inactive' } });
    const onDeactivated = vi.fn();
    render(<DeactivateBikeModal bike={bike} onClose={vi.fn()} onDeactivated={onDeactivated} />);

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(screen.getByText('bike not found or already inactive')).toBeInTheDocument();
    });
    expect(onDeactivated).not.toHaveBeenCalled();
  });

  it('calls onClose without calling the RPC when Cancelar is clicked', () => {
    const onClose = vi.fn();
    render(<DeactivateBikeModal bike={bike} onClose={onClose} onDeactivated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onClose).toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
