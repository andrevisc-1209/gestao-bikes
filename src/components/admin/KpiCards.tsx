import type { ReactNode } from 'react';
import { PieChart, Tag, Clock, BellRing, AlertTriangle } from 'lucide-react';

// The real share of spaces taken. It goes past 100 when more bikes are active
// than the bike room holds, so the admin sees by how much it is over.
export function occupancyPercent(active: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.round((active / capacity) * 100);
}

export type OccupancyLevel = 'ok' | 'near' | 'full' | 'over';

// near: 90% or more; full: exactly at capacity; over: more bikes than spaces.
export function occupancyLevel(active: number, capacity: number): OccupancyLevel {
  if (capacity <= 0) return active > 0 ? 'over' : 'ok';
  if (active > capacity) return 'over';
  if (active === capacity) return 'full';
  return active / capacity >= 0.9 ? 'near' : 'ok';
}

const LEVEL_STYLE: Record<OccupancyLevel, { accent: string; bar: string; chip: string; icon: string }> = {
  ok: { accent: 'bg-emerald-500', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700', icon: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
  near: { accent: 'bg-amber-500', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700', icon: 'bg-amber-50 text-amber-600 ring-amber-100' },
  full: { accent: 'bg-amber-500', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700', icon: 'bg-amber-50 text-amber-600 ring-amber-100' },
  over: { accent: 'bg-rose-500', bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700', icon: 'bg-rose-50 text-rose-600 ring-rose-100' },
};

function occupancyCaption(active: number, capacity: number, level: OccupancyLevel): string {
  const free = capacity - active;
  if (level === 'over') return `${active - capacity} ${active - capacity === 1 ? 'bike' : 'bikes'} acima das vagas`;
  if (level === 'full') return 'Lotado: nenhuma vaga livre';
  return `${free} ${free === 1 ? 'vaga livre' : 'vagas livres'}`;
}

interface CardProps {
  label: string;
  icon: ReactNode;
  iconClass: string;
  accentClass: string;
  children: ReactNode;
}

function Card({ label, icon, iconClass, accentClass, children }: CardProps) {
  return (
    <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
      <span className={`absolute inset-y-0 left-0 w-1 ${accentClass}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className={`p-2.5 rounded-xl ring-1 ${iconClass}`}>{icon}</div>
      </div>
      {children}
    </div>
  );
}

interface KpiCardsProps {
  activeCount: number;
  totalCapacity: number;
  pendingCount: number;
  openIncidentCount: number;
}

function KpiCards({ activeCount, totalCapacity, pendingCount, openIncidentCount }: KpiCardsProps) {
  const pct = occupancyPercent(activeCount, totalCapacity);
  const level = occupancyLevel(activeCount, totalCapacity);
  const style = LEVEL_STYLE[level];
  const excess = activeCount - totalCapacity;

  return (
    <div className="space-y-4">
      {level === 'over' && (
        <div
          role="alert"
          className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl px-4 py-3.5"
        >
          <div className="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-sm">
            <p className="font-bold">Bicicletário acima da capacidade</p>
            <p className="text-xs text-rose-700 mt-0.5">
              {activeCount} bikes ativas para {totalCapacity} {totalCapacity === 1 ? 'vaga' : 'vagas'} ({excess} a
              mais). Aumente a capacidade na aba Frota ou dê baixa nas bikes que saíram do prédio.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          label="Ocupação do Bicicletário"
          icon={<PieChart className="w-4 h-4" />}
          iconClass={style.icon}
          accentClass={style.accent}
        >
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl font-extrabold text-slate-900 tabular-nums">{activeCount}</span>
            <span className="text-sm font-semibold text-slate-400">/ {totalCapacity} vagas</span>
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${style.chip}`}>{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full mt-3 overflow-hidden">
            <div
              className={`${style.bar} h-full rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <p
            className={`text-xs mt-2 ${level === 'over' ? 'font-semibold text-rose-600' : level === 'ok' ? 'text-slate-400' : 'font-semibold text-amber-600'}`}
          >
            {occupancyCaption(activeCount, totalCapacity, level)}
          </p>
        </Card>

        <Card
          label="Bikes Adesivadas (Ativas)"
          icon={<Tag className="w-4 h-4" />}
          iconClass="bg-blue-50 text-blue-600 ring-blue-100"
          accentClass="bg-blue-500"
        >
          <div className="text-3xl font-extrabold text-slate-900 tabular-nums">{activeCount}</div>
          <p className="text-xs text-slate-400 mt-2">Com adesivo QR Code ativo</p>
        </Card>

        <Card
          label="Aguardando Adesivo"
          icon={<Clock className="w-4 h-4" />}
          iconClass="bg-amber-50 text-amber-600 ring-amber-100"
          accentClass="bg-amber-500"
        >
          <div className="text-3xl font-extrabold text-amber-600 tabular-nums">{pendingCount}</div>
          <p className="text-xs text-slate-400 mt-2">Novos cadastros para numerar</p>
        </Card>

        <Card
          label="Ocorrências via QR Code"
          icon={<BellRing className="w-4 h-4" />}
          iconClass="bg-rose-50 text-rose-600 ring-rose-100"
          accentClass="bg-rose-500"
        >
          <div className="text-3xl font-extrabold text-rose-600 tabular-nums">{openIncidentCount}</div>
          <p className="text-xs text-slate-400 mt-2">Notificações pendentes de baixa</p>
        </Card>
      </div>
    </div>
  );
}

export default KpiCards;
