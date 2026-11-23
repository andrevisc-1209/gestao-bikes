import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApprovalsTab from './ApprovalsTab';

const rpcMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: '039', error: null }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [{ id: 'b1', unit_block: 'Bloco A', owner_name: 'X', brand_model: 'Y', color: 'Z', photo_url: null }], error: null }) }) }) }),
    rpc: rpcMock,
  },
}));

describe('ApprovalsTab', () => {
  it('calls approve_bike RPC with the bike id when approving', async () => {
    render(<ApprovalsTab onApproved={() => {}} />);
    await waitFor(() => screen.getByText(/Bloco A/));
    fireEvent.click(screen.getByRole('button', { name: /atribuir adesivo/i }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('approve_bike', { p_bike_id: 'b1' }));
  });
});
