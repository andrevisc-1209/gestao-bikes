import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Tag } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Sticker } from "../../types/database";

// An A4 sheet holds 2 columns x 6 rows of 8 x 4 cm stickers (see the print
// rules in index.css). Batches are generated in whole sheets so none is wasted.
export const STICKERS_PER_SHEET = 12;

function chunkIntoSheets<T>(items: T[]): T[][] {
  const sheets: T[][] = [];
  for (let i = 0; i < items.length; i += STICKERS_PER_SHEET) {
    sheets.push(items.slice(i, i + STICKERS_PER_SHEET));
  }
  return sheets;
}

function StickersTab() {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetCount, setSheetCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);

  async function loadStickers() {
    setLoading(true);
    const { data } = await supabase
      .from("stickers")
      .select("*")
      .order("tag_number");
    setStickers((data as Sticker[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadStickers();
  }, []);

  const availableStickers = useMemo(
    () => stickers.filter((sticker) => sticker.status === "available"),
    [stickers],
  );

  const sheets = useMemo(
    () => chunkIntoSheets(availableStickers),
    [availableStickers],
  );
  const validSheetCount = Number.isInteger(sheetCount) && sheetCount >= 1;
  const quantity = validSheetCount ? sheetCount * STICKERS_PER_SHEET : 0;

  async function handleGenerate() {
    if (!validSheetCount) return;
    setGenerating(true);
    setGenerateError(null);
    setGenerateMessage(null);
    const { data, error } = await supabase.rpc("generate_sticker_batch", {
      p_count: quantity,
    });

    if (!error) {
      const created = (data as number | null) ?? 0;
      if (created < quantity) {
        setGenerateMessage(
          `${created} de ${quantity} adesivos gerados (alguns números já existiam e foram ignorados).`,
        );
      } else {
        setGenerateMessage(
          `${created} adesivos gerados com sucesso (${sheetCount} ${sheetCount === 1 ? "folha" : "folhas"} A4).`,
        );
      }
      await loadStickers();
    } else {
      setGenerateError(
        error.message || "Não foi possível gerar o lote. Tente novamente.",
      );
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
            <h2 className="font-bold text-slate-800 text-sm sm:text-base">
              Gerar Lote de Adesivos
            </h2>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs font-semibold text-slate-600">
            {availableStickers.length} adesivos disponíveis
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="sticker-sheets"
                className="text-xs font-semibold text-slate-600"
              >
                Folhas A4
              </label>
              <input
                id="sticker-sheets"
                type="number"
                min={1}
                step={1}
                value={sheetCount}
                onChange={(event) => setSheetCount(Number(event.target.value))}
                className="w-28 text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-xs text-slate-500 sm:pb-2.5">
              {validSheetCount
                ? `= ${quantity} adesivos (${STICKERS_PER_SHEET} por folha)`
                : "Informe um número inteiro de folhas"}
            </p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !validSheetCount}
              className="shrink-0 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{generating ? "Gerando..." : "Gerar Lote"}</span>
            </button>
          </div>
          {generateError && (
            <p className="text-[11px] font-semibold text-rose-600">
              {generateError}
            </p>
          )}
          {generateMessage && (
            <p className="text-[11px] font-semibold text-emerald-600">
              {generateMessage}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between print:hidden">
          <div>
            <h2 className="font-bold text-slate-800 text-sm sm:text-base">
              Folha de Adesivos
            </h2>
            {sheets.length > 0 && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                {sheets.length} {sheets.length === 1 ? "folha" : "folhas"} A4 ·{" "}
                {STICKERS_PER_SHEET} adesivos de 8 × 4 cm por folha
              </p>
            )}
          </div>
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

        <div className="p-5 print:p-0">
          {availableStickers.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-400 print:hidden">
              Nenhum adesivo disponível. Gere um novo lote acima.
            </p>
          ) : (
            <div className="space-y-4 print:space-y-0">
              {sheets.map((sheet, sheetIndex) => (
                <div
                  key={sheetIndex}
                  className="sticker-sheet grid grid-cols-2 sm:grid-cols-3 gap-4"
                >
                  {sheet.map((sticker) => (
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
                          className="sticker-qr"
                          value={`${window.location.origin}${window.location.pathname}#/b/${sticker.tag_number}`}
                          size={64}
                        />
                      </div>
                    </div>
                  ))}
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
