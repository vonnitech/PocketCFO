import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { supabase } from '../core/supabase';
import { currencySymbol } from '../lib/currency';

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (line[i] === ',' && !inQ) {
        row.push(cur.trim()); cur = '';
      } else cur += line[i];
    }
    row.push(cur.trim());
    rows.push(row);
  }
  return rows;
}

function bestGuess(headers: string[], keywords: string[]): number {
  const lower = headers.map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  for (const kw of keywords) {
    const idx = lower.findIndex(h => h.includes(kw));
    if (idx !== -1) return idx;
  }
  return 0;
}

function toISO(raw: string): string {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const mdy = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  const d = new Date(t);
  return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function toAmount(raw: string): number {
  return parseFloat(raw.replace(/[$€£,\s]/g, '')) || 0;
}

const CATEGORIES = [
  { key: 'FOOD', label: 'Food' },
  { key: 'TRANSPORT', label: 'Transport' },
  { key: 'FUN', label: 'Fun' },
  { key: 'SHOPPING', label: 'Shopping' },
  { key: 'HEALTH', label: 'Health' },
  { key: 'HOME', label: 'Home' },
  { key: 'WORK', label: 'Work' },
  { key: 'OTHER', label: 'Other' },
  { key: 'INCOME', label: 'Income' },
];

interface PreviewRow {
  id: string;
  rawDate: string;
  merchant: string;
  amount: number;
  category: string;
  skip: boolean;
}

type Step = 'upload' | 'map' | 'preview' | 'done';

interface Props {
  onClose: () => void;
}

export function CSVImport({ onClose }: Props) {
  const { userId, transactions, setState } = useStore();

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [dateCol, setDateCol] = useState(0);
  const [merchantCol, setMerchantCol] = useState(0);
  const [amountCol, setAmountCol] = useState(0);
  const [negativeIsExpense, setNegativeIsExpense] = useState(true);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) { setError('CSV appears empty or unreadable.'); return; }
      const h = parsed[0];
      const dataRows = parsed.slice(1).filter(r => r.some(c => c.trim()));
      setHeaders(h);
      setRows(dataRows);
      setDateCol(bestGuess(h, ['date', 'transdate', 'posteddate', 'valuedate']));
      setMerchantCol(bestGuess(h, ['description', 'merchant', 'payee', 'memo', 'name', 'details', 'narrative']));
      setAmountCol(bestGuess(h, ['amount', 'debit', 'credit', 'sum', 'transactionamount', 'value']));
      setStep('map');
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const buildPreview = () => {
    const built: PreviewRow[] = rows.slice(0, 50).map((row, i) => {
      const rawAmt = toAmount(row[amountCol] ?? '0');
      const amt = negativeIsExpense ? Math.abs(rawAmt) : rawAmt < 0 ? Math.abs(rawAmt) : rawAmt;
      const isIncome = negativeIsExpense ? rawAmt > 0 : rawAmt > 0;
      return {
        id: `csv-${i}`,
        rawDate: toISO(row[dateCol] ?? ''),
        merchant: (row[merchantCol] ?? '').toUpperCase() || 'UNKNOWN',
        amount: amt,
        category: isIncome ? 'INCOME' : 'OTHER',
        skip: amt === 0,
      };
    }).filter(r => r.amount > 0 || !r.skip);
    setPreview(built);
    setStep('preview');
  };

  const updateRow = (id: string, field: keyof PreviewRow, value: unknown) => {
    setPreview(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleImport = async () => {
    if (!userId) return;
    setImporting(true);
    setError('');

    const toImport = preview.filter(r => !r.skip);
    const inserts = toImport.map(r => ({
      id: crypto.randomUUID(),
      user_id: userId,
      merchant: r.merchant,
      amount: r.amount,
      category: r.category,
      date: new Date(r.rawDate + 'T12:00:00').toISOString(),
      is_flip: false,
      flip_amount: 0,
    }));

    const BATCH = 50;
    for (let i = 0; i < inserts.length; i += BATCH) {
      const { error: err } = await (supabase.from('transactions') as any).insert(inserts.slice(i, i + BATCH));
      if (err) { setError('Import failed: ' + err.message); setImporting(false); return; }
    }

    const newTxs = inserts.map(ins => ({
      id: ins.id,
      merchant: ins.merchant,
      amount: ins.amount,
      category: ins.category,
      date: ins.date,
      isFlip: false,
      flipAmount: 0,
    }));

    setState({ transactions: [...newTxs, ...transactions] });
    setImportedCount(inserts.length);
    setImporting(false);
    setStep('done');
  };

  const activePreview = preview.filter(r => !r.skip);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className="bg-surface border-4 border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b-2 border-border/40 sticky top-0 bg-surface z-10">
          <div>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase text-text-main">Import CSV</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-0.5">
              {step === 'upload' && 'Upload your bank export'}
              {step === 'map' && 'Map columns · ' + rows.length + ' rows detected'}
              {step === 'preview' && preview.length + ' rows to review'}
              {step === 'done' && 'Import complete'}
            </p>
          </div>
          <button type="button" title="Close" aria-label="Close" onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl border-2 border-border hover:bg-input transition-colors">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* ── STEP: Upload ── */}
          {step === 'upload' && (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-4 border-dashed border-border rounded-3xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-black hover:bg-input transition-all"
              >
                <div className="w-14 h-14 bg-action-primary border-4 border-black rounded-2xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <Upload size={24} strokeWidth={3} className="text-black" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest text-text-main text-center">
                  Drop CSV here or tap to browse
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted text-center">
                  Exports from any bank · standard CSV format
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              {error && (
                <div className="flex items-center gap-2 p-3 bg-action-bleed/10 border-2 border-action-bleed rounded-2xl">
                  <AlertCircle size={15} className="text-action-bleed shrink-0" />
                  <p className="text-[11px] font-bold text-action-bleed">{error}</p>
                </div>
              )}
            </>
          )}

          {/* ── STEP: Map ── */}
          {step === 'map' && (
            <>
              <div className="flex items-center gap-2 p-3 bg-input border-2 border-border rounded-2xl">
                <FileText size={14} className="text-text-muted shrink-0" />
                <p className="text-[11px] font-bold text-text-muted truncate">{fileName}</p>
              </div>

              {([
                { label: 'Date Column', value: dateCol, set: setDateCol },
                { label: 'Merchant / Description', value: merchantCol, set: setMerchantCol },
                { label: 'Amount Column', value: amountCol, set: setAmountCol },
              ] as const).map(field => (
                <div key={field.label}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">{field.label}</p>
                  <select
                    title={field.label}
                    value={field.value}
                    onChange={e => field.set(Number(e.target.value))}
                    className="w-full h-11 px-4 bg-input border-2 border-border rounded-2xl text-[13px] font-bold text-text-main focus:outline-none focus:border-black transition-colors"
                  >
                    {headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">Amount Sign Convention</p>
                <div className="flex gap-2">
                  {[
                    { label: 'Negative = Expense', val: true },
                    { label: 'Positive = Expense', val: false },
                  ].map(opt => (
                    <button
                      key={String(opt.val)}
                      type="button"
                      onClick={() => setNegativeIsExpense(opt.val)}
                      className={`flex-1 h-11 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                        negativeIsExpense === opt.val
                          ? 'bg-black border-black text-white'
                          : 'bg-input border-border text-text-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={buildPreview}
                className="w-full h-12 bg-action-primary border-4 border-black rounded-2xl font-black uppercase tracking-widest text-sm text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              >
                Preview Transactions
              </button>
            </>
          )}

          {/* ── STEP: Preview ── */}
          {step === 'preview' && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {activePreview.length} of {preview.length} rows selected · tap to set category or skip
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
                {preview.map(row => (
                  <div
                    key={row.id}
                    className={`border-2 rounded-2xl px-3 py-2.5 transition-all ${row.skip ? 'opacity-40 bg-input border-border' : 'bg-surface border-border'}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <button
                        type="button"
                        title={row.skip ? 'Include row' : 'Skip row'}
                        onClick={() => updateRow(row.id, 'skip', !row.skip)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${row.skip ? 'border-border bg-input' : 'border-black bg-black'}`}
                      >
                        {!row.skip && <CheckCircle2 size={11} className="text-white" />}
                      </button>
                      <span className="text-[10px] font-bold text-text-muted shrink-0">{row.rawDate}</span>
                      <span className="text-[11px] font-black text-text-main truncate flex-1">{row.merchant}</span>
                      <span className={`text-[11px] font-black tabular-nums shrink-0 ${row.category === 'INCOME' ? 'text-capture-readable' : 'text-text-main'}`}>
                        {row.category === 'INCOME' ? '+' : '-'}{currencySymbol()}{row.amount.toFixed(2)}
                      </span>
                    </div>
                    {!row.skip && (
                      <select
                        title="Category"
                        value={row.category}
                        onChange={e => updateRow(row.id, 'category', e.target.value)}
                        className="w-full h-8 px-2 bg-input border border-border rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted focus:outline-none focus:border-black"
                      >
                        {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-action-bleed/10 border-2 border-action-bleed rounded-2xl">
                  <AlertCircle size={15} className="text-action-bleed shrink-0" />
                  <p className="text-[11px] font-bold text-action-bleed">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('map')}
                  className="h-12 px-5 border-2 border-border rounded-2xl font-black uppercase tracking-widest text-[11px] text-text-muted hover:bg-input transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing || activePreview.length === 0}
                  className="flex-1 h-12 bg-action-capture border-4 border-black rounded-2xl font-black uppercase tracking-widest text-sm text-capture-contrast shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 disabled:opacity-40 transition-all"
                >
                  {importing ? 'Importing…' : `Import ${activePreview.length} Transactions`}
                </button>
              </div>
            </>
          )}

          {/* ── STEP: Done ── */}
          {step === 'done' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-action-capture border-4 border-black rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CheckCircle2 size={28} strokeWidth={3} className="text-black" />
              </div>
              <p className="text-3xl font-black italic tracking-tighter text-text-main mb-1">{importedCount} imported</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-6">
                Transactions added to your history
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-12 bg-black border-4 border-black rounded-2xl font-black uppercase tracking-widest text-sm text-action-primary shadow-[3px_3px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              >
                Done
              </button>
            </div>
          )}

        </div>
      </motion.div>
    </motion.div>
  );
}
