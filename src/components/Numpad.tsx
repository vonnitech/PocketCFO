import React from 'react';
import { Delete } from 'lucide-react';

interface NumpadProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  submitLabel?: string;
  isImpulse?: boolean;
}

export const Numpad: React.FC<NumpadProps> = ({
  value,
  onChange,
  onSubmit,
  submitLabel = 'EXECUTE',
  isImpulse = false,
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
    <div className="w-full p-5 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {keys.map(key => (
          <button
            key={key}
            type="button"
            onClick={() => handlePress(key)}
            className="h-14 rounded-2xl border-4 border-black bg-input font-black text-xl text-black
              hover:bg-surface hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
              active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            {key}
          </button>
        ))}

        <button
          type="button"
          onClick={handleDelete}
          className="h-14 rounded-2xl border-4 border-black bg-input flex items-center justify-center text-black
            hover:bg-surface hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
            active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          <Delete size={22} strokeWidth={3} />
        </button>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        className={`w-full h-14 rounded-full border-4 border-black font-black uppercase tracking-widest text-sm
          hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all
          ${isImpulse
            ? 'bg-action-bleed text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
            : 'bg-black text-action-primary shadow-[4px_4px_0px_0px_var(--color-action-primary)]'
          }`}
      >
        {submitLabel}
      </button>
    </div>
  );
};
