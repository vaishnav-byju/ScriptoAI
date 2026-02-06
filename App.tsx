import React, { useState } from 'react';
import Header from './components/Header';
import PaperSelector from './components/PaperSelector';
import { HandwritingState, PaperType } from './types';
import { analyzeHandwriting, generateSingleHandwrittenPage, splitIntoPages } from './services/geminiService';
import { jsPDF } from 'jspdf';

const App: React.FC = () => {
  const [state, setState] = useState<HandwritingState>({
    isCalibrated: false,
    referenceImage: null,
    styleProfile: null,
    status: 'idle',
    generatedPages: [],
    generationProgress: { current: 0, total: 0 }
  });

  const [inputText, setInputText] = useState('');
  const [selectedPaper, setSelectedPaper] = useState<PaperType>(PaperType.LINED);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setState(prev => ({ ...prev, status: 'analyzing' }));
    setLocalError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        // Support for PDF and common images. For PPT/DOC, we try to process but warn user if it's not a clear scan.
        const mimeType = file.type || 'application/octet-stream';
        
        const profile = await analyzeHandwriting(base64, mimeType);
        
        if (profile.isRecognizable) {
          setState({
            isCalibrated: true,
            referenceImage: base64,
            styleProfile: profile,
            status: 'idle',
            generatedPages: [],
            generationProgress: { current: 0, total: 0 }
          });
        } else {
          setLocalError(profile.failureReason || "Could not extract a consistent handwriting style. Please provide a clearer sample (Image or PDF).");
          setState(prev => ({ ...prev, status: 'idle' }));
        }
      } catch (error) {
        console.error("Analysis failed", error);
        setLocalError("This file format could not be processed. Please upload a PDF or Image of your handwriting.");
        setState(prev => ({ ...prev, status: 'error' }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!state.referenceImage || !state.styleProfile || !inputText) return;

    const pageChunks = splitIntoPages(inputText);
    setState(prev => ({ 
      ...prev, 
      status: 'generating', 
      generatedPages: [], 
      generationProgress: { current: 0, total: pageChunks.length } 
    }));

    const results: string[] = [];
    try {
      for (let i = 0; i < pageChunks.length; i++) {
        setState(prev => ({ 
          ...prev, 
          generationProgress: { current: i + 1, total: pageChunks.length } 
        }));
        
        const result = await generateSingleHandwrittenPage(
          state.referenceImage,
          pageChunks[i],
          selectedPaper,
          state.styleProfile,
          i + 1,
          pageChunks.length
        );
        
        if (result) {
          results.push(result);
          // Progressive update
          setState(prev => ({
            ...prev,
            generatedPages: [...results]
          }));
        }
      }
      setState(prev => ({ ...prev, status: 'idle' }));
    } catch (error) {
      console.error("Generation failed", error);
      setState(prev => ({ ...prev, status: 'error' }));
      setLocalError("Handwriting mimicry was interrupted. Please try again.");
    }
  };

  const handleExportPDF = () => {
    if (state.generatedPages.length === 0) return;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [450, 600] });
    state.generatedPages.forEach((pageData, index) => {
      if (index > 0) pdf.addPage([450, 600], 'p');
      pdf.addImage(pageData, 'PNG', 0, 0, 450, 600);
    });
    pdf.save('scripto-forged-notes.pdf');
  };

  const resetCalibration = () => {
    setLocalError(null);
    setState({
      isCalibrated: false,
      referenceImage: null,
      styleProfile: null,
      status: 'idle',
      generatedPages: [],
      generationProgress: { current: 0, total: 0 }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-5 space-y-6">
            {!state.isCalibrated ? (
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Source Analysis</div>
                  <h2 className="text-xl font-bold text-slate-900">1. Upload Sample</h2>
                </div>
                <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                  Upload <b>any file</b> (PDF, Image, Scan) containing your handwriting. 
                  The AI will meticulously study your inconsistencies, word sizing, and slant.
                </p>
                
                <div className="bg-slate-50 border-dashed border-2 border-slate-200 rounded-xl p-10 mb-6 flex flex-col items-center justify-center text-center group hover:bg-slate-100 transition-colors cursor-pointer relative overflow-hidden">
                  <svg className="w-12 h-12 text-slate-300 mb-2 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-tighter">PDF / IMG / DOC SUPPORT</p>
                  <p className="text-[11px] text-slate-400 mt-1 italic">Handwriting within the file will be mapped</p>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                
                {localError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 shadow-sm animate-shake">
                    <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-red-600 font-medium leading-relaxed">{localError}</p>
                  </div>
                )}

                {state.status === 'analyzing' && (
                  <div className="mt-6 flex items-center justify-center gap-3 py-4 bg-indigo-50 rounded-lg text-indigo-700 animate-pulse border border-indigo-100">
                    <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-bold text-xs uppercase tracking-widest">Studying Your Inconsistencies...</span>
                  </div>
                )}
              </section>
            ) : (
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900">Style Matched</h2>
                  <button onClick={resetCalibration} className="text-xs text-indigo-600 font-bold hover:underline uppercase">New Source</button>
                </div>
                
                <div className="space-y-4 mb-6">
                   <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-24 h-24 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-white flex items-center justify-center shadow-inner">
                      {state.referenceImage && (
                        <img src={state.referenceImage} alt="Sample" className="max-w-full max-h-full object-contain" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2 py-1">
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-500 uppercase">{state.styleProfile?.slant}</span>
                        <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-500 uppercase">{state.styleProfile?.pressure}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-tight italic line-clamp-3">
                        {state.styleProfile?.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Your Text</label>
                    <textarea 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Paste text here..."
                      className="w-full h-44 p-4 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none bg-slate-50/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Paper</label>
                    <PaperSelector selected={selectedPaper} onSelect={setSelectedPaper} />
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={state.status === 'generating' || !inputText}
                    className="w-full py-4 rounded-xl font-bold text-white shadow-lg bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:bg-slate-300"
                  >
                    {state.status === 'generating' 
                      ? `Forging Page ${state.generationProgress.current}/${state.generationProgress.total}...` 
                      : 'Generate Handwritten Pages'}
                  </button>
                </div>
              </section>
            )}
          </div>

          <div className="lg:col-span-7">
            <div className="bg-slate-200 rounded-3xl p-4 md:p-8 min-h-[650px] flex flex-col items-center relative overflow-hidden shadow-inner">
              
              {state.generatedPages.length > 0 ? (
                <div className="w-full flex flex-col items-center gap-10 h-full max-h-[900px] overflow-y-auto custom-scrollbar pr-3 pb-10">
                  <div className="w-full flex justify-between items-center mb-4 sticky top-0 z-20 bg-slate-200/95 backdrop-blur-md py-4 rounded-2xl px-5 shadow-sm border border-slate-300/30">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                      {state.generatedPages.length} Pages Drafted
                    </span>
                    <button 
                      onClick={handleExportPDF}
                      className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-full text-[11px] font-bold hover:bg-black transition-all shadow-xl"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      SAVE AS PDF
                    </button>
                  </div>

                  {state.generatedPages.map((page, idx) => (
                    <div key={`page-${idx}`} className="w-full max-w-sm bg-white shadow-2xl rounded-sm group relative overflow-hidden border-4 border-white transition-all">
                      <div className="absolute top-3 left-3 bg-slate-900/60 text-[9px] font-bold px-2.5 py-1 rounded backdrop-blur-md text-white z-10 uppercase tracking-widest">
                        PAGE {idx + 1}
                      </div>
                      
                      <img src={page} alt={`Forged Note Page ${idx + 1}`} className="w-full h-auto block" />
                      
                      {/* FIXED FOOTER: Symbol visible on ALL pages including the first one */}
                      <div className="p-4 flex justify-between items-center border-t border-slate-100 bg-white relative z-20">
                        <div className="flex items-center gap-2.5">
                          <div className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Style DNA Replicated</span>
                        </div>
                        <button 
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = page;
                            link.download = `page-${idx+1}.png`;
                            link.click();
                          }}
                          className="p-1.5 text-slate-300 hover:text-indigo-600 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {state.status === 'generating' && (
                    <div className="w-full max-w-sm aspect-[3/4] bg-white/50 border-2 border-dashed border-indigo-200 rounded-sm flex items-center justify-center animate-pulse">
                      <div className="text-center">
                        <div className="inline-block animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full mb-4"></div>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Mimicking Strokes...</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-5 mt-48 px-10">
                  <div className="bg-white/40 backdrop-blur-lg w-24 h-24 rounded-[2.5rem] mx-auto flex items-center justify-center border border-white/50 shadow-2xl">
                    <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-slate-600 font-bold uppercase tracking-[0.3em] text-[11px]">Handwriting Forge</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Upload any document (Image or PDF) containing your natural handwriting. 
                      Our AI will mirror every "bad" habit, slant, and messy detail perfectly.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-10">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-[10px] uppercase tracking-[0.4em] font-bold">ScriptoAI Forensic Multi-Page Engine</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
