import { useEffect, useState } from 'react';
import { Bike as BikeIcon, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Bike } from '../../types/database';
import { BLOCK_OPTIONS, COLOR_OPTIONS, OTHER_COLOR } from '../../lib/bikeOptions';
import { formatBrazilPhone } from '../../lib/phone';

interface BikeDetailModalProps {
  bike: Bike;
  onClose: () => void;
  onSaved: (updated: Bike) => void;
}

interface DeactivationInfo {
  edited_at: string;
  reason: string | null;
  notes: string | null;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const UNIT_BLOCK_PATTERN = /^(.*) • Apto (.*)$/;

function splitUnitBlock(unitBlock: string): { block: string; apartment: string } {
  const match = unitBlock.match(UNIT_BLOCK_PATTERN);
  if (match) {
    return { block: match[1], apartment: match[2] };
  }
  return { block: BLOCK_OPTIONS[0], apartment: unitBlock };
}

function BikeDetailModal({ bike, onClose, onSaved }: BikeDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const initialSplit = splitUnitBlock(bike.unit_block);
  const initialColorKnown = COLOR_OPTIONS.includes(bike.color) && bike.color !== OTHER_COLOR;

  const [deactivation, setDeactivation] = useState<DeactivationInfo | null>(null);

  const [block, setBlock] = useState(initialSplit.block);
  const [apartment, setApartment] = useState(initialSplit.apartment);
  const [ownerName, setOwnerName] = useState(bike.owner_name);
  const [ownerWhatsapp, setOwnerWhatsapp] = useState(bike.owner_whatsapp);
  const [brandModel, setBrandModel] = useState(bike.brand_model);
  const [color, setColor] = useState(initialColorKnown ? bike.color : OTHER_COLOR);
  const [customColor, setCustomColor] = useState(initialColorKnown ? '' : bike.color);

  useEffect(() => {
    setDeactivation(null);
    if (bike.status !== 'inactive') {
      return;
    }

    let cancelled = false;

    async function loadDeactivation() {
      const { data, error } = await supabase
        .from('bikes_history')
        .select('edited_at, reason, notes')
        .eq('bike_id', bike.id)
        .eq('action', 'deactivate')
        .order('edited_at', { ascending: false })
        .limit(1)
        .single();

      if (!cancelled) {
        setDeactivation(!error && data ? data : null);
      }
    }

    loadDeactivation();

    return () => {
      cancelled = true;
    };
  }, [bike.id, bike.status]);

  function resetEditState() {
    const split = splitUnitBlock(bike.unit_block);
    const colorKnown = COLOR_OPTIONS.includes(bike.color) && bike.color !== OTHER_COLOR;
    setBlock(split.block);
    setApartment(split.apartment);
    setOwnerName(bike.owner_name);
    setOwnerWhatsapp(bike.owner_whatsapp);
    setBrandModel(bike.brand_model);
    setColor(colorKnown ? bike.color : OTHER_COLOR);
    setCustomColor(colorKnown ? '' : bike.color);
    setSaveError(null);
  }

  function handleEdit() {
    resetEditState();
    setEditing(true);
  }

  function handleCancel() {
    resetEditState();
    setEditing(false);
  }

  async function handleSave() {
    const trimmedApartment = apartment.trim();
    const trimmedOwnerName = ownerName.trim();
    const trimmedOwnerWhatsapp = ownerWhatsapp.trim();
    const trimmedBrandModel = brandModel.trim();
    const trimmedCustomColor = customColor.trim();
    const p_color = color === OTHER_COLOR ? trimmedCustomColor : color;

    if (!trimmedApartment || !trimmedOwnerName || !trimmedOwnerWhatsapp || !trimmedBrandModel || !p_color) {
      setSaveError('Preencha todos os campos antes de salvar.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const p_unit_block = `${block} • Apto ${trimmedApartment}`;

    const { error } = await supabase.rpc('update_bike_registration', {
      p_bike_id: bike.id,
      p_unit_block,
      p_owner_name: trimmedOwnerName,
      p_owner_whatsapp: trimmedOwnerWhatsapp,
      p_brand_model: trimmedBrandModel,
      p_color,
    });

    if (!error) {
      onSaved({
        ...bike,
        unit_block: p_unit_block,
        owner_name: trimmedOwnerName,
        owner_whatsapp: trimmedOwnerWhatsapp,
        brand_model: trimmedBrandModel,
        color: p_color,
      });
      setEditing(false);
    } else {
      setSaveError(error.message || 'Não foi possível salvar as alterações. Tente novamente.');
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

        {!editing ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {bike.photo_url ? (
                <img
                  src={bike.photo_url}
                  alt={bike.brand_model}
                  className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                  <BikeIcon className="w-6 h-6" />
                </div>
              )}
              <div>
                <p className="font-bold text-slate-800">{bike.unit_block}</p>
                <p className="text-xs text-slate-500">{bike.owner_name}</p>
              </div>
            </div>
            <div className="space-y-1 text-sm text-slate-700">
              <p>{bike.owner_whatsapp}</p>
              <p>{bike.brand_model}</p>
              <p>{bike.color}</p>
            </div>
            <div className="space-y-0.5 text-xs text-slate-500">
              <p>Cadastrado em: {formatTimestamp(bike.created_at)}</p>
              {deactivation && (
                <>
                  <p>Baixa em: {formatTimestamp(deactivation.edited_at)}</p>
                  <p>
                    Motivo: <span>{deactivation.reason}</span>
                  </p>
                  {deactivation.notes && <p>{deactivation.notes}</p>}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleEdit}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
            >
              Editar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="bdm-block" className="block text-xs font-semibold text-slate-600 mb-1">
                Bloco
              </label>
              <select
                id="bdm-block"
                value={block}
                onChange={(event) => setBlock(event.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {BLOCK_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bdm-apartment" className="block text-xs font-semibold text-slate-600 mb-1">
                Apartamento
              </label>
              <input
                id="bdm-apartment"
                type="text"
                value={apartment}
                onChange={(event) => setApartment(event.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="bdm-owner-name" className="block text-xs font-semibold text-slate-600 mb-1">
                Nome do morador
              </label>
              <input
                id="bdm-owner-name"
                type="text"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="bdm-owner-whatsapp" className="block text-xs font-semibold text-slate-600 mb-1">
                WhatsApp
              </label>
              <input
                id="bdm-owner-whatsapp"
                type="text"
                value={formatBrazilPhone(ownerWhatsapp)}
                onChange={(event) => setOwnerWhatsapp(event.target.value.replace(/\D/g, '').slice(0, 11))}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="bdm-brand-model" className="block text-xs font-semibold text-slate-600 mb-1">
                Marca / Modelo
              </label>
              <input
                id="bdm-brand-model"
                type="text"
                value={brandModel}
                onChange={(event) => setBrandModel(event.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="bdm-color" className="block text-xs font-semibold text-slate-600 mb-1">
                Cor
              </label>
              <select
                id="bdm-color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {COLOR_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            {color === OTHER_COLOR && (
              <div>
                <label htmlFor="bdm-custom-color" className="block text-xs font-semibold text-slate-600 mb-1">
                  Especifique a cor
                </label>
                <input
                  id="bdm-custom-color"
                  type="text"
                  value={customColor}
                  onChange={(event) => setCustomColor(event.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {saveError && <p className="text-[11px] font-semibold text-rose-600">{saveError}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BikeDetailModal;
