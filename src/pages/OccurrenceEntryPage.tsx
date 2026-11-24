import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Camera, Search } from 'lucide-react';
import type { Html5Qrcode } from 'html5-qrcode';
import PublicNavTabs from '../components/PublicNavTabs';
import { extractBikeTagPath } from '../lib/qrScan';

const QR_READER_ELEMENT_ID = 'occurrence-qr-reader';

function stopScannerSafely(scanner: Html5Qrcode) {
  try {
    // html5-qrcode's stop() can throw synchronously (not just reject) when
    // the scanner never started or is mid-start, so both paths must be caught.
    scanner.stop()?.catch(() => {
      // Ignore stop errors — nothing to recover from on cleanup.
    });
  } catch {
    // Ignore synchronous stop errors — nothing to recover from on cleanup.
  }
}

function OccurrenceEntryPage() {
  const navigate = useNavigate();
  const [tagInput, setTagInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      const scanner = scannerRef.current;
      if (!scanner) return;
      stopScannerSafely(scanner);
    };
  }, []);

  async function handleActivateCamera() {
    setScanError(null);
    setCameraActive(true);
    handledRef.current = false;

    try {
      const { Html5Qrcode: Html5QrcodeCtor } = await import('html5-qrcode');
      const scanner = new Html5QrcodeCtor(QR_READER_ELEMENT_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText: string) => {
          if (handledRef.current) return;

          const path = extractBikeTagPath(decodedText);
          if (path) {
            handledRef.current = true;
            navigate(path);
          } else {
            setScanError('QR Code não reconhecido. Tente novamente ou digite o número.');
          }
        },
        () => {
          // Per-frame scan failures (no QR code visible yet) are expected and ignored.
        }
      );

      if (unmountedRef.current) {
        // The component unmounted while start() was still pending — stop the
        // now-running scanner so it doesn't leave a dangling camera stream.
        stopScannerSafely(scanner);
      }
    } catch {
      setScanError('Não foi possível acessar a câmera.');
      setCameraActive(false);
      // The scanner never actually started (or failed mid-start), so there's
      // nothing for the unmount cleanup to stop — and calling stop() on it
      // would throw synchronously and crash the app.
      scannerRef.current = null;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/b/${tagInput.trim().padStart(3, '0')}`);
  }

  return (
    <div className="max-w-2xl mx-auto p-5">
      <PublicNavTabs active="ocorrencia" />
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-6">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Registrar Ocorrência</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">Localizar Bicicleta</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Escaneie o QR Code do adesivo ou digite o número do patrimônio para abrir a
            página da bicicleta.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            {!cameraActive && (
              <button
                type="button"
                onClick={handleActivateCamera}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Ativar Câmera</span>
              </button>
            )}

            <div
              id={QR_READER_ELEMENT_ID}
              className={cameraActive ? 'rounded-lg overflow-hidden' : 'hidden'}
            />

            {scanError && (
              <p className="text-xs text-red-600 text-center">{scanError}</p>
            )}
          </div>

          <hr className="border-slate-100" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="occ-tag" className="block text-xs font-semibold text-slate-700 mb-1">
                Número do adesivo *
              </label>
              <input
                type="text"
                id="occ-tag"
                required
                placeholder="Ex: 7"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>Ver Ocorrência</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default OccurrenceEntryPage;
