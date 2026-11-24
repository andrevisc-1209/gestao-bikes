import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StickersTab from './StickersTab';

const rpcMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: 5, error: null }));
const selectMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: [], error: null })
);

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ order: selectMock }) }),
    rpc: rpcMock,
  },
}));

describe('StickersTab', () => {
  it('calls generate_sticker_batch with the entered count and refetches', async () => {
    render(<StickersTab />);
    await waitFor(() => expect(selectMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/quantidade/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /gerar lote/i }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('generate_sticker_batch', { p_count: 5 }));
    await waitFor(() => expect(selectMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByText(/5 adesivos gerados com sucesso\./i)).toBeInTheDocument()
    );
  });

  it('warns when fewer stickers were created than requested due to conflicts', async () => {
    rpcMock.mockResolvedValueOnce({ data: 3, error: null });
    render(<StickersTab />);
    await waitFor(() => expect(selectMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/quantidade/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /gerar lote/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/3 de 5 adesivos gerados \(alguns números já existiam e foram ignorados\)\./i)
      ).toBeInTheDocument()
    );
  });

  it('shows the count of available stickers and a printable card per sticker', async () => {
    selectMock.mockResolvedValueOnce({
      data: [
        { tag_number: '005', status: 'available', bike_id: null, created_at: '2026-01-01' },
        { tag_number: '006', status: 'available', bike_id: null, created_at: '2026-01-01' },
        { tag_number: '007', status: 'assigned', bike_id: 'b1', created_at: '2026-01-01' },
      ],
      error: null,
    });

    render(<StickersTab />);

    await waitFor(() => expect(screen.getByText(/2 adesivos disponíveis/i)).toBeInTheDocument());
    expect(screen.getByText('BIKE #005')).toBeInTheDocument();
    expect(screen.getByText('BIKE #006')).toBeInTheDocument();
    expect(screen.queryByText('BIKE #007')).not.toBeInTheDocument();
  });
});
