import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OccurrenceEntryPage from './OccurrenceEntryPage';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

const startMock = vi.fn();
const stopMock = vi.fn().mockResolvedValue(undefined);
let capturedOnSuccess: ((decodedText: string) => void) | undefined;

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn().mockImplementation(() => ({
    start: (...args: unknown[]) => {
      capturedOnSuccess = args[2] as (decodedText: string) => void;
      // Propagate startMock's return value (sync throw stays a sync throw;
      // a resolved/rejected promise is passed through) instead of always
      // resolving, so tests can exercise both start() failure modes.
      return Promise.resolve(startMock(...args));
    },
    stop: stopMock,
  })),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <OccurrenceEntryPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  navigateMock.mockClear();
  startMock.mockClear();
  startMock.mockImplementation((...args: unknown[]) => {
    capturedOnSuccess = args[2] as (decodedText: string) => void;
    return Promise.resolve();
  });
  stopMock.mockClear();
  capturedOnSuccess = undefined;
});

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

  it('navigates to the scanned bike when the QR payload matches the expected shape', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }));
    await waitFor(() => expect(startMock).toHaveBeenCalled());

    capturedOnSuccess?.('https://andrevisc-1209.github.io/gestao-bikes/#/b/014');

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/b/014'));
  });

  it('shows "QR Code não reconhecido" and keeps the manual input usable for an unrecognized scan', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }));
    await waitFor(() => expect(startMock).toHaveBeenCalled());

    capturedOnSuccess?.('garbled nonsense');

    await waitFor(() => {
      expect(screen.getByText(/qr code não reconhecido/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/número do adesivo/i)).toBeEnabled();
  });

  it('keeps the manual input usable and shows an error when the camera fails to start (e.g. permission denied)', async () => {
    startMock.mockImplementationOnce(() => { throw new Error('Permission denied'); });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }));

    await waitFor(() => {
      expect(screen.getByText(/não foi possível acessar a câmera/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/número do adesivo/i)).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/número do adesivo/i), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /ver ocorrência/i }));
    expect(navigateMock).toHaveBeenCalledWith('/b/009');
  });

  it('stops the scanner on unmount', async () => {
    const { unmount } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }));
    await waitFor(() => expect(startMock).toHaveBeenCalled());

    unmount();

    await waitFor(() => expect(stopMock).toHaveBeenCalled());
  });

  it('does not crash when stop() throws synchronously on unmount after a failed start()', async () => {
    startMock.mockImplementationOnce(() => { throw new Error('Permission denied'); });
    stopMock.mockImplementationOnce(() => {
      throw new Error('Cannot stop, scanner is not running or paused.');
    });

    const { unmount } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }));

    await waitFor(() => {
      expect(screen.getByText(/não foi possível acessar a câmera/i)).toBeInTheDocument();
    });

    expect(() => unmount()).not.toThrow();
  });

  it('keeps the manual input usable and shows an error when start() rejects (e.g. permission denied)', async () => {
    startMock.mockImplementationOnce(() => Promise.reject(new Error('Permission denied')));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }));

    await waitFor(() => {
      expect(screen.getByText(/não foi possível acessar a câmera/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/número do adesivo/i)).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/número do adesivo/i), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /ver ocorrência/i }));
    expect(navigateMock).toHaveBeenCalledWith('/b/009');
  });

  it('ignores a second successful scan and only navigates once', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }));
    await waitFor(() => expect(startMock).toHaveBeenCalled());

    capturedOnSuccess?.('https://andrevisc-1209.github.io/gestao-bikes/#/b/014');
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/b/014'));

    capturedOnSuccess?.('https://andrevisc-1209.github.io/gestao-bikes/#/b/099');

    expect(navigateMock).toHaveBeenCalledTimes(1);
  });
});
