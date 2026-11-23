import { PieChart, Tag, Clock, BellRing } from 'lucide-react';

export function occupancyPercent(active: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((active / capacity) * 100));
}

interface KpiCardsProps {
  activeCount: number;
  totalCapacity: number;
  pendingCount: number;
  openIncidentCount: number;
}

function KpiCards({ activeCount, totalCapacity, pendingCount, openIncidentCount }: KpiCardsProps) {
  const pct = occupancyPercent(activeCount, totalCapacity);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Ocupação do Bicicletário</span>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <PieChart className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900">
            {activeCount} / {totalCapacity}
          </span>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {pct}%
          </span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Bikes Emplacadas (Ativas)</span>
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Tag className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-slate-900">{activeCount}</div>
        <p className="text-xs text-slate-400 mt-1">Com adesivo QR Code ativo</p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Aguardando Adesivo</span>
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-amber-600">{pendingCount}</div>
        <p className="text-xs text-slate-400 mt-1">Novos cadastros para numerar</p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Ocorrências via QR Code</span>
          <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
            <BellRing className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-rose-600">{openIncidentCount}</div>
        <p className="text-xs text-slate-400 mt-1">Notificações pendentes de baixa</p>
      </div>
    </div>
  );
}

export default KpiCards;
