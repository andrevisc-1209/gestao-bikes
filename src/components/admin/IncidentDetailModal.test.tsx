import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IncidentDetailModal from './IncidentDetailModal';

const openIncident = {
  id: 'inc-1',
  bike_id: 'bike-1',
  reason: 'Pneu furado',
  notes: 'Perto da entrada',
  photo_url: 'https://example.com/photo.jpg',
  reporter_info: null,
  status: 'open' as const,
  created_at: '2026-01-10T12:00:00Z',
  resolved_at: null,
  resolution: null,
  resolution_notes: null,
  bikes: {
    tag_number: '005',
    unit_block: 'Bloco A • Apto 101',
    owner_name: 'Mariana Costa',
    owner_whatsapp: '21999990000',
  },
};

const resolvedIncident = {
  ...openIncident,
  id: 'inc-2',
  status: 'resolved' as const,
  resolved_at: '2026-01-11T09:00:00Z',
  resolution: 'Bike retirada do local',
  resolution_notes: 'Removida pela portaria',
};

describe('IncidentDetailModal', () => {
  it('shows the complaint reason, notes, timestamp, owner, and photo for an open incident', () => {
    render(<IncidentDetailModal incident={openIncident} onClose={vi.fn()} />);
    expect(screen.getByText('Pneu furado')).toBeInTheDocument();
    expect(screen.getByText(/Perto da entrada/)).toBeInTheDocument();
    expect(screen.getByText(/reportado em/i)).toBeInTheDocument();
    expect(screen.getByText('Mariana Costa')).toBeInTheDocument();
    expect(screen.getByText('21999990000')).toBeInTheDocument();
    const img = screen.getByRole('img', { name: /foto da ocorrência/i });
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    expect(img.closest('a')).toHaveAttribute('href', 'https://example.com/photo.jpg');
    expect(img.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not show any resolution section for an open incident', () => {
    render(<IncidentDetailModal incident={openIncident} onClose={vi.fn()} />);
    expect(screen.queryByText(/resolvida em/i)).not.toBeInTheDocument();
  });

  it('shows the resolution reason, notes, and timestamp for a resolved incident', () => {
    render(<IncidentDetailModal incident={resolvedIncident} onClose={vi.fn()} />);
    expect(screen.getByText('Bike retirada do local')).toBeInTheDocument();
    expect(screen.getByText(/Removida pela portaria/)).toBeInTheDocument();
    expect(screen.getByText(/resolvida em/i)).toBeInTheDocument();
  });

  it('renders no image when there is no photo', () => {
    render(<IncidentDetailModal incident={{ ...openIncident, photo_url: null }} onClose={vi.fn()} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders no img or link for a javascript: photo_url', () => {
    render(
      <IncidentDetailModal
        incident={{ ...openIncident, photo_url: 'javascript:alert(1)' }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<IncidentDetailModal incident={openIncident} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalled();
  });
});
