import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const CATEGORIES = {
  materials: { label: 'Materials', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  labor: { label: 'Labor', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  plant: { label: 'Plant', color: 'bg-amber-50 border-amber-200 text-amber-800' },
};

const REFERENCE_RATES = [
  { item: 'Cement (Dangote 50kg)', unit: 'bag', rate: 5500, category: 'materials' },
  { item: 'Sand (Sharp)', unit: 'tonne', rate: 4500, category: 'materials' },
  { item: 'Gravel (3/4")', unit: 'tonne', rate: 5200, category: 'materials' },
  { item: 'Iron Rod (12mm)', unit: 'length', rate: 4800, category: 'materials' },
  { item: 'Blocks (6")', unit: 'piece', rate: 450, category: 'materials' },
  { item: 'Mason', unit: 'day', rate: 8000, category: 'labor' },
  { item: 'Carpenter', unit: 'day', rate: 7500, category: 'labor' },
  { item: 'Electrician', unit: 'day', rate: 10000, category: 'labor' },
  { item: 'Plumber', unit: 'day', rate: 9000, category: 'labor' },
  { item: 'Excavator', unit: 'day', rate: 85000, category: 'plant' },
  { item: 'Concrete Mixer', unit: 'day', rate: 15000, category: 'plant' },
  { item: 'Scaffolding', unit: 'm²', rate: 1200, category: 'plant' },
];

function formatNaira(val) {
  const n = Number(val);
  return isNaN(n) ? '0.00' : n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EMPTY_ROW = { component: '', category: 'materials', unit: '', quantity: '', rate: '' };

export default function RateAnalysisScene({ scene, onComplete }) {
  const content = scene?.content || {};

  const [rows, setRows] = useState(() => {
    if (content.rows?.length) return content.rows.map(r => ({ ...r, quantity: String(r.quantity ?? ''), rate: String(r.rate ?? '') }));
    return [{ ...EMPTY_ROW }];
  });
  const [feedback, setFeedback] = useState(null);
  const [validating, setValidating] = useState(false);
  const [showRef, setShowRef] = useState(false);

  const totals = useMemo(() => {
    const catTotals = { materials: 0, labor: 0, plant: 0 };
    const computed = rows.map(r => {
      const qty = parseFloat(r.quantity) || 0;
      const rate = parseFloat(r.rate) || 0;
      const amount = qty * rate;
      catTotals[r.category] = (catTotals[r.category] || 0) + amount;
      return { ...r, amount };
    });
    const grandTotal = Object.values(catTotals).reduce((a, b) => a + b, 0);
    return { rows: computed, catTotals, grandTotal };
  }, [rows]);

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };
  const addRow = () => setRows(prev => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (idx) => setRows(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/classroom/rate-analysis/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('qst_token') : ''}`,
        },
        body: JSON.stringify({
          scene_id: scene?.id,
          rows: totals.rows.map(r => ({ component: r.component, category: r.category, unit: r.unit, quantity: parseFloat(r.quantity) || 0, rate: parseFloat(r.rate) || 0 })),
        }),
      });
      const data = await res.json();
      setFeedback(data);
      if (data.passed) onComplete?.({ score: 100, rows: totals.rows, grandTotal: totals.grandTotal });
    } catch {
      toast.error('Validation failed');
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-primary-800">Rate Analysis</h2>
          <button onClick={() => setShowRef(!showRef)} className="text-xs text-primary-600 hover:text-primary-800 underline">
            {showRef ? 'Hide' : 'Show'} Reference Rates
          </button>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">#</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">Component</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 w-24">Category</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 w-16">Unit</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-20">Qty</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-28">Rate (₦)</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-28">Amount (₦)</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {totals.rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 px-2 text-xs text-gray-400">{i + 1}</td>
                    <td className="py-1.5 px-2">
                      <input value={row.component} onChange={e => updateRow(i, 'component', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-primary-500" placeholder="Component name" />
                    </td>
                    <td className="py-1.5 px-2">
                      <select value={row.category} onChange={e => updateRow(i, 'category', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-primary-500">
                        {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <input value={row.unit} onChange={e => updateRow(i, 'unit', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-primary-500" placeholder="m²" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input value={row.quantity} onChange={e => updateRow(i, 'quantity', e.target.value)} type="number" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-right focus:ring-1 focus:ring-primary-500" placeholder="0" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input value={row.rate} onChange={e => updateRow(i, 'rate', e.target.value)} type="number" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-right focus:ring-1 focus:ring-primary-500" placeholder="0" />
                    </td>
                    <td className="py-1.5 px-2 text-right text-xs font-mono text-gray-700">{formatNaira(row.amount)}</td>
                    <td className="py-1.5 px-1">
                      <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 text-xs" disabled={totals.rows.length <= 1}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showRef && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 240, opacity: 1 }} className="w-60 shrink-0 border-l border-gray-200 pl-4 overflow-y-auto max-h-96">
              <p className="text-xs font-semibold text-gray-600 mb-2">Nigerian Market Rates</p>
              {Object.entries(CATEGORIES).map(([cat, meta]) => (
                <div key={cat} className="mb-3">
                  <p className={`text-xs font-semibold mb-1 px-2 py-0.5 rounded border ${meta.color}`}>{meta.label}</p>
                  {REFERENCE_RATES.filter(r => r.category === cat).map((ref, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 px-2 hover:bg-gray-50 cursor-pointer" onClick={() => { addRow(); const last = rows.length; updateRow(last, 'component', ref.item); updateRow(last, 'category', cat); updateRow(last, 'unit', ref.unit); updateRow(last, 'rate', String(ref.rate)); }}>
                      <span className="text-gray-700 truncate">{ref.item}</span>
                      <span className="text-gray-500 ml-2 whitespace-nowrap">₦{formatNaira(ref.rate)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </motion.div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <button onClick={addRow} className="btn-secondary text-xs px-3 py-1.5">+ Add Row</button>
          <button onClick={handleValidate} disabled={validating} className="btn-primary text-sm px-5 py-2">
            {validating ? 'Validating…' : 'Validate Rate Analysis'}
          </button>
        </div>
      </motion.div>

      {/* Category subtotals */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(CATEGORIES).map(([cat, meta]) => (
          <div key={cat} className={`card border ${meta.color.split(' ').slice(1).join(' ')}`}>
            <p className="text-xs font-semibold mb-1">{meta.label}</p>
            <p className="text-lg font-bold font-mono">₦{formatNaira(totals.catTotals[cat])}</p>
          </div>
        ))}
      </div>

      <div className="card bg-primary-50 border-primary-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-primary-800">Grand Total</span>
        <span className="text-xl font-bold font-mono text-primary-800">₦{formatNaira(totals.grandTotal)}</span>
      </div>

      {feedback && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`card ${feedback.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="text-sm font-semibold mb-2">{feedback.passed ? '✓ Analysis Looks Good!' : '⚠ Issues Found'}</p>
          {feedback.errors?.length > 0 && (
            <ul className="space-y-1 mb-3">
              {feedback.errors.map((err, i) => <li key={i} className="text-xs text-red-700 flex items-start gap-1"><span>•</span> {err}</li>)}
            </ul>
          )}
          {feedback.suggestions?.length > 0 && (
            <ul className="space-y-1">
              {feedback.suggestions.map((s, i) => <li key={i} className="text-xs text-amber-700 flex items-start gap-1"><span>💡</span> {s}</li>)}
            </ul>
          )}
        </motion.div>
      )}
    </div>
  );
}
