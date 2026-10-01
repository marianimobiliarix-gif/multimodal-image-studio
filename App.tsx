
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ImagePlus, 
  Sparkles, 
  X, 
  Loader2, 
  Maximize, 
  CheckCircle, 
  Download, 
  Layers, 
  Trash2, 
  AlertCircle,
  ImageIcon,
  Smartphone,
  Share2,
  Copy,
  RotateCcw
} from 'lucide-react';
import { PHOTO_STYLES, FASHION_STYLES, MAX_FILES, NUMBER_OF_VARIANTS } from './constants';
import { Base64Image, GenerationResult, AppState } from './types';
import { generateImageVariant } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    files: [],
    base64Images: [],
    prompt: '',
    generatedImages: [],
    isLoading: false,
    error: null,
    successMessage: null,
    selectedPhotoStyle: '',
    selectedFashionStyle: '',
  });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('embed') === 'true') setIsEmbedded(true);

    try {
      const isStandalone =
        (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
        (typeof window !== 'undefined' && (window.navigator as any)?.standalone === true);
      setIsInstalled(!!isStandalone);

      const userAgent = typeof window !== 'undefined' && window.navigator && window.navigator.userAgent ? window.navigator.userAgent.toLowerCase() : '';
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIOSDevice);
    } catch (e) {
      // Ignore in restricted environments
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstalled(true);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleShareClick = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Gemini Multimodal Image Studio',
          url: window.location.href,
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }
    navigator.clipboard.writeText(window.location.href);
    setState(prev => ({ ...prev, successMessage: 'Link copiat în clipboard!' }));
    setTimeout(() => setState(prev => ({ ...prev, successMessage: null })), 2500);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<Base64Image> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve({ data: base64String, mimeType: file.type });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
    if (selectedFiles.length === 0) return;

    setState(prev => ({ ...prev, error: null, successMessage: null }));
    const validFiles = selectedFiles.filter((file: File) => file.type.startsWith('image/'));
    const combinedFiles = [...state.files, ...validFiles].slice(0, MAX_FILES);

    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const base64Array = await Promise.all(combinedFiles.map(fileToBase64));
      setState(prev => ({ ...prev, files: combinedFiles, base64Images: base64Array, isLoading: false }));
    } catch (e) {
      setState(prev => ({ ...prev, error: 'Eroare la citirea fișierelor.', isLoading: false }));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [state.files]);

  const removeFile = (index: number) => {
    setState(prev => {
      const newFiles = [...prev.files];
      const newBase64 = [...prev.base64Images];
      newFiles.splice(index, 1);
      newBase64.splice(index, 1);
      return { ...prev, files: newFiles, base64Images: newBase64 };
    });
  };

  const clearAll = () => {
    if (window.confirm('Ești sigur că vrei să ștergi tot?')) {
      setState({
        files: [],
        base64Images: [],
        prompt: '',
        generatedImages: [],
        isLoading: false,
        error: null,
        successMessage: null,
        selectedPhotoStyle: '',
        selectedFashionStyle: '',
      });
    }
  };

  const buildFullPrompt = () => {
    let fullPrompt = state.prompt.trim();
    if (state.selectedPhotoStyle) fullPrompt += ` Stil fotografic: ${state.selectedPhotoStyle}.`;
    if (state.selectedFashionStyle) fullPrompt += ` Stil vestimentar: ${state.selectedFashionStyle}.`;
    return fullPrompt;
  };

  const copyFullPrompt = () => {
    navigator.clipboard.writeText(buildFullPrompt());
    setState(prev => ({ ...prev, successMessage: 'Prompt copiat!' }));
    setTimeout(() => setState(prev => ({ ...prev, successMessage: null })), 2000);
  };

  const generateImages = async () => {
    const currentFullPrompt = buildFullPrompt();
    if (state.base64Images.length === 0 || !state.prompt.trim()) {
      setState(prev => ({ ...prev, error: 'Încarcă imagini și descrie scena dorită.' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, generatedImages: [], successMessage: null }));
    const tasks = Array.from({ length: NUMBER_OF_VARIANTS }).map((_, i) => 
      generateImageVariant(currentFullPrompt, state.base64Images, i)
    );

    const results = await Promise.all(tasks);
    setState(prev => ({
      ...prev,
      isLoading: false,
      generatedImages: results,
      successMessage: results.some(r => r.url) ? 'Artworks generate!' : null,
      error: results.every(r => r.error) ? 'Eroare de model. Încearcă un prompt mai simplu.' : null
    }));
  };

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 ${isEmbedded ? 'p-0' : 'p-4 sm:p-8'}`}>
      <div className={`max-w-7xl mx-auto ${isEmbedded ? 'max-w-full' : ''}`}>
        
        {!isEmbedded && (
          <header className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
             <div>
                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg"><Sparkles className="w-5 h-5" /></div>
                  Gemini <span className="text-indigo-600">Studio</span>
                </h1>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Version 2.5 • PWA Engine</p>
             </div>
             
             <div className="flex items-center gap-2">
                <button onClick={clearAll} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Șterge Tot">
                  <RotateCcw className="w-5 h-5" />
                </button>
                {!isInstalled && deferredPrompt && (
                  <button onClick={handleInstallClick} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full font-bold text-xs hover:bg-indigo-700 transition-all shadow-md active:scale-95">
                    <Smartphone className="w-4 h-4" /> Instalează Aplicația
                  </button>
                )}
                {!isInstalled && !deferredPrompt && isIOS && (
                  <button onClick={() => setShowIOSGuide(true)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full font-bold text-xs hover:bg-indigo-100 transition-all shadow-sm">
                    <Smartphone className="w-4 h-4" /> Instalează pe iOS
                  </button>
                )}
                <button onClick={handleShareClick} className="p-2 bg-slate-50 text-slate-400 rounded-full border border-slate-100 hover:text-indigo-600 transition-all" title="Partajează">
                  <Share2 className="w-5 h-5" />
                </button>
             </div>
          </header>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-4 space-y-4">
            {/* Upload */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-4 flex items-center gap-2">
                <ImagePlus className="w-4 h-4" /> 1. Sursă Imagini
              </h3>
              
              <div 
                className={`border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer
                  ${state.files.length >= MAX_FILES ? 'opacity-50 cursor-not-allowed border-slate-100' : 'border-indigo-100 bg-indigo-50/20 hover:border-indigo-400'}`}
                onClick={() => state.files.length < MAX_FILES && fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
                <ImageIcon className="w-6 h-6 text-indigo-300" />
                <p className="font-bold text-sm text-slate-600">Adaugă fotografii</p>
                <p className="text-[10px] text-slate-400">{state.files.length} / {MAX_FILES} fișiere</p>
              </div>

              {state.files.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {state.files.map((file, idx) => (
                    <div key={idx} className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-100 group shadow-sm">
                      <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                      <button onClick={() => removeFile(idx)} className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Config */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-2 flex items-center gap-2">
                <Layers className="w-4 h-4" /> 2. Personalizare
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-black text-slate-500 mb-3 block uppercase tracking-tight">Stil Fotografic:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PHOTO_STYLES.map(style => (
                      <button
                        key={style}
                        onClick={() => setState(s => ({ ...s, selectedPhotoStyle: s.selectedPhotoStyle === style ? '' : style }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
                          ${state.selectedPhotoStyle === style ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 mb-3 block uppercase tracking-tight">Stil Vestimentar:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {FASHION_STYLES.map(style => (
                      <button
                        key={style}
                        onClick={() => setState(s => ({ ...s, selectedFashionStyle: s.selectedFashionStyle === style ? '' : style }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
                          ${state.selectedFashionStyle === style ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-tight">Instrucțiuni AI:</label>
                    <button onClick={copyFullPrompt} className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                      <Copy className="w-3 h-3" /> Copiază Prompt
                    </button>
                  </div>
                  <textarea
                    value={state.prompt}
                    onChange={(e) => setState(s => ({ ...s, prompt: e.target.value }))}
                    placeholder="Ex: Imagine stil candidat, persoana se află într-o cafenea modernă..."
                    className="w-full h-28 p-4 rounded-2xl border border-slate-50 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner"
                  />
                </div>
              </div>

              <button
                onClick={generateImages}
                disabled={state.isLoading || !state.prompt.trim() || state.base64Images.length === 0}
                className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black uppercase tracking-[2px] shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                {state.isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                Generează {NUMBER_OF_VARIANTS} Artworks
              </button>
            </div>
          </aside>

          <main className="lg:col-span-8">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 h-full min-h-[600px] relative">
              <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-6">
                <h2 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-lg">
                  <Maximize className="w-5 h-5 text-indigo-600" /> Canvas Rezultate
                </h2>
                {state.successMessage && (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-fade-in">
                    <CheckCircle className="w-3 h-3" /> {state.successMessage}
                  </span>
                )}
              </div>

              {state.error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100 flex items-center gap-3 font-bold"><AlertCircle className="w-5 h-5" /> {state.error}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {state.isLoading ? (
                  <div className="col-span-full py-40 flex flex-col items-center">
                    <div className="relative mb-8">
                       <Loader2 className="w-20 h-20 text-indigo-600 animate-spin" />
                       <Sparkles className="absolute -top-3 -right-3 w-8 h-8 text-indigo-400 animate-pulse" />
                    </div>
                    <p className="text-slate-800 font-black text-2xl tracking-tighter">Gemini Pictează...</p>
                    <p className="text-slate-400 text-sm mt-2 font-medium">Procesăm variantele tale unice.</p>
                  </div>
                ) : state.generatedImages.length > 0 ? (
                  state.generatedImages.map((result, index) => (
                    <div key={result.id} className="group relative bg-slate-50 rounded-[2rem] overflow-hidden aspect-square border border-slate-200 shadow-sm transition-all hover:shadow-2xl hover:-translate-y-2">
                      {result.url ? (
                        <>
                          <img src={result.url} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="Generated artwork" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-6">
                            <button 
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = result.url!;
                                link.download = `art-${Date.now()}.png`;
                                link.click();
                              }} 
                              className="w-full py-4 bg-white text-indigo-700 rounded-2xl shadow-2xl hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest"
                            >
                              <Download className="w-4 h-4" /> Salvează Varianta {index + 1}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                          <AlertCircle className="w-10 h-10 text-red-200 mb-3" />
                          <p className="text-xs text-red-400 font-black uppercase tracking-widest">Eroare Model</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-40 flex flex-col items-center opacity-20 select-none grayscale">
                    <div className="p-8 bg-slate-100 rounded-[3rem] mb-6">
                      <ImageIcon className="w-24 h-24 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-black text-xl uppercase tracking-[4px]">Așteptare Creație</p>
                    <p className="text-slate-400 text-xs mt-2 font-bold uppercase tracking-widest text-center">Încarcă fotografii și scrie un prompt<br/>pentru a începe</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>

        {!isEmbedded && (
          <footer className="mt-16 text-center text-slate-300 text-[10px] uppercase tracking-[6px] font-black pb-12 opacity-50">
            AI Multimodal Framework • Studio Engine v2.5.5
          </footer>
        )}

        {/* Modal Ghid Instalare iOS */}
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 relative">
              <button 
                onClick={() => setShowIOSGuide(false)} 
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full bg-slate-50"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-indigo-600 text-white rounded-2xl">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Instalare pe iPhone / iPad</h3>
                  <p className="text-xs text-slate-400 font-medium">Rulează ca aplicație nativă</p>
                </div>
              </div>
              <div className="space-y-3 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-5">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                  <p>Apasă butonul <strong>Partajare (Share)</strong> din bara Safari (jos).</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                  <p>Derulează în jos și selectează <strong>„Adăugare la ecranul principal”</strong> (Add to Home Screen).</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                  <p>Apasă <strong>Adăugare</strong> în colțul din dreapta-sus.</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
              >
                Am Înțeles
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
