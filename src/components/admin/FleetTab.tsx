import { useEffect, useMemo, useState } from 'react';
import { Bike as BikeIcon, Search, Warehouse } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Bike } from '../../types/database';
import CapacityModal from './CapacityModal';

type FleetBike = Pick<
  Bike,
  'id' | 'tag_number' | 'unit_block' | 'owner_name' | 'brand_model' | 'color' | 'status'
>;

interface FleetTabProps {
  currentCapacity?: number;
  settingsId?: string;
  onCapacityChanged?: () => void;
}

function FleetTab({ currentCapacity = 0, settingsId, onCapacityChanged = () => {} }: FleetTabProps) {
  const [bikes, setBikes] = useState<FleetBike[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<{ bikeId: string; message: string } | null>(
    null
  );
  const [capacityModalOpen, setCapacityModalOpen] = useState(false);
  const [capacityError, setCapacityError] = useState<string | null>(null);

  async function loadBikes() {
    setLoading(true);
    const { data } = await supabase.from('bikes').select('*').order('tag_number');
    const fetched = (data as FleetBike[] | null) ?? [];
    setBikes(fetched.filter((bike) => bike.status !== 'pending'));
    setLoading(false);
  }

  useEffect(() => {
    loadBikes();
  }, []);

  const filteredBikes = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return bikes;
    return bikes.filter((bike) => {
      const tagStr = (bike.tag_number || 'pendente').toLowerCase();
      return (
        tagStr.includes(query) ||
        bike.unit_block.toLowerCase().includes(query) ||
        bike.owner_name.toLowerCase().includes(query) ||
        bike.brand_model.toLowerCase().includes(query)
      );
    });
  }, [bikes, search]);

  async function handleDeactivate(bikeId: string) {
    setDeactivatingId(bikeId);
    setDeactivateError(null);
    const { error } = await supabase.from('bikes').update({ status: 'inactive' }).eq('id', bikeId);

    if (!error) {
      onCapacityChanged();
      await loadBikes();
    } else {
      setDeactivateError({
        bikeId,
        message: error.message || 'Não foi possível dar baixa na bicicleta. Tente novamente.',
      });
    }

    setDeactivatingId(null);
  }

  async function handleSaveCapacity(capacity: number) {
    setCapacityError(null);
    if (!settingsId) {
      setCapacityError('Configuração do condomínio não encontrada.');
      return;
    }

    const { error } = await supabase
      .from('condo_settings')
      .update({ total_capacity: capacity })
      .eq('id', settingsId);

    if (!error) {
      setCapacityModalOpen(false);
      onCapacityChanged();
    } else {
      setCapacityError(error.message || 'Não foi possível salvar a capacidade. Tente novamente.');
    }
  }

  if (loading) {
    return <p className="text-xs text-slate-400 p-5">Carregando frota...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Inventário de Bikes</h2>
            <p className="text-xs text-slate-500">Busque por adesivo, unidade ou morador</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar #014, Bloco A, Nome..."
                className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setCapacityModalOpen(true)}
              className="shrink-0 flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors"
            >
              <Warehouse className="w-4 h-4" />
              <span>Capacidade</span>
            </button>
          </div>
        </div>

        {capacityError && (
          <p className="px-5 pt-3 text-[11px] font-semibold text-rose-600">{capacityError}</p>
        )}

        {filteredBikes.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">Nenhuma bicicleta encontrada.</p>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-100">
              {filteredBikes.map((bike) => {
                const isInactive = bike.status === 'inactive';
                return (
                  <div key={bike.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-block bg-slate-900 text-emerald-400 font-extrabold text-xs px-2.5 py-1 rounded-lg tracking-wide">
                        {bike.tag_number ? `#${bike.tag_number}` : 'Sem Adesivo'}
                      </span>
                      {isInactive ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 font-semibold text-xs">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          Inativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Ativa
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <BikeIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{bike.brand_model}</p>
                        <p className="text-[11px] text-slate-400">{bike.color}</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{bike.unit_block}</p>
                      <p className="text-[11px] text-slate-500">{bike.owner_name}</p>
                    </div>
                    {!isInactive && (
                      <div>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(bike.id)}
                          disabled={deactivatingId === bike.id}
                          className="w-full text-center text-rose-600 font-semibold text-xs py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors disabled:opacity-50"
                        >
                          {deactivatingId === bike.id ? 'Processando...' : 'Dar Baixa'}
                        </button>
                        {deactivateError?.bikeId === bike.id && (
                          <p className="text-[11px] font-semibold text-rose-600 mt-1">
                            {deactivateError.message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Adesivo</th>
                    <th className="py-3 px-4">Unidade / Morador</th>
                    <th className="py-3 px-4">Bicicleta</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredBikes.map((bike) => {
                    const isInactive = bike.status === 'inactive';
                    return (
                      <tr key={bike.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="inline-block bg-slate-900 text-emerald-400 font-extrabold text-xs px-2.5 py-1 rounded-lg tracking-wide">
                            {bike.tag_number ? `#${bike.tag_number}` : 'Sem Adesivo'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-800">{bike.unit_block}</p>
                          <p className="text-[11px] text-slate-500">{bike.owner_name}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                              <BikeIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{bike.brand_model}</p>
                              <p className="text-[11px] text-slate-400">{bike.color}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {isInactive ? (
                            <span className="inline-flex items-center gap-1.5 text-slate-500 font-semibold">
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              Inativa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Ativa
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {isInactive ? (
                            <span className="text-slate-400 font-medium px-2 py-1">—</span>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeactivate(bike.id)}
                                disabled={deactivatingId === bike.id}
                                className="text-slate-400 hover:text-rose-600 font-medium px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50"
                              >
                                {deactivatingId === bike.id ? 'Processando...' : 'Dar Baixa'}
                              </button>
                              {deactivateError?.bikeId === bike.id && (
                                <p className="text-[11px] font-semibold text-rose-600">
                                  {deactivateError.message}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {capacityModalOpen && (
        <CapacityModal
          currentCapacity={currentCapacity}
          onSave={handleSaveCapacity}
          onClose={() => setCapacityModalOpen(false)}
        />
      )}
    </div>
  );
}

export default FleetTab;
