import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';


function calcQty(formula, dims) {
  if (!formula || !dims) return 0;
  const { l, w, d } = dims;
  const L = parseFloat(l) || 0;
  const W = parseFloat(w) || 0;
  const D = parseFloat(d) || 0;
  switch (formula) {
    case 'L×W': return L * W;
    case 'L×W×D': return L * W * D;
    case '2×(L+W)×D': return 2 * (L + W) * D;
    case 'L×D': return L * D;
    case 'W×D': return W * D;
    case '2×(L+W)': return 2 * (L + W);
    default: return L * W * D;
  }
}

const EMPTY_ROW = { element: '', description: '', formula: 'L×W×D', dims: { l: '', w: '', d: '' }, no: '1', expectedQty: '', unit: '' };

export default function MeasurementScene({ scene, onComplete }) {
  const content = scene?.content || {};

  const [rows, setRows] = useState(() => {
    if (content.rows?.length) return content.rows.map(r => ({
      ...r,
      dims: { l: String(r.dims?.l ?? ''), w: String(r.dims?.w ?? ''), d: String(r.dims?.d ?? '') },
      no: String(r.no ?? '1'),
      expectedQty: String(r.expectedQty ?? ''),
    }));
    return [{ ...EMPTY_ROW }];
  });
  const [score, setScore] = useState(null);
  const [showExpected, setShowExpected] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const computed = useMemo(() => {
    return rows.map(r => {
      const qty = calcQty(r.formula, r.dims) * (parseFloat(r.no) || 1);
      return { ...r, calculatedQty: qty };
    });
  }, [rows]);

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };
  const updateDim = (idx, dim, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, dims: { ...r.dims, [dim]: value } } : r));
  };
  const addRow = () => setRows(prev => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (idx) => setRows(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));

  const handleCheck = () => {
    setShowExpected(true);
    let correct = 0;
    let total = 0;
    computed.forEach(r => {
      if (r.expectedQty) {
        total++;
        const expected = parseFloat(r.expectedQty);
        if (Math.abs(r.calculatedQty - expected) < 0.05) correct++;
      }
    });
    if (total > 0) setScore(Math.round((correct / total) * 100));
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!showExpected) handleCheck();
    const pct = score ?? 100;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/classroom/measurement/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('qst_token') : ''}`,
        },
        body: JSON.stringify({ scene_id: scene?.id, rows: computed.map(r => ({ element: r.element, formula: r.formula, dims: r.dims, no: r.no, calculatedQty: r.calculatedQty })) }),
      });
    } catch { /* best effort */ }
    onComplete?.({ score: pct, rows: computed });
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-primary-800">Building Measurement Takeoff</h2>
          {score !== null && <span className={`text-sm font-bold px-3 py-1 rounded ${score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{score}%</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">#</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">Element</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">Description</th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 w-20">Formula</th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 w-16">L</th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 w-16">W</th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 w-16">D</th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 w-12">No.</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-24">Qty</th>
                {showExpected && <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-24">Expected</th>}
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 w-16">Unit</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {computed.map((row, i) => {
                const diff = showExpected && row.expectedQty ? Math.abs(row.calculatedQty - parseFloat(row.expectedQty)) < 0.05 : null;
                return (
                  <tr key={i} className={`border-b border-gray-100 ${diff === false ? 'bg-red-50' : diff === true ? 'bg-emerald-50' : ''}`}>
                    <td className="py-1.5 px-2 text-xs text-gray-400">{i + 1}</td>
                    <td className="py-1.5 px-2">
                      <input value={row.element} onChange={e => updateRow(i, 'element', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-primary-500" placeholder="e.g. Floor Slab" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input value={row.description} onChange={e => updateRow(i, 'description', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-primary-500" placeholder="Description" />
                    </td>
                    <td className="py-1.5 px-2">
                      <select value={row.formula} onChange={e => updateRow(i, 'formula', e.target.value)} className="w-full px-1 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-primary-500">
                        <option value="L×W×D">L×W×D</option>
                        <option value="L×W">L×W</option>
                        <option value="2×(L+W)×D">2(L+W)D</option>
                        <option value="L×D">L×D</option>
                        <option value="W×D">W×D</option>
                        <option value="2×(L+W)">2(L+W)</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <input value={row.dims.l} onChange={e => updateDim(i, 'l', e.target.value)} type="number" step="0.01" className="w-full px-1 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-primary-500" placeholder="0" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input value={row.dims.w} onChange={e => updateDim(i, 'w', e.target.value)} type="number" step="0.01" className="w-full px-1 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-primary-500" placeholder="0" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input value={row.dims.d} onChange={e => updateDim(i, 'd', e.target.value)} type="number" step="0.01" className="w-full px-1 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-primary-500" placeholder="0" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input value={row.no} onChange={e => updateRow(i, 'no', e.target.value)} type="number" className="w-full px-1 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-primary-500" placeholder="1" />
                    </td>
                    <td className="py-1.5 px-2 text-right text-xs font-mono text-gray-700">
                      {row.calculatedQty.toFixed(2)}
                    </td>
                    {showExpected && (
                      <td className="py-1.5 px-2 text-right text-xs font-mono">
                        {row.expectedQty ? (
                          <span className={diff ? 'text-emerald-600' : 'text-red-600'}>
                            {parseFloat(row.expectedQty).toFixed(2)} {diff ? '✓' : '✗'}
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    <td className="py-1.5 px-2">
                      <input value={row.unit} onChange={e => updateRow(i, 'unit', e.target.value)} className="w-full px-1 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-primary-500" placeholder="m²" />
                    </td>
                    <td className="py-1.5 px-1">
                      <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 text-xs" disabled={computed.length <= 1}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <button onClick={addRow} className="btn-secondary text-xs px-3 py-1.5">+ Add Element</button>
          <div className="flex gap-2">
            {!showExpected && (
              <button onClick={handleCheck} className="btn-secondary text-sm px-4 py-2">Check Answers</button>
            )}
            <button onClick={handleSubmit} disabled={submitted} className="btn-primary text-sm px-5 py-2">
              {submitted ? 'Submitted' : 'Submit Measurement'}
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showExpected && score !== null && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`card ${score >= 70 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className="text-sm font-semibold mb-1">{score >= 70 ? '✓ Good Measurement!' : '⚠ Review Needed'}</p>
            <p className="text-xs text-gray-600">Your accuracy: <strong>{score}%</strong> — {score >= 90 ? 'Excellent!' : score >= 70 ? 'Well done.' : 'Double-check your dimensions and formulas.'}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
