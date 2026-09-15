import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const NIGERIAN_BENCHMARKS = [
  { element: 'Substructure', min: 5, max: 8 },
  { element: 'Superstructure', min: 30, max: 40 },
  { element: 'Roofing', min: 10, max: 15 },
  { element: 'Doors & Windows', min: 5, max: 8 },
  { element: 'Finishes', min: 12, max: 18 },
  { element: 'MEP Services', min: 15, max: 20 },
  { element: 'External Works', min: 3, max: 5 },
];

function formatNaira(val) {
  const n = Number(val);
  return isNaN(n) ? '0.00' : n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EMPTY_ROW = { element: '', cost: '', pct: '' };

export default function CostPlanScene({ scene, onComplete }) {
  const content = scene?.content || {};

  const [rows, setRows] = useState(() => {
    if (content.rows?.length) return content.rows.map(r => ({ ...r, cost: String(r.cost ?? ''), pct: String(r.pct ?? '') }));
    return [{ ...EMPTY_ROW }];
  });
  const [totalCost, setTotalCost] = useState(() => String(content.totalCost ?? ''));
  const [feedback, setFeedback] = useState(null);
  const [validating, setValidating] = useState(false);

  const computed = useMemo(() => {
    const total = parseFloat(totalCost) || 0;
    let assignedPct = 0;
    let assignedCost = 0;
    const c = rows.map(r => {
      const cost = parseFloat(r.cost) || 0;
      const pct = total > 0 ? (cost / total) * 100 : (parseFloat(r.pct) || 0);
      assignedPct += pct;
      assignedCost += cost;
      return { ...r, cost, pct };
    });
    return { rows: c, total, assignedPct, assignedCost, remainingPct: 100 - assignedPct };
  }, [rows, totalCost]);

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };
  const addRow = () => setRows(prev => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (idx) => setRows(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/classroom/cost-plan/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('qst_token') : ''}`,
        },
        body: JSON.stringify({
          scene_id: scene?.id,
          totalCost: computed.total,
          rows: computed.rows.map(r => ({ element: r.element, cost: r.cost, pct: r.pct })),
        }),
      });
      const data = await res.json();
      setFeedback(data);
      if (data.passed) onComplete?.({ score: 100, rows: computed.rows, totalCost: computed.total });
    } catch {
      toast.error('Validation failed');
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <h2 className="font-display font-bold text-primary-800 mb-4">Elemental Cost Plan</h2>

        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Total Project Cost (₦)</label>
          <input value={totalCost} onChange={e => setTotalCost(e.target.value)} type="number" className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-primary-500" placeholder="e.g. 50000000" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">#</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">Element</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-32">Cost (₦)</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-24">% of Total</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-32">Cost/m² (₦)</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {computed.rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5 px-2 text-xs text-gray-400">{i + 1}</td>
                  <td className="py-1.5 px-2">
                    <input value={row.element} onChange={e => updateRow(i, 'element', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-primary-500" placeholder="e.g. Superstructure" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input value={row.cost} onChange={e => updateRow(i, 'cost', e.target.value)} type="number" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-right focus:ring-1 focus:ring-primary-500" placeholder="0" />
                  </td>
                  <td className="py-1.5 px-2 text-right text-xs font-mono text-gray-700">
                    {row.pct ? parseFloat(row.pct).toFixed(1) : row.cost && computed.total ? ((parseFloat(row.cost) / computed.total) * 100).toFixed(1) : '0.0'}%
                  </td>
                  <td className="py-1.5 px-2 text-right text-xs font-mono text-gray-500">—</td>
                  <td className="py-1.5 px-1">
                    <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 text-xs" disabled={computed.rows.length <= 1}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold">
                <td colSpan={2} className="py-2 px-2 text-right text-xs text-gray-600">Total</td>
                <td className="py-2 px-2 text-right text-xs font-mono text-primary-800">₦{formatNaira(computed.assignedCost)}</td>
                <td className="py-2 px-2 text-right text-xs font-mono text-primary-800">{computed.assignedPct.toFixed(1)}%</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <button onClick={addRow} className="btn-secondary text-xs px-3 py-1.5">+ Add Element</button>
          <button onClick={handleValidate} disabled={validating} className="btn-primary text-sm px-5 py-2">
            {validating ? 'Validating…' : 'Validate Cost Plan'}
          </button>
        </div>
      </motion.div>

      {/* Nigerian benchmarks */}
      <div className="card bg-blue-50 border-blue-200">
        <p className="text-xs font-semibold text-blue-700 mb-2">Nigerian Elemental Cost Benchmarks</p>
        <div className="space-y-1.5">
          {NIGERIAN_BENCHMARKS.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-blue-800">{b.element}</span>
              <span className="text-blue-600 font-mono">{b.min}–{b.max}%</span>
            </div>
          ))}
        </div>
      </div>

      {feedback && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`card ${feedback.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="text-sm font-semibold mb-2">{feedback.passed ? '✓ Cost Plan Valid!' : '⚠ Issues Found'}</p>
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
