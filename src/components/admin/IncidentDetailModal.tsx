import { X } from 'lucide-react';
import { safeHttpUrl } from '../../lib/safeUrl';
import type { IncidentWithBike } from './OccurrencesTab';

interface IncidentDetailModalProps {
  incident: IncidentWithBike;
  onClose: () => void;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function IncidentDetailModal({ incident, onClose }: IncidentDetailModalProps) {
  const photoUrl = safeHttpUrl(incident.photo_url);

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-wrap items-center gap-2 pr-6">
          <span className="bg-slate-900 text-white font-extrabold text-[11px] px-2 py-0.5 rounded-md">
            BIKE {incident.bikes?.tag_number ?? '—'}
          </span>
          <span className="text-xs font-bold text-slate-800">{incident.bikes?.unit_block ?? ''}</span>
        </div>

        {(incident.bikes?.owner_name || incident.bikes?.owner_whatsapp) && (
          <p className="text-[11px] text-slate-600 flex flex-wrap items-center gap-1">
            {incident.bikes?.owner_name && <span>{incident.bikes.owner_name}</span>}
            {incident.bikes?.owner_whatsapp && <span>{incident.bikes.owner_whatsapp}</span>}
          </p>
        )}

        <div className="space-y-1">
          <p className="text-[11px] text-slate-400">
            Reportado em: {formatTimestamp(incident.created_at)}
          </p>
          <p className="text-sm font-semibold text-rose-800">{incident.reason}</p>
          {incident.notes && <p className="text-xs text-slate-600 italic">"{incident.notes}"</p>}
        </div>

        {photoUrl && (
          <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={photoUrl}
              alt="Foto da ocorrência"
              className="w-full max-h-72 rounded-xl object-cover border border-slate-200"
            />
          </a>
        )}

        {incident.status === 'resolved' && (
          <div className="space-y-1 pt-3 border-t border-slate-100">
            {incident.resolved_at && (
              <p className="text-[11px] text-slate-400">
                Resolvida em: {formatTimestamp(incident.resolved_at)}
              </p>
            )}
            {incident.resolution && (
              <p className="text-sm font-semibold text-emerald-700">{incident.resolution}</p>
            )}
            {incident.resolution_notes && (
              <p className="text-xs text-slate-600 italic">"{incident.resolution_notes}"</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default IncidentDetailModal;
