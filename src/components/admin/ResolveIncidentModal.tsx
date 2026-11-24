import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { INCIDENT_RESOLUTION_REASONS } from '../../lib/bikeOptions';

interface ResolveIncidentModalProps {
  incident: { id: string };
  onClose: () => void;
  onResolved: () => void;
}

function ResolveIncidentModal({ incident, onClose, onResolved }: ResolveIncidentModalProps) {
  const [reason, setReason] = useState(INCIDENT_RESOLUTION_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);

    const { data, error: updateError } = await supabase
      .from('incidents')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution: reason,
        resolution_notes: notes,
      })
      .eq('id', incident.id)
      .select();

    if (updateError) {
      setError(updateError.message || 'Não foi possível resolver a ocorrência. Tente novamente.');
    } else if (!data || data.length === 0) {
      setError('Não foi possível resolver — a ocorrência já pode ter sido resolvida em outra sessão.');
    } else {
      onResolved();
    }

    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-bold text-slate-800">Resolver ocorrência</h2>

        <div className="space-y-3">
          <div>
            <label htmlFor="rim-reason" className="block text-xs font-semibold text-slate-600 mb-1">
              Motivo da Resolução
            </label>
            <select
              id="rim-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {INCIDENT_RESOLUTION_REASONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rim-notes" className="block text-xs font-semibold text-slate-600 mb-1">
              Observações
            </label>
            <textarea
              id="rim-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={3}
            />
          </div>

          {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Confirmando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResolveIncidentModal;
