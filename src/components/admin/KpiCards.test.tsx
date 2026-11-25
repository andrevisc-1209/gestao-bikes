import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KpiCards, { occupancyLevel, occupancyPercent } from './KpiCards';

describe('occupancyPercent', () => {
  it('shows the real percentage when active bikes exceed capacity', () => {
    expect(occupancyPercent(6, 3)).toBe(200);
  });
  it('computes a normal percentage otherwise', () => {
    expect(occupancyPercent(38, 50)).toBe(76);
  });
  it('returns 0 when capacity is zero', () => {
    expect(occupancyPercent(0, 0)).toBe(0);
  });
  it('returns 0 when capacity is negative', () => {
    expect(occupancyPercent(5, -10)).toBe(0);
  });
});

describe('occupancyLevel', () => {
  it('grades the occupancy', () => {
    expect(occupancyLevel(6, 30)).toBe('ok');
    expect(occupancyLevel(27, 30)).toBe('near');
    expect(occupancyLevel(30, 30)).toBe('full');
    expect(occupancyLevel(6, 3)).toBe('over');
    expect(occupancyLevel(2, 0)).toBe('over');
    expect(occupancyLevel(0, 0)).toBe('ok');
  });
});

describe('KpiCards', () => {
  const props = { pendingCount: 0, openIncidentCount: 0 };

  it('alerts when more bikes are active than spaces', () => {
    render(<KpiCards activeCount={6} totalCapacity={3} {...props} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Bicicletário acima da capacidade');
    expect(screen.getByRole('alert')).toHaveTextContent('6 bikes ativas para 3 vagas (3 a mais)');
    expect(screen.getByText('200%')).toBeInTheDocument();
    expect(screen.getByText('3 bikes acima das vagas')).toBeInTheDocument();
  });

  it('shows free spaces and no alert while under capacity', () => {
    render(<KpiCards activeCount={6} totalCapacity={30} {...props} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('24 vagas livres')).toBeInTheDocument();
  });

  it('says the room is full at exactly capacity, without the alert', () => {
    render(<KpiCards activeCount={3} totalCapacity={3} {...props} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Lotado: nenhuma vaga livre')).toBeInTheDocument();
  });
});
