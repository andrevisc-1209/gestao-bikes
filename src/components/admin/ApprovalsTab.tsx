import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Ban, CheckCircle, Tag, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { safeHttpUrl } from '../../lib/safeUrl';
import type { Bike } from '../../types/database';
import BikeDetailModal from './BikeDetailModal';
import RejectBikeModal from './RejectBikeModal';

interface ApprovalsTabProps {
  onApproved: () => void;
}

function ApprovalsTab({ onApproved }: ApprovalsTabProps) {
  const [pendingBikes, setPendingBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [assignedTag, setAssignedTag] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<{ bikeId: string; message: string } | null>(
    null
  );
  const [viewingBike, setViewingBike] = useState<Bike | null>(null);
  const [rejectingBike, setRejectingBike] = useState<Bike | null>(null);

  async function loadPendingBikes() {
    setLoading(true);
    const { data } = await supabase
      .from('bikes')
      .select('*')
      .eq('status', 'pending')
      .order('created_at');

    setPendingBikes((data as Bike[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadPendingBikes();
  }, []);

  async function handleApprove(bikeId: string) {
    setApprovingId(bikeId);
    setApproveError(null);
    const { data, error } = await supabase.rpc('approve_bike', { p_bike_id: bikeId });

    if (!error && data) {
      setAssignedTag(data as string);
      onApproved();
      await loadPendingBikes();
    } else if (error?.message?.includes('Nenhum adesivo disponível')) {
      setApproveError({
        bikeId,
        message: 'Nenhum adesivo disponível no lote. Gere mais adesivos na aba Adesivos.',
      });
    } else {
      setApproveError({
        bikeId,
        message: error?.message || 'Não foi possível atribuir o adesivo. Tente novamente.',
      });
    }

    setApprovingId(null);
  }

  if (loading) {
    return <p className="text-xs text-slate-400 p-5">Carregando cadastros pendentes...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <h2 className="font-bold text-slate-800 text-sm sm:text-base">
              Cadastros Pendentes de Aprovação
            </h2>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {pendingBikes.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500/70" />
              <p className="text-xs font-semibold text-slate-600">Nenhum cadastro pendente</p>
            </div>
          ) : (
            pendingBikes.map((bike) => (
              <div
                key={bike.id}
                className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setViewingBike(bike)}
                >
                  {safeHttpUrl(bike.photo_url) ? (
                    <img
                      src={safeHttpUrl(bike.photo_url) ?? undefined}
                      alt={bike.brand_model}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200" />
                  )}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{bike.unit_block}</span>
                      <span className="text-[11px] text-slate-400">• {bike.owner_name}</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {bike.brand_model} • {bike.color}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setRejectingBike(bike);
                    }}
                    disabled={approvingId === bike.id}
                    className="shrink-0 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Recusar</span>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleApprove(bike.id);
                    }}
                    disabled={approvingId === bike.id}
                    className="shrink-0 bg-white hover:bg-emerald-600 text-slate-700 hover:text-white border border-slate-200 hover:border-emerald-600 text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>{approvingId === bike.id ? 'Atribuindo...' : 'Atribuir Adesivo'}</span>
                  </button>
                  </div>
                  {approveError?.bikeId === bike.id && (
                    <p className="text-[11px] font-semibold text-rose-600 text-right">
                      {approveError.message}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {assignedTag && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 text-center relative">
            <button
              type="button"
              onClick={() => setAssignedTag(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-slate-800">Adesivo Atribuído</h3>
            <p className="text-sm text-slate-500">
              Imprima e cole este QR Code na bicicleta.
            </p>
            <div className="bg-slate-900 text-white font-extrabold text-sm px-3 py-1.5 rounded-lg inline-block">
              BIKE {assignedTag}
            </div>
            <div className="flex justify-center p-4 bg-white">
              <QRCodeSVG
                value={`${window.location.origin}${window.location.pathname}#/b/${assignedTag}`}
                size={180}
              />
            </div>
          </div>
        </div>
      )}

      {rejectingBike && (
        <RejectBikeModal
          bike={rejectingBike}
          onClose={() => setRejectingBike(null)}
          onRejected={() => {
            // Drop it from the queue in place: reloading would swap the tab
            // for its loading state and close the modal before the admin
            // sees the WhatsApp button.
            setPendingBikes((bikes) => bikes.filter((b) => b.id !== rejectingBike.id));
            onApproved();
          }}
        />
      )}

      {viewingBike && (
        <BikeDetailModal
          bike={viewingBike}
          onClose={() => setViewingBike(null)}
          onSaved={async () => {
            setViewingBike(null);
            await loadPendingBikes();
          }}
        />
      )}
    </div>
  );
}

export default ApprovalsTab;
