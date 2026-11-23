import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicBikePage from './PublicBikePage';

const rpcMock = vi.fn();
const insertMock = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => ({ insert: insertMock }),
  },
}));

function renderPage(tag = '42') {
  render(
    <MemoryRouter initialEntries={[`/b/${tag}`]}>
      <Routes>
        <Route path="/b/:tagNumber" element={<PublicBikePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicBikePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a softer follow-up line when the bike is not found', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /bike não encontrada/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/confirme o número com a administração/i)).toBeInTheDocument();
  });

  it('shows a closing message after the notification is sent', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'bike-1',
          tag_number: '42',
          brand_model: 'Sense Impulse',
          color: 'Preta',
          photo_url: null,
        },
      ],
      error: null,
    });
    insertMock.mockResolvedValue({ error: null });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/notificar proprietário sobre esta bike/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/pneu murcho/i));
    fireEvent.click(screen.getByRole('button', { name: /enviar notificação ao proprietário/i }));

    await waitFor(() => {
      expect(screen.getByText(/notificação enviada/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/pode fechar esta página/i)).toBeInTheDocument();
  });
});
