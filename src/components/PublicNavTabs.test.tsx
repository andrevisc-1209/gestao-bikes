import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PublicNavTabs from './PublicNavTabs';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useNavigate: () => navigateMock,
}));

describe('PublicNavTabs', () => {
  it('highlights Cadastro and navigates to /ocorrencia when Ocorrência is clicked', () => {
    render(<PublicNavTabs active="cadastro" />);
    const cadastroTab = screen.getByRole('button', { name: 'Cadastro' });
    expect(cadastroTab).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: 'Ocorrência' }));
    expect(navigateMock).toHaveBeenCalledWith('/ocorrencia');
  });

  it('highlights Ocorrência and navigates to /cadastro when Cadastro is clicked', () => {
    render(<PublicNavTabs active="ocorrencia" />);
    expect(screen.getByRole('button', { name: 'Ocorrência' })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: 'Cadastro' }));
    expect(navigateMock).toHaveBeenCalledWith('/cadastro');
  });
});
