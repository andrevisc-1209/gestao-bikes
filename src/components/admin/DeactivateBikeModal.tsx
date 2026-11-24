import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DEACTIVATION_REASONS } from '../../lib/bikeOptions';

interface DeactivateBikeModalProps {
  bike: { id: string; tag_number: string | null };
  onClose: () => void;
  onDeactivated: () => void;
}

function DeactivateBikeModal({ bike, onClose, onDeactivated }: DeactivateBikeModalProps) {
  const [reason, setReason] = useState(DEACTIVATION_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc('deactivate_bike', {
      p_bike_id: bike.id,
      p_reason: reason,
      p_notes: notes,
    });

    if (!rpcError) {
      onDeactivated();
    } else {
      setError(rpcError.message || 'Não foi possível dar baixa na bicicleta. Tente novamente.');
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

        <h2 className="font-bold text-slate-800">Dar baixa na bike #{bike.tag_number}</h2>

        <div className="space-y-3">
          <div>
            <label htmlFor="dbm-reason" className="block text-xs font-semibold text-slate-600 mb-1">
              Motivo
            </label>
            <select
              id="dbm-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {DEACTIVATION_REASONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dbm-notes" className="block text-xs font-semibold text-slate-600 mb-1">
              Observações
            </label>
            <textarea
              id="dbm-notes"
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

export default DeactivateBikeModal;
