import { Filter, Search, X } from 'lucide-react';
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  type IncidentFilters,
  type PeriodFilter,
  type StatusFilter,
} from '../../lib/incidentFilters';

const PERIODS: { id: PeriodFilter; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'custom', label: 'Escolher datas' },
];

const STATUSES: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'open', label: 'Em aberto' },
  { id: 'resolved', label: 'Resolvidas' },
];

interface IncidentFiltersBarProps {
  filters: IncidentFilters;
  onChange: (filters: IncidentFilters) => void;
  reasons: string[];
  repeatBikes: { tag: string; count: number }[];
  shown: number;
  total: number;
}

const segment = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
    active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
  }`;

const fieldClass =
  'text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500';

function IncidentFiltersBar({ filters, onChange, reasons, repeatBikes, shown, total }: IncidentFiltersBarProps) {
  const set = (patch: Partial<IncidentFilters>) => onChange({ ...filters, ...patch });
  const active = hasActiveFilters(filters);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <h2 className="font-bold text-slate-800 text-sm">Filtros</h2>
          <span className="text-[11px] text-slate-500">
            {active ? `${shown} de ${total} ocorrências` : `${total} ocorrências`}
          </span>
        </div>
        {active && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div role="group" aria-label="Período" className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          {PERIODS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filters.period === option.id}
              onClick={() => set({ period: option.id })}
              className={segment(filters.period === option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Situação" className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          {STATUSES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filters.status === option.id}
              onClick={() => set({ status: option.id })}
              className={segment(filters.status === option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filters.period === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
            De
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => set({ from: event.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
            Até
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => set({ to: event.target.value })}
              className={fieldClass}
            />
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <label htmlFor="incident-search" className="sr-only">
            Buscar bike, apartamento ou dono
          </label>
          <input
            id="incident-search"
            value={filters.search}
            onChange={(event) => set({ search: event.target.value })}
            placeholder="Bike, apartamento ou dono (ex.: 004, Apto 505)"
            className={`${fieldClass} w-full pl-8`}
          />
        </div>
        <div>
          <label htmlFor="incident-reason" className="sr-only">
            Motivo
          </label>
          <select
            id="incident-reason"
            value={filters.reason}
            onChange={(event) => set({ reason: event.target.value })}
            className={`${fieldClass} w-full`}
          >
            <option value="">Todos os motivos</option>
            {reasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
        </div>
      </div>

      {repeatBikes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Mais reportadas:</span>
          {repeatBikes.map(({ tag, count }) => (
            <button
              key={tag}
              type="button"
              onClick={() => set({ search: tag })}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
            >
              BIKE {tag}
              <span className="bg-amber-200/70 text-amber-900 rounded-full px-1.5">{count}×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default IncidentFiltersBar;
