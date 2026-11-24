import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApprovalsTab from './ApprovalsTab';

const photoState = vi.hoisted(() => ({ url: null as string | null }));
const rpcMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: '039', error: null }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [{
      id: 'b1',
      tag_number: null,
      unit_block: 'Bloco A',
      owner_name: 'Mariana Costa',
      owner_whatsapp: '11999999999',
      brand_model: 'Y',
      color: 'Z',
      photo_url: photoState.url,
      status: 'pending',
      created_at: '2026-01-10T12:00:00Z',
    }], error: null }) }) }) }),
    rpc: rpcMock,
  },
}));

describe('ApprovalsTab', () => {
  it('renders no img for an unsafe javascript: photo_url, and shows a safe one', async () => {
    photoState.url = 'javascript:alert(1)';
    try {
      const { unmount } = render(<ApprovalsTab onApproved={() => {}} />);
      await waitFor(() => screen.getByText(/Bloco A/));
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      unmount();
      photoState.url = 'https://example.com/b.jpg';
      render(<ApprovalsTab onApproved={() => {}} />);
      expect(await screen.findByRole('img')).toHaveAttribute('src', 'https://example.com/b.jpg');
    } finally {
      photoState.url = null;
    }
  });

  it('calls approve_bike RPC with the bike id when approving', async () => {
    render(<ApprovalsTab onApproved={() => {}} />);
    await waitFor(() => screen.getByText(/Bloco A/));
    fireEvent.click(screen.getByRole('button', { name: /atribuir adesivo/i }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('approve_bike', { p_bike_id: 'b1' }));
  });

  it('shows an inline error and keeps the bike pending when the RPC fails', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'Bike já foi aprovada.' } });
    const onApproved = vi.fn();
    render(<ApprovalsTab onApproved={onApproved} />);
    await waitFor(() => screen.getByText(/Bloco A/));
    fireEvent.click(screen.getByRole('button', { name: /atribuir adesivo/i }));

    await waitFor(() => expect(screen.getByText(/bike já foi aprovada/i)).toBeInTheDocument());
    expect(onApproved).not.toHaveBeenCalled();
    expect(screen.queryByText(/adesivo atribuído/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Bloco A/)).toBeInTheDocument();
  });

  it('tells the admin to generate more stickers when the pool is empty', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'Nenhum adesivo disponível. Gere um novo lote.' },
    });
    render(<ApprovalsTab onApproved={() => {}} />);
    await waitFor(() => screen.getByText(/Bloco A/));
    fireEvent.click(screen.getByRole('button', { name: /atribuir adesivo/i }));

    await waitFor(() => expect(screen.getByText(/gere mais adesivos/i)).toBeInTheDocument());
    expect(screen.getByText(/aba adesivos/i)).toBeInTheDocument();
  });

  it('opens BikeDetailModal with the full pending bike when its card is clicked', async () => {
    render(<ApprovalsTab onApproved={vi.fn()} />);
    await screen.findByText(/mariana costa/i);
    fireEvent.click(screen.getByText(/mariana costa/i).closest('div')!);
    await waitFor(() => {
      expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument();
    });
  });

  it('clicking "Atribuir Adesivo" still approves without opening the detail modal', async () => {
    render(<ApprovalsTab onApproved={vi.fn()} />);
    await screen.findByText(/mariana costa/i);
    fireEvent.click(screen.getByRole('button', { name: /atribuir adesivo/i }));
    expect(screen.queryByText(/cadastrado em/i)).not.toBeInTheDocument();
  });

  it('approving a bike while its own detail modal is open does not crash and closes cleanly', async () => {
    render(<ApprovalsTab onApproved={vi.fn()} />);
    await screen.findByText(/mariana costa/i);
    fireEvent.click(screen.getByText(/mariana costa/i).closest('div')!);
    await waitFor(() => expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /atribuir adesivo/i }));
    await waitFor(() => {
      expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument();
    });
  });
});
