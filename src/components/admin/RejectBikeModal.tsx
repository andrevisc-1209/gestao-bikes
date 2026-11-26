import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { REJECTION_REASONS } from '../../lib/bikeOptions';
import { rejectionWhatsappUrl } from '../../lib/rejectionMessage';
import type { Bike } from '../../types/database';

interface RejectBikeModalProps {
  bike: Pick<Bike, 'id' | 'owner_name' | 'owner_whatsapp' | 'brand_model' | 'unit_block'>;
  onClose: () => void;
  onRejected: () => void;
}

function RejectBikeModal({ bike, onClose, onRejected }: RejectBikeModalProps) {
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('reject_bike', {
      p_bike_id: bike.id,
      p_reason: reason,
      p_notes: notes,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message || 'Não foi possível recusar o cadastro. Tente novamente.');
      return;
    }
    setDone(true);
    onRejected();
  }

  const whatsappUrl = done ? rejectionWhatsappUrl(bike, reason, notes) : null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {done ? (
          <div className="space-y-4">
            <h2 className="font-bold text-slate-800">Cadastro recusado</h2>
            <p className="text-sm text-slate-600">
              {bike.owner_name ?? 'O morador'} • {bike.unit_block}. Motivo: <strong>{reason}</strong>.
            </p>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                Avisar morador no WhatsApp
              </a>
            ) : (
              <p className="text-[11px] text-slate-500">Sem WhatsApp cadastrado para avisar o morador.</p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold py-2.5 rounded-xl"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-bold text-slate-800">Recusar cadastro</h2>
            <p className="text-xs text-slate-500">
              {bike.unit_block} • {bike.owner_name} • {bike.brand_model}. O cadastro sai da fila e o
              morador pode se cadastrar de novo.
            </p>
            <div>
              <label htmlFor="rbm-reason" className="block text-xs font-semibold text-slate-600 mb-1">
                Motivo
              </label>
              <select
                id="rbm-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {REJECTION_REASONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rbm-notes" className="block text-xs font-semibold text-slate-600 mb-1">
                Observação (opcional)
              </label>
              <textarea
                id="rbm-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? 'Recusando...' : 'Confirmar recusa'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RejectBikeModal;
