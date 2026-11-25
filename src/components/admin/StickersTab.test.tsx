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
  it('generates whole A4 sheets (12 stickers each) and refetches', async () => {
    rpcMock.mockResolvedValueOnce({ data: 24, error: null });
    render(<StickersTab />);
    await waitFor(() => expect(selectMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/folhas a4/i), { target: { value: '2' } });
    expect(screen.getByText(/= 24 adesivos \(12 por folha\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /gerar lote/i }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('generate_sticker_batch', { p_count: 24 }));
    await waitFor(() => expect(selectMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.getByText(/24 adesivos gerados com sucesso \(2 folhas A4\)\./i)
      ).toBeInTheDocument()
    );
  });

  it('defaults to one sheet of 12 stickers', async () => {
    rpcMock.mockClear();
    render(<StickersTab />);
    await waitFor(() => expect(selectMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /gerar lote/i }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('generate_sticker_batch', { p_count: 12 }));
  });

  it('disables generation for a non-whole or zero sheet count', async () => {
    render(<StickersTab />);
    await waitFor(() => expect(selectMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/folhas a4/i), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: /gerar lote/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/folhas a4/i), { target: { value: '1.5' } });
    expect(screen.getByRole('button', { name: /gerar lote/i })).toBeDisabled();
  });

  it('warns when fewer stickers were created than requested due to conflicts', async () => {
    rpcMock.mockResolvedValueOnce({ data: 3, error: null });
    render(<StickersTab />);
    await waitFor(() => expect(selectMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /gerar lote/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/3 de 12 adesivos gerados \(alguns números já existiam e foram ignorados\)\./i)
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

  it('splits available stickers into A4 sheets of 12', async () => {
    const data = Array.from({ length: 13 }, (_, i) => ({
      tag_number: String(i + 1).padStart(3, '0'),
      status: 'available',
      bike_id: null,
      created_at: '2026-01-01',
    }));
    selectMock.mockResolvedValueOnce({ data, error: null });

    const { container } = render(<StickersTab />);

    await waitFor(() => expect(screen.getByText('BIKE #013')).toBeInTheDocument());
    const sheets = container.querySelectorAll('.sticker-sheet');
    expect(sheets).toHaveLength(2);
    expect(sheets[0].querySelectorAll('.sticker-print-card')).toHaveLength(12);
    expect(sheets[1].querySelectorAll('.sticker-print-card')).toHaveLength(1);
    expect(screen.getByText(/2 folhas A4/i)).toBeInTheDocument();
  });
});
