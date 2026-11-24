import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Sticker } from '../../types/database';

function StickersTab() {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(20);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function loadStickers() {
    setLoading(true);
    const { data } = await supabase.from('stickers').select('*').order('tag_number');
    setStickers((data as Sticker[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadStickers();
  }, []);

  const availableStickers = useMemo(
    () => stickers.filter((sticker) => sticker.status === 'available'),
    [stickers]
  );

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    const { error } = await supabase.rpc('generate_sticker_batch', { p_count: quantity });

    if (!error) {
      await loadStickers();
    } else {
      setGenerateError(error.message || 'Não foi possível gerar o lote. Tente novamente.');
    }

    setGenerating(false);
  }

  if (loading) {
    return <p className="text-xs text-slate-400 p-5">Carregando adesivos...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <h2 className="font-bold text-slate-800 text-sm sm:text-base">Gerar Lote de Adesivos</h2>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs font-semibold text-slate-600">
            {availableStickers.length} adesivos disponíveis
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sticker-quantity" className="text-xs font-semibold text-slate-600">
                Quantidade
              </label>
              <input
                id="sticker-quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="w-28 text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="shrink-0 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{generating ? 'Gerando...' : 'Gerar Lote'}</span>
            </button>
          </div>
          {generateError && (
            <p className="text-[11px] font-semibold text-rose-600">{generateError}</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between print:hidden">
          <h2 className="font-bold text-slate-800 text-sm sm:text-base">Folha de Adesivos</h2>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={availableStickers.length === 0}
            className="shrink-0 bg-white hover:bg-emerald-600 text-slate-700 hover:text-white border border-slate-200 hover:border-emerald-600 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Lote</span>
          </button>
        </div>

        <div className="p-5">
          {availableStickers.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-400 print:hidden">
              Nenhum adesivo disponível. Gere um novo lote acima.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3">
              {availableStickers.map((sticker) => (
                <div
                  key={sticker.tag_number}
                  className="sticker-print-card bg-slate-900 rounded-2xl p-4 text-white border-2 border-slate-700 shadow-inner relative overflow-hidden flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold">
                      Patrimônio Condomínio
                    </p>
                    <p className="text-2xl font-black tracking-tight mt-0.5">
                      BIKE #{sticker.tag_number}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Escaneie para notificar
                      <br />
                      ou verificar regularidade
                    </p>
                  </div>
                  <div className="bg-white p-2 rounded-xl shrink-0">
                    <QRCodeSVG
                      value={`${window.location.origin}${window.location.pathname}#/b/${sticker.tag_number}`}
                      size={64}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StickersTab;
