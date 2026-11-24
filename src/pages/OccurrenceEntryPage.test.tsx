import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OccurrenceEntryPage from './OccurrenceEntryPage';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

function renderPage() {
  render(
    <MemoryRouter>
      <OccurrenceEntryPage />
    </MemoryRouter>
  );
}

describe('OccurrenceEntryPage', () => {
  it('normalizes and navigates to /b/:tag when a tag number is entered manually', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/número do adesivo/i), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: /ver ocorrência/i }));
    expect(navigateMock).toHaveBeenCalledWith('/b/007');
  });

  it('trims whitespace before navigating', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/número do adesivo/i), { target: { value: '  12  ' } });
    fireEvent.click(screen.getByRole('button', { name: /ver ocorrência/i }));
    expect(navigateMock).toHaveBeenCalledWith('/b/012');
  });

  it('renders PublicNavTabs with Ocorrência active', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Ocorrência' })).toHaveAttribute('aria-current', 'page');
  });
});
