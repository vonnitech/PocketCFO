import React, { useState, useMemo } from 'react';
import { Numpad } from '../components/Numpad';
import { Calculator, Flame, AlertOctagon } from 'lucide-react';

type InputStep = 'PRICE' | 'APR' | 'TERM';

export const TrueCost: React.FC = () => {
  const [step, setStep] = useState<InputStep>('PRICE');
  const [price, setPrice] = useState('0');
  const [apr, setApr] = useState('0');
  const [term, setTerm] = useState('0');
  const [showResults, setShowResults] = useState(false);

  const metrics = useMemo(() => {
    const P = parseFloat(price) || 0;
    const annualRate = parseFloat(apr) || 0;
    const n = parseInt(term) || 0;

    if (P === 0 || n === 0) return { monthly: 0, total: 0, interest: 0 };

    if (annualRate === 0) {
      return {
        monthly: P / n,
        total: P,
        interest: 0
      };
    }

    const r = (annualRate / 100) / 12;
    const monthly = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = monthly * n;
    const interest = total - P;

    return {
      monthly,
      total,
      interest
    };
  }, [price, apr, term]);

  const handleNext = () => {
    if (step === 'PRICE') setStep('APR');
    else if (step === 'APR') setStep('TERM');
    else {
      setShowResults(true);
    }
  };

  const reset = () => {
    setPrice('0');
    setApr('0');
    setTerm('0');
    setStep('PRICE');
    setShowResults(false);
  };

  if (showResults) {
    return (
      <div className="min-h-screen bg-base text-text-main flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm border-4 border-action-bleed bg-surface p-8 relative overflow-hidden shadow-brutal">
          <h2 className="font-mono text-action-bleed tracking-widest mb-8 flex items-center gap-2">
            <AlertOctagon size={24} /> FINANCE REVEALED
          </h2>

          <div className="space-y-8 mb-12">
            <div className="border-l-4 border-border pl-4">
              <p className="text-text-muted uppercase text-xs mb-1">Sticker Price</p>
              <p className="font-mono text-2xl text-text-main">${parseFloat(price).toLocaleString()}</p>
            </div>

            <div className="bg-action-bleed/10 p-6 border-2 border-action-bleed">
              <p className="text-action-bleed uppercase text-sm font-black tracking-[0.2em] mb-2 flex items-center gap-2">
                <Flame size={18} /> INTEREST BURNED
              </p>
              <p className="font-mono text-5xl text-action-bleed">${metrics.interest.toFixed(2)}</p>
              <p className="text-text-muted text-[10px] uppercase mt-4 leading-tight">
                This is pure wealth surrender. You are paying {((metrics.interest / parseFloat(price)) * 100).toFixed(1)}% extra for the privilege of debt.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-text-muted uppercase text-[10px] mb-1">Monthly Hit</p>
                <p className="font-mono text-xl text-text-main">${metrics.monthly.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-text-muted uppercase text-[10px] mb-1">Total Drain</p>
                <p className="font-mono text-xl text-text-main">${metrics.total.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <button 
            onClick={reset}
            className="w-full btn-brutal bg-base border-border text-text-main py-4 text-sm"
          >
            DISMISS & RECALCULATE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base text-text-main flex flex-col pt-8">
      {/* Header Readout */}
      <div className="px-6 mb-8">
        <p className="text-text-muted text-xs tracking-widest uppercase mb-1 flex items-center gap-2">
          <Calculator size={14} /> True Cost Calculator
        </p>
        <h1 className="font-mono text-3xl text-text-main border-b-2 border-border pb-4 uppercase tracking-tighter">
          {step === 'PRICE' && 'Enter Sticker Price'}
          {step === 'APR' && 'Enter Interest Rate (APR)'}
          {step === 'TERM' && 'Enter Loan Term (Months)'}
        </h1>
      </div>

      {/* Progress Track */}
      <div className="flex px-6 gap-2 mb-8">
        <div className={`h-1 flex-1 transition-colors ${step === 'PRICE' ? 'bg-action-capture' : 'bg-border'}`} />
        <div className={`h-1 flex-1 transition-colors ${step === 'APR' ? 'bg-action-capture' : 'bg-border'}`} />
        <div className={`h-1 flex-1 transition-colors ${step === 'TERM' ? 'bg-action-capture' : 'bg-border'}`} />
      </div>

      {/* Live Display */}
      <div className="px-6 mb-auto">
        <div className="bg-surface border-2 border-border p-6 shadow-brutal">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-text-muted uppercase text-[10px] mb-1">
                {step === 'PRICE' && 'PRINCIPAL'}
                {step === 'APR' && 'ANNUAL PERCENTAGE'}
                {step === 'TERM' && 'DURATION MONTHS'}
              </p>
              <span className="text-5xl font-mono text-action-capture">
                {step === 'PRICE' && `$${price}`}
                {step === 'APR' && `${apr}%`}
                {step === 'TERM' && `${term}m`}
              </span>
            </div>
            {step !== 'PRICE' && (
              <div className="text-right pb-1">
                <p className="text-text-muted text-[10px] uppercase">Base Progress</p>
                <p className="font-mono text-text-main">${parseFloat(price).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Control Engine */}
      <div className="mt-8 pb-8 bg-surface border-t-2 border-border">
        <Numpad 
          value={step === 'PRICE' ? price : step === 'APR' ? apr : term} 
          onChange={(val) => {
            if (step === 'PRICE') setPrice(val);
            else if (step === 'APR') setApr(val);
            else setTerm(val);
          }} 
          onSubmit={handleNext}
          submitLabel={step === 'TERM' ? "VIEW SUMMARY" : "CONTINUE"}
        />
        
        {step !== 'PRICE' && (
          <button 
            onClick={() => {
              if (step === 'APR') setStep('PRICE');
              if (step === 'TERM') setStep('APR');
            }}
            className="w-full text-text-muted text-[10px] uppercase underline mt-2 text-center"
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  );
};
