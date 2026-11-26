import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckSquare, Printer, Square, Tag, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Sticker } from "../../types/database";
import {
  buildStickerRows,
  matchTags,
  parseTagList,
  type BikeSummary,
  type StickerRow,
  type StickerState,
} from "../../lib/stickerSelection";

// An A4 sheet holds 3 columns x 6 rows of 5 x 4 cm stickers (see the print
// rules in index.css). Batches are generated in whole sheets so none is wasted.
export const STICKERS_PER_SHEET = 18;

function chunkIntoSheets<T>(items: T[]): T[][] {
  const sheets: T[][] = [];
  for (let i = 0; i < items.length; i += STICKERS_PER_SHEET) {
    sheets.push(items.slice(i, i + STICKERS_PER_SHEET));
  }
  return sheets;
}

function sheetsLabel(count: number): string {
  const sheets = Math.ceil(count / STICKERS_PER_SHEET);
  return `${sheets} ${sheets === 1 ? "folha" : "folhas"} A4`;
}

type Filter = "all" | StickerState;

const STATE_META: Record<StickerState, { label: string; badge: string; dot: string }> = {
  reserve: {
    label: "Reserva",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
  active: {
    label: "Em uso",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  inactive: {
    label: "Bike baixada",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "reserve", label: "Reserva" },
  { id: "active", label: "Em uso" },
  { id: "inactive", label: "Bike baixada" },
];

function StickersTab() {
  const [rows, setRows] = useState<StickerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetCount, setSheetCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [numbersInput, setNumbersInput] = useState("");
  const [numbersMessage, setNumbersMessage] = useState<string | null>(null);

  async function loadStickers() {
    setLoading(true);
    const [stickersRes, bikesRes] = await Promise.all([
      supabase.from("stickers").select("*").order("tag_number"),
      supabase
        .from("bikes")
        .select("id, tag_number, owner_name, unit_block, brand_model, status")
        .order("tag_number"),
    ]);
    setRows(
      buildStickerRows(
        (stickersRes.data as Sticker[] | null) ?? [],
        (bikesRes.data as BikeSummary[] | null) ?? [],
      ),
    );
    setLoading(false);
  }

  useEffect(() => {
    loadStickers();
  }, []);

  const counts = useMemo(() => {
    const result: Record<StickerState, number> = { reserve: 0, active: 0, inactive: 0 };
    for (const row of rows) result[row.state]++;
    return result;
  }, [rows]);

  const visibleRows = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.state === filter)),
    [rows, filter],
  );

  // What "Imprimir" prints: the chosen stickers when any are chosen, otherwise
  // the whole reserve (the fresh batch waiting to be stuck on bikes).
  const printRows = useMemo(
    () =>
      selected.size > 0
        ? rows.filter((row) => selected.has(row.tag_number))
        : rows.filter((row) => row.state === "reserve"),
    [rows, selected],
  );
  const sheets = useMemo(() => chunkIntoSheets(printRows), [printRows]);

  const validSheetCount = Number.isInteger(sheetCount) && sheetCount >= 1;
  const quantity = validSheetCount ? sheetCount * STICKERS_PER_SHEET : 0;

  function toggle(tag: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((row) => selected.has(row.tag_number));

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const row of visibleRows) {
        if (allVisibleSelected) next.delete(row.tag_number);
        else next.add(row.tag_number);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setNumbersMessage(null);
  }

  function selectTypedNumbers() {
    const { numbers, invalid } = parseTagList(numbersInput);
    const { tags, missing } = matchTags(numbers, rows);
    if (tags.length > 0) {
      setSelected((current) => new Set([...current, ...tags]));
      setNumbersInput("");
    }
    const parts = [
      tags.length > 0
        ? `${tags.length} ${tags.length === 1 ? "adesivo marcado" : "adesivos marcados"}.`
        : null,
      missing.length > 0 ? `Não existem: ${missing.join(", ")}.` : null,
      invalid.length > 0 ? `Não entendi: ${invalid.join(", ")}.` : null,
    ].filter(Boolean);
    setNumbersMessage(
      parts.length > 0 ? parts.join(" ") : "Digite os números, ex.: 002, 003 ou 010-015.",
    );
  }

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
    <div className="space-y-6 print:space-y-0">
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
            {counts.reserve} adesivos disponíveis na reserva
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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
        <div className="px-5 py-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-slate-800 text-sm sm:text-base">Adesivos</h2>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STATE_META) as StickerState[]).map((state) => (
                <span
                  key={state}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATE_META[state].badge}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STATE_META[state].dot}`} />
                  {STATE_META[state].label}: {counts[state]}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
            <div
              role="group"
              aria-label="Filtrar adesivos"
              className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto"
            >
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={filter === option.id}
                  onClick={() => setFilter(option.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    filter === option.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                selectTypedNumbers();
              }}
            >
              <label htmlFor="sticker-numbers" className="sr-only">
                Selecionar números
              </label>
              <input
                id="sticker-numbers"
                value={numbersInput}
                onChange={(event) => setNumbersInput(event.target.value)}
                placeholder="Números, ex.: 002, 003 ou 010-015"
                className="flex-1 min-w-0 lg:w-64 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="shrink-0 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors"
              >
                Marcar
              </button>
            </form>
          </div>
          {numbersMessage && (
            <p className="text-[11px] font-semibold text-slate-600">{numbersMessage}</p>
          )}
        </div>

        {visibleRows.length === 0 ? (
          <p className="text-center py-8 text-xs text-slate-400">Nenhum adesivo neste filtro.</p>
        ) : (
          <>
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={toggleVisible}
                className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                {allVisibleSelected ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {allVisibleSelected ? "Desmarcar os da lista" : "Marcar todos da lista"}
              </button>
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpar seleção ({selected.size})
                </button>
              )}
            </div>
            <ul className="divide-y divide-slate-100 max-h-[26rem] overflow-y-auto">
              {visibleRows.map((row) => {
                const meta = STATE_META[row.state];
                const isSelected = selected.has(row.tag_number);
                return (
                  <li key={row.tag_number}>
                    <label
                      className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                        isSelected ? "bg-emerald-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(row.tag_number)}
                        aria-label={`Selecionar adesivo ${row.tag_number}`}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-mono font-bold text-sm text-slate-900 w-14 shrink-0">
                        #{row.tag_number}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${meta.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                      <span className="text-xs text-slate-500 truncate min-w-0">
                        {row.bike
                          ? `${row.bike.unit_block} · ${row.bike.owner_name} · ${row.bike.brand_model}`
                          : "Sem bike, pronto para usar"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h2 className="font-bold text-slate-800 text-sm sm:text-base">Folha de Impressão</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {printRows.length === 0
                ? "Nada para imprimir"
                : `${selected.size > 0 ? `${printRows.length} selecionados` : `${printRows.length} da reserva`} · ${sheetsLabel(printRows.length)} · ${STICKERS_PER_SHEET} adesivos de 5 × 4 cm por folha`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={printRows.length === 0}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>
              {selected.size > 0
                ? `Imprimir selecionados (${printRows.length})`
                : `Imprimir reserva (${printRows.length})`}
            </span>
          </button>
        </div>

        <div className="p-5 print:p-0">
          {printRows.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-400 print:hidden">
              Nenhum adesivo na reserva. Gere um novo lote acima ou marque adesivos na lista para reimprimir.
            </p>
          ) : (
            <div className="space-y-4 print:space-y-0">
              {sheets.map((sheet, sheetIndex) => (
                <div key={sheetIndex} className="sticker-sheet grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {sheet.map((sticker) => (
                    <div
                      key={sticker.tag_number}
                      className="sticker-print-card aspect-[5/4] bg-slate-900 rounded-xl p-2 text-white border-2 border-slate-700 overflow-hidden flex flex-col items-center justify-between text-center"
                    >
                      <p className="sticker-label text-[7px] uppercase tracking-widest text-emerald-400 font-bold leading-none">
                        Patrimônio Condomínio
                      </p>
                      <div className="sticker-qr-box bg-white p-1 rounded-md">
                        <QRCodeSVG
                          className="sticker-qr"
                          value={`${window.location.origin}${window.location.pathname}#/b/${sticker.tag_number}`}
                          size={56}
                        />
                      </div>
                      <div className="leading-none">
                        <p className="sticker-tag text-sm font-black tracking-tight">BIKE #{sticker.tag_number}</p>
                        <p className="sticker-hint text-[7px] text-slate-400 mt-0.5">Escaneie para notificar</p>
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
