import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Bike as BikeIcon,
  CheckCircle2,
  CircleSlash,
  MessageSquare,
  PlugZap,
  Send,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { compressAndUpload } from '../lib/imageCompression';
import { INCIDENT_REASONS } from '../lib/reasons';
import { buildWhatsappPreview, type WhatsappPreviewData } from '../lib/whatsapp';
import type { PublicBike } from '../types/database';
import PhotoAttachField from '../components/PhotoAttachField';

const REASON_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'alert-triangle': AlertTriangle,
  'circle-slash': CircleSlash,
  'plug-zap': PlugZap,
  'shield-alert': ShieldAlert,
  'message-square': MessageSquare,
};

type LoadState = 'loading' | 'found' | 'not-found';

function PublicBikePage() {
  const { tagNumber } = useParams<{ tagNumber: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [bike, setBike] = useState<PublicBike | null>(null);

  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [whatsappPreview, setWhatsappPreview] = useState<WhatsappPreviewData | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBike() {
      if (!tagNumber) {
        setLoadState('not-found');
        return;
      }

      const { data, error } = await supabase.rpc('get_public_bike_by_tag', {
        p_tag: tagNumber,
      });

      if (!active) return;

      if (error) {
        setLoadState('not-found');
        return;
      }

      // get_public_bike_by_tag is `returns table(...)`, so supabase-js
      // always returns an array here (empty if no match) — never a bare object.
      const row = data?.[0];
      if (!row) {
        setLoadState('not-found');
        return;
      }

      setBike(row as PublicBike);
      setLoadState('found');
    }

    loadBike();

    return () => {
      active = false;
    };
  }, [tagNumber]);

  function handlePhotoChange(file: File | null) {
    setPhotoFile(file);
    setPhotoError(null);
  }

  async function handleSubmit() {
    if (!bike || !selectedReasonId) return;

    const selectedReason = INCIDENT_REASONS.find((r) => r.id === selectedReasonId);
    if (!selectedReason) return;

    setSubmitting(true);
    setSubmitError(null);
    setPhotoError(null);

    let photoUrl: string | null = null;
    if (photoFile) {
      const result = await compressAndUpload(photoFile, 'incidents');
      if ('error' in result) {
        setPhotoError(result.error);
        setSubmitting(false);
        return;
      }
      photoUrl = result.url;
    }

    // This insert is the integration point for a future Edge Function/webhook
    // that actually notifies the owner via WhatsApp — no real send happens here.
    const { error } = await supabase.from('incidents').insert({
      bike_id: bike.id,
      reason: selectedReason.label,
      notes: note.trim() || null,
      photo_url: photoUrl,
      status: 'open',
    });

    setSubmitting(false);

    if (error) {
      setSubmitError('Não foi possível registrar a notificação. Tente novamente.');
      return;
    }

    setWhatsappPreview(
      buildWhatsappPreview(
        'Morador(a)',
        bike.tag_number,
        bike.brand_model,
        selectedReason.label,
        note.trim() || undefined
      )
    );
  }

  if (loadState === 'loading') {
    return (
      <div className="max-w-md mx-auto p-5">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-pulse">
          <div className="h-40 bg-slate-200" />
          <div className="p-5 space-y-3">
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-4 bg-slate-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (loadState === 'not-found') {
    return (
      <div className="max-w-md mx-auto p-5">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h1 className="font-bold text-slate-800 text-sm mb-1">Bike não encontrada</h1>
          <p className="text-xs text-slate-500">
            Bike não encontrada ou cadastro não regularizado.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Se você acabou de escanear um adesivo físico, confirme o número com a administração.
          </p>
        </div>
      </div>
    );
  }

  if (!bike) {
    return null;
  }

  if (whatsappPreview) {
    return (
      <div className="max-w-md mx-auto p-5">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-bold text-slate-800 text-sm mb-3">Notificação enviada</h2>
          <div className="text-xs text-slate-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
            <p>
              Olá, <strong>{whatsappPreview.ownerFirstName}</strong>! Sua bicicleta elétrica{' '}
              <strong>{whatsappPreview.tag}</strong> ({whatsappPreview.model}) recebeu uma
              notificação colaborativa no bicicletário:
            </p>
            <p className="mt-2">
              📌 <strong>Motivo:</strong> {whatsappPreview.reason}
            </p>
            {whatsappPreview.note && (
              <p className="mt-2">
                💬 <strong>Obs.:</strong> &quot;{whatsappPreview.note}&quot;
              </p>
            )}
            <p className="mt-2">Por favor, verifique assim que possível. Obrigado pela colaboração!</p>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            Pronto! Você já pode fechar esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-5">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-5 relative">
          <div className="flex items-center justify-between mb-4">
            <span className="bg-emerald-500 text-slate-950 font-extrabold text-sm px-3 py-1 rounded-lg tracking-wide shadow">
              BIKE #{bike.tag_number}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Cadastro Regular
            </span>
          </div>

          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="w-20 h-20 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center shrink-0 text-emerald-400">
              <Zap className="w-5 h-5 mb-0.5 text-amber-400" />
              <BikeIcon className="w-9 h-9" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Identificação Visual
              </p>
              <h2 className="font-bold text-base text-white truncate">{bike.brand_model}</h2>
              <p className="text-xs text-slate-300 mt-0.5">Cor: {bike.color}</p>
            </div>
          </div>

          <div className="mt-3.5 flex items-center gap-2 text-[11px] text-slate-300 bg-slate-950/50 px-3 py-2 rounded-xl border border-slate-700/60">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Privacidade protegida: nome e apartamento do dono não são exibidos publicamente.</span>
          </div>
        </div>

        <div className="p-5">
          <h3 className="font-bold text-slate-800 text-sm mb-1">
            Notificar proprietário sobre esta bike
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Selecione o motivo abaixo para enviar um alerta automático e discreto ao dono:
          </p>

          <div className="space-y-2 mb-4">
            {INCIDENT_REASONS.map((reason) => {
              const Icon = REASON_ICONS[reason.icon] ?? MessageSquare;
              const isSelected = selectedReasonId === reason.id;
              return (
                <button
                  key={reason.id}
                  type="button"
                  onClick={() => setSelectedReasonId(reason.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 group ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">
                    {reason.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Observação rápida (opcional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: Está encostada na saída do corredor B..."
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <PhotoAttachField
              id="incident-photo"
              file={photoFile}
              onChange={handlePhotoChange}
              prompt="Clique para anexar uma foto do problema (opcional)"
              hint="Ajuda a confirmar o problema reportado"
            />
            {photoError && <p className="text-xs text-red-600">{photoError}</p>}
          </div>

          {submitError && <p className="text-xs text-red-600 mb-3">{submitError}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedReasonId || submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Enviando...' : 'Enviar Notificação ao Proprietário'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default PublicBikePage;
