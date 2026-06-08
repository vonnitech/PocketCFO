import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { parseImportFile, buildTransactionsFromMapping, ParsedFile, ImportMapping } from '../core/export';
import { Transaction } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (transactions: Transaction[]) => void;
}

const CATEGORY_OPTIONS = [
  'UNCATEGORIZED', 'FOOD', 'TRANSPORT', 'FUN', 'SHOPPING',
  'HEALTH', 'HOME', 'WORK', 'OTHER',
];

// Best-effort header guess. The user can always override.
function guess(headers: string[], keywords: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  for (const k of keywords) {
    const hit = headers.find(h => norm(h).includes(k));
    if (hit) return hit;
  }
  return headers[0] || '';
}

export function ImportMapperModal({ open, onClose, onImport }: Props) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({
    date: '', merchant: '', amount: '', reverseSigns: false, defaultCategory: 'UNCATEGORIZED',
  });
  const [error, setError] = useState<string>('');
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setStep('upload'); setFile(null); setParsed(null); setError(''); setParsing(false);
      setMapping({ date: '', merchant: '', amount: '', reverseSigns: false, defaultCategory: 'UNCATEGORIZED' });
    }
  }, [open]);

  const handleFile = async (f: File) => {
    setError('');
    setParsing(true);
    try {
      const result = await parseImportFile(f);
      if (result.headers.length === 0 || result.rows.length === 0) {
        setError('File has no recognizable rows or headers.');
        setParsing(false);
        return;
      }
      setFile(f);
      setParsed(result);
      setMapping({
        date:            guess(result.headers, ['date', 'posted', 'transactiondate']),
        merchant:        guess(result.headers, ['merchant', 'description', 'narration', 'payee', 'name']),
        amount:          guess(result.headers, ['amount', 'value', 'debit', 'credit']),
        reverseSigns:    false,
        defaultCategory: 'UNCATEGORIZED',
      });
      setStep('map');
    } catch (e) {
      setError((e as Error).message || 'Failed to parse file.');
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const previewTxs = parsed && mapping.date && mapping.merchant && mapping.amount
    ? buildTransactionsFromMapping(parsed, mapping).slice(0, 5)
    : [];

  const allTxs = parsed && mapping.date && mapping.merchant && mapping.amount
    ? buildTransactionsFromMapping(parsed, mapping)
    : [];

  const confirmImport = () => {
    if (allTxs.length === 0) return;
    onImport(allTxs);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-surface border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b-4 border-black bg-input">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-black border-2 border-black rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
                  <FileSpreadsheet size={11} /> Import Statement
                </div>
                <button type="button" onClick={onClose} title="Close" className="w-8 h-8 border-2 border-black rounded-lg flex items-center justify-center hover:bg-surface">
                  <X size={14} strokeWidth={3} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {error && (
                  <div className="flex items-start gap-2 mb-4 px-3 py-2.5 bg-action-bleed/10 border-2 border-action-bleed rounded-2xl">
                    <AlertCircle size={14} strokeWidth={2.5} className="text-action-bleed shrink-0 mt-0.5" />
                    <p className="text-[10px] font-black uppercase tracking-wide text-action-bleed">{error}</p>
                  </div>
                )}

                {step === 'upload' && (
                  <div
                    onDrop={onDrop}
                    onDragOver={e => e.preventDefault()}
                    className="border-4 border-dashed border-border rounded-3xl p-10 text-center hover:border-black transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={36} className="mx-auto mb-3 text-text-muted" strokeWidth={2} />
                    <p className="text-sm font-black uppercase tracking-widest text-text-main mb-1">
                      {parsing ? 'Parsing...' : 'Drop CSV or Excel here'}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                      .csv · .xlsx · .xls supported
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                  </div>
                )}

                {step === 'map' && parsed && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-black uppercase tracking-widest text-text-muted">
                        {file?.name} · {parsed.rows.length} rows
                      </p>
                      <button type="button" onClick={() => setStep('upload')} className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main">
                        Change file
                      </button>
                    </div>

                    <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                      Match the columns from your file to the fields we need.
                    </p>

                    {(['date', 'merchant', 'amount'] as const).map(field => (
                      <div key={field}>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">
                          {field === 'date' ? 'Date Column' : field === 'merchant' ? 'Merchant / Description Column' : 'Amount Column'}
                        </label>
                        <select
                          value={mapping[field]}
                          title={`Select ${field} column`}
                          onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}
                          className="w-full bg-input border-4 border-black rounded-2xl px-3 py-2.5 font-black text-sm text-text-main outline-none focus:border-action-capture"
                        >
                          <option value="">— Select —</option>
                          {parsed.headers.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}

                    <div className="flex items-center justify-between px-3 py-3 bg-input border-4 border-black rounded-2xl">
                      <div className="min-w-0">
                        <p className="text-sm font-black uppercase tracking-wide text-text-main">Reverse signs</p>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-0.5">
                          Toggle if your file shows purchases as positive (most credit-card CSVs).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMapping(m => ({ ...m, reverseSigns: !m.reverseSigns }))}
                        className={`min-w-16 h-9 px-3 border-2 border-black rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${mapping.reverseSigns ? 'bg-action-capture text-capture-contrast' : 'bg-surface text-text-main'}`}
                      >
                        {mapping.reverseSigns ? 'On' : 'Off'}
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">
                        Default Category (for rows with no income/spend hint)
                      </label>
                      <select
                        value={mapping.defaultCategory}
                        title="Default category"
                        onChange={e => setMapping(m => ({ ...m, defaultCategory: e.target.value }))}
                        className="w-full bg-input border-4 border-black rounded-2xl px-3 py-2.5 font-black text-sm text-text-main outline-none focus:border-action-capture"
                      >
                        {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => setStep('preview')}
                      disabled={!mapping.date || !mapping.merchant || !mapping.amount}
                      className="w-full h-12 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40"
                    >
                      Preview Import
                    </button>
                  </div>
                )}

                {step === 'preview' && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                      {allTxs.length} transaction{allTxs.length !== 1 ? 's' : ''} ready to import. First 5 shown:
                    </p>

                    <div className="bg-input border-4 border-black rounded-2xl overflow-hidden">
                      <table className="w-full text-[11px] tabular-nums">
                        <thead>
                          <tr className="border-b-2 border-black bg-surface">
                            <th className="px-3 py-2 text-left font-black uppercase tracking-widest text-text-muted">Date</th>
                            <th className="px-3 py-2 text-left font-black uppercase tracking-widest text-text-muted">Merchant</th>
                            <th className="px-3 py-2 text-left font-black uppercase tracking-widest text-text-muted">Cat</th>
                            <th className="px-3 py-2 text-right font-black uppercase tracking-widest text-text-muted">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewTxs.map(t => (
                            <tr key={t.id} className="border-b border-border/40">
                              <td className="px-3 py-2 text-text-main">{t.date.slice(0, 10)}</td>
                              <td className="px-3 py-2 font-black text-text-main truncate">{t.merchant}</td>
                              <td className="px-3 py-2 text-text-muted">{t.category}</td>
                              <td className={`px-3 py-2 text-right font-black ${t.category === 'INCOME' ? 'text-capture-readable' : 'text-text-main'}`}>
                                {t.category === 'INCOME' ? '+' : '−'}${t.amount.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStep('map')}
                        className="flex-1 h-12 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest hover:bg-input transition-all"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={confirmImport}
                        disabled={allTxs.length === 0}
                        className="flex-1 h-12 border-4 border-black rounded-full bg-action-capture text-capture-contrast font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      >
                        <Check size={14} strokeWidth={3} /> Import {allTxs.length}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
