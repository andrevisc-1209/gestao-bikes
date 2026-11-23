import { CheckCircle2, ImagePlus } from 'lucide-react';

interface PhotoAttachFieldProps {
  id: string;
  file: File | null;
  onChange: (file: File | null) => void;
  label: string;
  required?: boolean;
}

function PhotoAttachField({ id, file, onChange, label, required }: PhotoAttachFieldProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null);
  }

  return (
    <label
      htmlFor={id}
      className={`cursor-pointer border-2 border-dashed rounded-2xl p-5 text-center transition-all flex items-center justify-center gap-3 ${
        file
          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700'
          : 'border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40'
      }`}
    >
      {file ? (
        <>
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          <div className="text-left">
            <p className="text-xs font-bold">{file.name} anexada com sucesso!</p>
            <p className="text-[11px] text-emerald-600">Clique novamente se desejar substituir</p>
          </div>
        </>
      ) : (
        <div>
          <div className="w-11 h-11 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-2 text-emerald-600">
            <ImagePlus className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-700">
            Clique para anexar uma foto lateral da bike (opcional)
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
        </div>
      )}
      <input
        type="file"
        id={id}
        accept="image/*"
        required={required}
        className="hidden"
        onChange={handleChange}
      />
    </label>
  );
}

export default PhotoAttachField;
