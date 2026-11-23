import { useState } from 'react';
import { Warehouse, X } from 'lucide-react';

interface CapacityModalProps {
  currentCapacity: number;
  onSave: (capacity: number) => void;
  onClose: () => void;
}

function CapacityModal({ currentCapacity, onSave, onClose }: CapacityModalProps) {
  const [value, setValue] = useState(String(currentCapacity));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onSave(parsed);
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <Warehouse className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-800">Capacidade do Bicicletário</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="total-capacity" className="text-xs font-semibold text-slate-500">
              Vagas totais
            </label>
            <input
              id="total-capacity"
              type="number"
              min={0}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="mt-1 w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-600 px-3.5 py-2.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CapacityModal;
