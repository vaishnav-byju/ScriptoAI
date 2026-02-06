
import React from 'react';
import { PaperType } from '../types';

interface PaperSelectorProps {
  selected: PaperType;
  onSelect: (type: PaperType) => void;
}

const PaperSelector: React.FC<PaperSelectorProps> = ({ selected, onSelect }) => {
  const options = [
    { type: PaperType.LINED, label: 'Lined', color: 'bg-blue-50' },
    { type: PaperType.GRID, label: 'Grid', color: 'bg-slate-50' },
    { type: PaperType.PLAIN, label: 'Plain', color: 'bg-white' },
    { type: PaperType.OLD, label: 'Vintage', color: 'bg-amber-50' },
    { type: PaperType.LEGAL, label: 'Legal', color: 'bg-yellow-50' },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {options.map((opt) => (
        <button
          key={opt.type}
          onClick={() => onSelect(opt.type)}
          className={`
            relative h-16 rounded-lg border-2 transition-all flex flex-col items-center justify-center
            ${selected === opt.type ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-100 hover:border-slate-300'}
            ${opt.color}
          `}
        >
          <span className="text-[10px] uppercase font-bold text-slate-500">{opt.label}</span>
          {selected === opt.type && (
            <div className="absolute top-1 right-1">
              <div className="bg-indigo-600 rounded-full p-0.5">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
        </button>
      ))}
    </div>
  );
};

export default PaperSelector;
