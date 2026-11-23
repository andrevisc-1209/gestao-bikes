import { useState } from 'react';
import { ClipboardList, Bike as BikeIcon, ImagePlus, CheckCircle2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { compressAndUpload } from '../lib/imageCompression';

const BLOCK_OPTIONS = ['Bloco A', 'Bloco B', 'Bloco C', 'Torre Única'];

function RegisterPage() {
  const [block, setBlock] = useState(BLOCK_OPTIONS[0]);
  const [apartment, setApartment] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [brandModel, setBrandModel] = useState('');
  const [color, setColor] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!photoFile) {
      setPhotoError('Clique na área tracejada para anexar a foto da bike.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setPhotoError(null);

    const result = await compressAndUpload(photoFile, 'bikes');
    if ('error' in result) {
      setPhotoError(result.error);
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('bikes').insert({
      unit_block: `${block} • Apto ${apartment.trim()}`,
      owner_name: ownerName.trim(),
      owner_whatsapp: whatsapp.trim(),
      brand_model: brandModel.trim(),
      color: color.trim(),
      photo_url: result.url,
      status: 'pending',
    });

    setSubmitting(false);

    if (error) {
      setSubmitError('Não foi possível enviar o cadastro. Tente novamente.');
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto p-5">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
          <h1 className="font-bold text-slate-800 text-sm mb-1">Cadastro enviado!</h1>
          <p className="text-xs text-slate-500">
            A administração validará o cadastro e disponibilizará o adesivo numerado de
            patrimônio na portaria para colagem no quadro da bicicleta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-6">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ClipboardList className="w-4 h-4" />
            <span>Censo & Identificação</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">Cadastrar Bicicleta Elétrica</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Preencha os dados abaixo para solicitar seu adesivo numerado com QR Code e
            regularizar sua vaga no bicicletário.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              Dados da Unidade e Contato
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="reg-block" className="block text-xs font-semibold text-slate-700 mb-1">
                  Bloco / Torre *
                </label>
                <select
                  id="reg-block"
                  required
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {BLOCK_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reg-apt" className="block text-xs font-semibold text-slate-700 mb-1">
                  Apartamento *
                </label>
                <input
                  type="text"
                  id="reg-apt"
                  required
                  placeholder="Ex: 504"
                  value={apartment}
                  onChange={(e) => setApartment(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp (para alertas) *
                </label>
                <input
                  type="tel"
                  id="reg-phone"
                  required
                  placeholder="(21) 99999-0000"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="reg-owner" className="block text-xs font-semibold text-slate-700 mb-1">
                Nome Completo do Morador *
              </label>
              <input
                type="text"
                id="reg-owner"
                required
                placeholder="Ex: Mariana Costa"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <BikeIcon className="w-3.5 h-3.5" />
              Características da Bicicleta Elétrica
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-model" className="block text-xs font-semibold text-slate-700 mb-1">
                  Marca e Modelo *
                </label>
                <input
                  type="text"
                  id="reg-model"
                  required
                  placeholder="Ex: Sense Impulse E-Trail"
                  value={brandModel}
                  onChange={(e) => setBrandModel(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="reg-color" className="block text-xs font-semibold text-slate-700 mb-1">
                  Cor Predominante *
                </label>
                <input
                  type="text"
                  id="reg-color"
                  required
                  placeholder="Ex: Preta com detalhes verdes"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="reg-photo" className="block text-xs font-semibold text-slate-700 mb-1">
                Foto da Bicicleta (para validação visual) *
              </label>
              <label
                htmlFor="reg-photo"
                className={`cursor-pointer border-2 border-dashed rounded-2xl p-5 text-center transition-all flex items-center justify-center gap-3 ${
                  photoFile
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700'
                    : 'border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40'
                }`}
              >
                {photoFile ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <div className="text-left">
                      <p className="text-xs font-bold">{photoFile.name} anexada com sucesso!</p>
                      <p className="text-[11px] text-emerald-600">
                        Clique novamente se desejar substituir
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="w-11 h-11 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-2 text-emerald-600">
                      <ImagePlus className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">
                      Clique para anexar uma foto lateral da bike
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      JPG ou PNG • Ajuda a evitar troca indevida de adesivo
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  id="reg-photo"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
              {photoError && <p className="text-xs text-red-600 mt-2">{photoError}</p>}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
            <p>
              Após o envio, a administração validará o cadastro e disponibilizará o{' '}
              <strong>adesivo numerado de patrimônio</strong> na portaria para colagem no quadro
              da bicicleta.
            </p>
          </div>

          {submitError && <p className="text-xs text-red-600">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{submitting ? 'Enviando...' : 'Enviar Cadastro e Solicitar Adesivo'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default RegisterPage;
