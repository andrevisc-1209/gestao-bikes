import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

const mounts = vi.hoisted(() => ({
  occurrences: vi.fn(),
  approvals: vi.fn(),
  fleet: vi.fn(),
  stickers: vi.fn(),
}));
const kpiQuery = vi.hoisted(() => vi.fn());

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ signOut: vi.fn() }) }));

vi.mock('../lib/supabase', () => {
  const builder = () => {
    kpiQuery();
    const result = { count: 0, data: { id: 's1', total_capacity: 10 }, error: null };
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => Promise.resolve(result);
    b.single = () => Promise.resolve(result);
    return b;
  };
  return { supabase: { from: () => builder() } };
});

vi.mock('../components/admin/KpiCards', () => ({ default: () => <div>kpi</div> }));
vi.mock('../components/admin/OccurrencesTab', () => ({
  default: () => {
    useEffect(() => { mounts.occurrences(); }, []);
    return <div>occurrences-fake</div>;
  },
}));
vi.mock('../components/admin/ApprovalsTab', () => ({
  default: () => {
    useEffect(() => { mounts.approvals(); }, []);
    return <div>approvals-fake</div>;
  },
}));
vi.mock('../components/admin/FleetTab', () => ({
  default: () => {
    useEffect(() => { mounts.fleet(); }, []);
    return <div>fleet-fake</div>;
  },
}));
vi.mock('../components/admin/StickersTab', () => ({
  default: () => {
    useEffect(() => { mounts.stickers(); }, []);
    return <div>stickers-fake</div>;
  },
}));

import AdminPage from './AdminPage';

describe('AdminPage refresh', () => {
  beforeEach(() => {
    Object.values(mounts).forEach((m) => m.mockClear());
    kpiQuery.mockClear();
  });

  it('remounts the active tab and refetches KPI counts on "Atualizar"', async () => {
    render(<AdminPage />);
    await screen.findByText('occurrences-fake');
    expect(mounts.occurrences).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(kpiQuery).toHaveBeenCalled());
    const kpiBefore = kpiQuery.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));

    await waitFor(() => expect(mounts.occurrences).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(kpiQuery.mock.calls.length).toBeGreaterThan(kpiBefore));
  });

  it('survives two quick clicks', async () => {
    render(<AdminPage />);
    await screen.findByText('occurrences-fake');
    const btn = screen.getByRole('button', { name: 'Atualizar' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(mounts.occurrences).toHaveBeenCalledTimes(3));
    expect(screen.getByText('occurrences-fake')).toBeInTheDocument();
  });

  it('still switches tabs', async () => {
    render(<AdminPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Aprovações' }));
    await screen.findByText('approvals-fake');
    expect(mounts.approvals).toHaveBeenCalledTimes(1);
  });
});
