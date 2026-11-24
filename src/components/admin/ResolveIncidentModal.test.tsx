import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResolveIncidentModal from './ResolveIncidentModal';

const updateMock = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ update: updateMock }) },
}));

describe('ResolveIncidentModal', () => {
  beforeEach(() => {
    updateMock.mockReset();
  });

  it('defaults to the first reason and updates the incident with the selected reason and notes, filtering on id and open status', async () => {
    const eqStatusMock = vi.fn(() => ({ select: () => Promise.resolve({ data: [{ id: 'incident-1' }], error: null }) }));
    const eqIdMock = vi.fn(() => ({ eq: eqStatusMock }));
    updateMock.mockReturnValue({ eq: eqIdMock });
    const onResolved = vi.fn();
    render(<ResolveIncidentModal incident={{ id: 'incident-1' }} onClose={vi.fn()} onResolved={onResolved} />);
    fireEvent.change(screen.getByLabelText(/motivo da resolução/i), { target: { value: 'Morador contatado e resolveu' } });
    fireEvent.change(screen.getByLabelText(/observações/i), { target: { value: 'Falou com o morador' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'resolved',
        resolution: 'Morador contatado e resolveu',
        resolution_notes: 'Falou com o morador',
      }));
      expect(eqIdMock).toHaveBeenCalledWith('id', 'incident-1');
      expect(eqStatusMock).toHaveBeenCalledWith('status', 'open');
      expect(onResolved).toHaveBeenCalled();
    });
  });

  it('shows an error and does not call onResolved when the update affects zero rows (already resolved elsewhere)', async () => {
    // Simulates the status filter excluding the row because another admin already resolved it:
    // the chain still reaches .select(), but matches zero rows.
    updateMock.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }) });
    const onResolved = vi.fn();
    render(<ResolveIncidentModal incident={{ id: 'incident-1' }} onClose={vi.fn()} onResolved={onResolved} />);
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => {
      expect(screen.getByText(/não foi possível|já foi resolvida/i)).toBeInTheDocument();
    });
    expect(onResolved).not.toHaveBeenCalled();
  });

  it('shows the error and does not call onResolved when the update itself fails', async () => {
    updateMock.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'network error' } }) }) }) });
    const onResolved = vi.fn();
    render(<ResolveIncidentModal incident={{ id: 'incident-1' }} onClose={vi.fn()} onResolved={onResolved} />);
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => {
      expect(screen.getByText('network error')).toBeInTheDocument();
    });
    expect(onResolved).not.toHaveBeenCalled();
  });

  it('calls onClose without updating anything on Cancelar', () => {
    const onClose = vi.fn();
    render(<ResolveIncidentModal incident={{ id: 'incident-1' }} onClose={onClose} onResolved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
