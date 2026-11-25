import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StickersTab from './StickersTab';

const rpcMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: 5, error: null }));
const selectMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: [], error: null })
);
const bikesMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: [], error: null }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({ order: table === 'stickers' ? selectMock : bikesMock }),
    }),
    rpc: rpcMock,
  },
}));

const sticker = (tag_number: string, status = 'available', bike_id: string | null = null) => ({
  tag_number,
  status,
  bike_id,
  created_at: '2026-01-01',
});

const available = (n: number) =>
  Array.from({ length: n }, (_, i) => sticker(String(i + 1).padStart(3, '0')));

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

  it('prints the reserve by default, not stickers already on bikes', async () => {
    selectMock.mockResolvedValueOnce({
      data: [sticker('005'), sticker('006'), sticker('007', 'assigned', 'b1')],
      error: null,
    });

    render(<StickersTab />);

    await waitFor(() => expect(screen.getByText(/2 adesivos disponíveis na reserva/i)).toBeInTheDocument());
    expect(screen.getByText('BIKE #005')).toBeInTheDocument();
    expect(screen.getByText('BIKE #006')).toBeInTheDocument();
    expect(screen.queryByText('BIKE #007')).not.toBeInTheDocument();
  });

  it('splits the reserve into A4 sheets of 12', async () => {
    selectMock.mockResolvedValueOnce({ data: available(13), error: null });

    const { container } = render(<StickersTab />);

    await waitFor(() => expect(screen.getByText('BIKE #013')).toBeInTheDocument());
    const sheets = container.querySelectorAll('.sticker-sheet');
    expect(sheets).toHaveLength(2);
    expect(sheets[0].querySelectorAll('.sticker-print-card')).toHaveLength(12);
    expect(sheets[1].querySelectorAll('.sticker-print-card')).toHaveLength(1);
    expect(screen.getByText(/13 da reserva · 2 folhas A4/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /imprimir reserva \(13\)/i })).toBeEnabled();
  });

  it('shows each sticker status, including bikes numbered before the pool', async () => {
    selectMock.mockResolvedValueOnce({
      data: [sticker('004', 'assigned', 'b4'), sticker('005')],
      error: null,
    });
    bikesMock.mockResolvedValueOnce({
      data: [
        { id: 'b2', tag_number: '002', owner_name: 'Ana', unit_block: 'Apto 201', brand_model: 'Caloi', status: 'active' },
        { id: 'b4', tag_number: '004', owner_name: 'Rui', unit_block: 'Apto 402', brand_model: 'Sense', status: 'inactive' },
      ],
      error: null,
    });

    render(<StickersTab />);

    await waitFor(() => expect(screen.getByText('#002')).toBeInTheDocument());
    expect(screen.getByText('Apto 201 · Ana · Caloi')).toBeInTheDocument();
    expect(screen.getByText('Reserva: 1')).toBeInTheDocument();
    expect(screen.getByText('Em uso: 1')).toBeInTheDocument();
    expect(screen.getByText('Bike baixada: 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Em uso' }));
    expect(screen.getByText('#002')).toBeInTheDocument();
    expect(screen.queryByText('#004')).not.toBeInTheDocument();
    expect(screen.queryByText('#005')).not.toBeInTheDocument();
  });

  it('reprints stickers typed by number, even ones already on a bike', async () => {
    selectMock.mockResolvedValueOnce({
      data: [sticker('010'), sticker('002', 'assigned', 'b2'), sticker('003', 'assigned', 'b3')],
      error: null,
    });

    const { container } = render(<StickersTab />);
    await waitFor(() => expect(screen.getByText('#002')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/selecionar números/i), { target: { value: '2, 3 099' } });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar' }));

    expect(screen.getByText('2 adesivos marcados. Não existem: 099.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /imprimir selecionados \(2\)/i })).toBeInTheDocument();
    const cards = [...container.querySelectorAll('.sticker-print-card')].map((c) => c.textContent);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain('BIKE #002');
    expect(cards[1]).toContain('BIKE #003');

    fireEvent.click(screen.getByRole('button', { name: /limpar seleção/i }));
    expect(screen.getByRole('button', { name: /imprimir reserva \(1\)/i })).toBeInTheDocument();
  });

  it('marks every sticker of the current filter with one click', async () => {
    selectMock.mockResolvedValueOnce({ data: available(3), error: null });
    render(<StickersTab />);
    await waitFor(() => expect(screen.getByText('#003')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /marcar todos da lista/i }));
    expect(screen.getByRole('button', { name: /imprimir selecionados \(3\)/i })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Selecionar adesivo 002'));
    expect(screen.getByRole('button', { name: /imprimir selecionados \(2\)/i })).toBeInTheDocument();
  });
});
