import React from 'react';
import { Delete } from 'lucide-react';

interface NumpadProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  submitLabel?: string;
  isGremlin?: boolean;
}

export const Numpad: React.FC<NumpadProps> = ({ 
  value, 
  onChange, 
  onSubmit, 
  submitLabel = "EXECUTE",
  isGremlin = false 
}) => {
  const handlePress = (num: string) => {
    if (value === '0' && num !== '.') return onChange(num);
    if (num === '.' && value.includes('.')) return;
    onChange(value + num);
  };

  const handleDelete = () => {
    if (value.length <= 1) return onChange('0');
    onChange(value.slice(0, -1));
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];

  return (
    <div className="w-full max-w-md mx-auto grid grid-cols-3 gap-4 p-4">
      {/* Number Keys */}
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => handlePress(key)}
          className="btn-brutal h-20 text-3xl flex items-center justify-center text-text-main active:bg-border"
        >
          {key}
        </button>
      ))}
      
      {/* Delete Key */}
      <button 
        onClick={handleDelete}
        className="btn-brutal h-20 flex items-center justify-center text-action-target"
      >
        <Delete size={32} />
      </button>

      {/* Massive Execute Button */}
      <button 
        onClick={onSubmit}
        className={`col-span-3 h-20 mt-2 text-2xl tracking-widest font-black transition-all shadow-brutal-border
          ${isGremlin 
            ? 'bg-action-bleed text-base hover:shadow-brutal' 
            : 'bg-action-capture text-base hover:shadow-brutal-green'
          }
        `}
      >
        {submitLabel}
      </button>
    </div>
  );
};
