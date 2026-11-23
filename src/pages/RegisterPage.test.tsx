import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterPage from './RegisterPage';

const insertMock = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ insert: insertMock }) } }));

const compressAndUploadMock = vi.fn();
vi.mock('../lib/imageCompression', () => ({
  compressAndUpload: (...args: unknown[]) => compressAndUploadMock(...args),
}));

function attachPhoto(file = new File(['x'], 'bike.jpg', { type: 'image/jpeg' })) {
  const input = document.getElementById('reg-photo') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds with no photo attached, inserting a null photo_url', async () => {
    insertMock.mockResolvedValue({ error: null });
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/apartamento/i), { target: { value: '504' } });
    fireEvent.change(screen.getByLabelText(/whatsapp/i), { target: { value: '21999990000' } });
    fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: 'Mariana Costa' } });
    fireEvent.change(screen.getByLabelText(/^marca/i), { target: { value: 'Sense' } });
    fireEvent.change(screen.getByLabelText(/^modelo/i), { target: { value: 'Impulse' } });
    fireEvent.change(screen.getByLabelText(/cor predominante/i), { target: { value: 'Preta' } });

    fireEvent.click(screen.getByRole('button', { name: /enviar cadastro/i }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ photo_url: null }));
    });

    expect(compressAndUploadMock).not.toHaveBeenCalled();
  });

  it('shows an inline error and preserves typed fields when the upload fails', async () => {
    compressAndUploadMock.mockResolvedValue({ error: 'Não foi possível enviar a foto. Tente novamente.' });
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/apartamento/i), { target: { value: '504' } });
    fireEvent.change(screen.getByLabelText(/whatsapp/i), { target: { value: '21999990000' } });
    fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: 'Mariana Costa' } });
    fireEvent.change(screen.getByLabelText(/^marca/i), { target: { value: 'Sense' } });
    fireEvent.change(screen.getByLabelText(/^modelo/i), { target: { value: 'Impulse' } });
    fireEvent.change(screen.getByLabelText(/cor predominante/i), { target: { value: 'Preta' } });
    attachPhoto();

    fireEvent.click(screen.getByRole('button', { name: /enviar cadastro/i }));

    await waitFor(() => {
      expect(screen.getByText(/não foi possível enviar a foto/i)).toBeInTheDocument();
    });

    expect(insertMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/apartamento/i)).toHaveValue('504');
    expect(screen.getByLabelText(/nome completo/i)).toHaveValue('Mariana Costa');
    expect(screen.getByLabelText(/^marca/i)).toHaveValue('Sense');
    expect(screen.getByLabelText(/^modelo/i)).toHaveValue('Impulse');
  });
});
