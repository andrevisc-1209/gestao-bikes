import { useState } from 'react';
import { ClipboardList, Bike as BikeIcon, CheckCircle2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { compressAndUpload } from '../lib/imageCompression';
import PhotoAttachField from '../components/PhotoAttachField';
import { BLOCK_OPTIONS, OTHER_BRAND, OTHER_MODEL, BRAND_MODELS, BRAND_OPTIONS, OTHER_COLOR, COLOR_OPTIONS } from '../lib/bikeOptions';

function RegisterPage() {
  const [block, setBlock] = useState(BLOCK_OPTIONS[0]);
  const [apartment, setApartment] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [brand, setBrand] = useState(BRAND_OPTIONS[0]);
  const [model, setModel] = useState(BRAND_MODELS[BRAND_OPTIONS[0]][0]);
  const [customBrand, setCustomBrand] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [customColor, setCustomColor] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handlePhotoChange(file: File | null) {
    setPhotoFile(file);
    setPhotoError(null);
  }

  const isOtherBrand = brand === OTHER_BRAND;
  const modelOptions = isOtherBrand ? [] : [...BRAND_MODELS[brand], OTHER_MODEL];
  const isOtherModel = model === OTHER_MODEL;

  function handleBrandChange(nextBrand: string) {
    setBrand(nextBrand);
    setModel(nextBrand === OTHER_BRAND ? '' : BRAND_MODELS[nextBrand][0]);
    setCustomModel('');
  }

  const brandModel = isOtherBrand
    ? customBrand.trim()
    : `${brand} ${isOtherModel ? customModel.trim() : model}`.trim();

  const isOtherColor = color === OTHER_COLOR;
  const finalColor = isOtherColor ? customColor.trim() : color;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSubmitting(true);
    setSubmitError(null);
    setPhotoError(null);

    let photoUrl: string | null = null;
    if (photoFile) {
      const result = await compressAndUpload(photoFile, 'bikes');
      if ('error' in result) {
        setPhotoError(result.error);
        setSubmitting(false);
        return;
      }
      photoUrl = result.url;
    }

    const { error } = await supabase.from('bikes').insert({
      unit_block: `${block} • Apto ${apartment.trim()}`,
      owner_name: ownerName.trim(),
      owner_whatsapp: whatsapp.trim(),
      brand_model: brandModel.trim(),
      color: finalColor.trim(),
      photo_url: photoUrl,
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
                <label htmlFor="reg-brand" className="block text-xs font-semibold text-slate-700 mb-1">
                  Marca *
                </label>
                <select
                  id="reg-brand"
                  required
                  value={brand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {BRAND_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {isOtherBrand && (
                  <input
                    type="text"
                    required
                    placeholder="Digite a marca e o modelo da bike"
                    value={customBrand}
                    onChange={(e) => setCustomBrand(e.target.value)}
                    className="mt-2 w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                )}
              </div>
              <div>
                <label htmlFor="reg-model" className="block text-xs font-semibold text-slate-700 mb-1">
                  Modelo *
                </label>
                {!isOtherBrand && (
                  <select
                    id="reg-model"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {modelOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
                {!isOtherBrand && isOtherModel && (
                  <input
                    type="text"
                    required
                    placeholder="Digite o modelo da bike"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="mt-2 w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                )}
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="reg-color" className="block text-xs font-semibold text-slate-700 mb-1">
                Cor Predominante *
              </label>
              <select
                id="reg-color"
                required
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {COLOR_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {isOtherColor && (
                <input
                  type="text"
                  required
                  placeholder="Digite a cor da bike"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="mt-2 w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>

            <div className="mt-4">
              <label htmlFor="reg-photo" className="block text-xs font-semibold text-slate-700 mb-1">
                Foto da Bicicleta (para validação visual)
              </label>
              <PhotoAttachField
                id="reg-photo"
                file={photoFile}
                onChange={handlePhotoChange}
                prompt="Clique para anexar uma foto lateral da bike (opcional)"
                hint="JPG ou PNG • Ajuda a evitar troca indevida de adesivo"
              />
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
