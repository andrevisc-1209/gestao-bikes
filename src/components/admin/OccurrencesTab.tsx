import { useEffect, useState } from 'react';
import { Check, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Incident } from '../../types/database';

type IncidentWithBike = Incident & {
  bikes: { tag_number: string | null; unit_block: string } | null;
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface OccurrencesTabProps {
  onResolved?: () => void;
}

function OccurrencesTab({ onResolved = () => {} }: OccurrencesTabProps) {
  const [incidents, setIncidents] = useState<IncidentWithBike[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  async function loadIncidents() {
    setLoading(true);
    const { data } = await supabase
      .from('incidents')
      .select('*, bikes(tag_number, unit_block)')
      .order('created_at', { ascending: false });

    setIncidents((data as IncidentWithBike[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadIncidents();
  }, []);

  async function handleResolve(id: string) {
    if (!window.confirm('Marcar esta ocorrência como resolvida?')) return;

    setResolvingId(id);
    await supabase
      .from('incidents')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);

    await loadIncidents();
    onResolved();
    setResolvingId(null);
  }

  if (loading) {
    return <p className="text-xs text-slate-400 p-5">Carregando ocorrências...</p>;
  }

  const openIncidents = incidents.filter((i) => i.status === 'open');
  const resolvedIncidents = incidents.filter((i) => i.status === 'resolved');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <h2 className="font-bold text-slate-800 text-sm sm:text-base">
              Ocorrências Reportadas pelo QR Code
            </h2>
          </div>
          <span className="text-xs text-slate-400">Tempo real</span>
        </div>
        <div className="p-5 space-y-3">
          {openIncidents.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500/70" />
              <p className="text-xs font-semibold text-slate-600">Nenhuma ocorrência em aberto</p>
            </div>
          ) : (
            openIncidents.map((incident) => (
              <div
                key={incident.id}
                className="p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-slate-900 text-white font-extrabold text-[11px] px-2 py-0.5 rounded-md">
                      BIKE {incident.bikes?.tag_number ?? '—'}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {incident.bikes?.unit_block ?? ''}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      • {formatTimestamp(incident.created_at)}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-rose-800">{incident.reason}</p>
                  {incident.notes && (
                    <p className="text-[11px] text-slate-600 italic">"{incident.notes}"</p>
                  )}
                  {incident.photo_url && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                      <ImageIcon className="w-3 h-3" /> Foto anexada
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleResolve(incident.id)}
                  disabled={resolvingId === incident.id}
                  className="shrink-0 bg-white hover:bg-emerald-600 text-slate-700 hover:text-white border border-slate-200 hover:border-emerald-600 text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{resolvingId === incident.id ? 'Resolvendo...' : 'Marcar Resolvida'}</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-sm sm:text-base">Ocorrências Resolvidas</h2>
        </div>
        <div className="p-5 space-y-3">
          {resolvedIncidents.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Nenhuma ocorrência resolvida ainda.</p>
          ) : (
            resolvedIncidents.map((incident) => (
              <div
                key={incident.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-slate-900 text-white font-extrabold text-[11px] px-2 py-0.5 rounded-md">
                      BIKE {incident.bikes?.tag_number ?? '—'}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {incident.bikes?.unit_block ?? ''}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600">{incident.reason}</p>
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold">Resolvida</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default OccurrencesTab;
