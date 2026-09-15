import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const EMPTY_ROW = { description: '', unit: '', quantity: '', rate: '' };

function formatNaira(val) {
  const n = Number(val);
  return isNaN(n) ? '0.00' : n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BOQScene({ scene, onComplete }) {
  const content = scene?.content || {};
  const expected = content.expected || {};

  const [rows, setRows] = useState(() => {
    if (content.rows?.length) return content.rows.map(r => ({ ...r, quantity: String(r.quantity ?? ''), rate: String(r.rate ?? '') }));
    return [{ ...EMPTY_ROW }];
  });
  const [feedback, setFeedback] = useState(null);
  const [validating, setValidating] = useState(false);

  const totals = useMemo(() => {
    let sum = 0;
    const computed = rows.map(r => {
      const qty = parseFloat(r.quantity) || 0;
      const rate = parseFloat(r.rate) || 0;
      const amount = qty * rate;
      sum += amount;
      return { ...r, amount };
    });
    return { rows: computed, total: sum };
  }, [rows]);

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows(prev => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (idx) => setRows(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/classroom/boq/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('qst_token') : ''}`,
        },
        body: JSON.stringify({
          scene_id: scene?.id,
          rows: totals.rows.map(r => ({ description: r.description, unit: r.unit, quantity: parseFloat(r.quantity) || 0, rate: parseFloat(r.rate) || 0 })),
        }),
      });
      const data = await res.json();
      setFeedback(data);
      if (data.passed) onComplete?.({ score: 100, boq: totals.rows, total: totals.total });
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
          <h2 className="font-display font-bold text-primary-800">Bill of Quantities</h2>
          {content.topic && <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{content.topic}</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">#</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">Description</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 w-20">Unit</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-24">Qty</th>
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
                    <input
                      value={row.description}
                      onChange={e => updateRow(i, 'description', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Item description"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      value={row.unit}
                      onChange={e => updateRow(i, 'unit', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-primary-500"
                      placeholder="m²"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      value={row.quantity}
                      onChange={e => updateRow(i, 'quantity', e.target.value)}
                      type="number"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-right focus:ring-1 focus:ring-primary-500"
                      placeholder="0"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      value={row.rate}
                      onChange={e => updateRow(i, 'rate', e.target.value)}
                      type="number"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-right focus:ring-1 focus:ring-primary-500"
                      placeholder="0"
                    />
                  </td>
                  <td className="py-1.5 px-2 text-right text-xs font-mono text-gray-700">
                    {formatNaira(row.amount)}
                  </td>
                  <td className="py-1.5 px-1">
                    <button
                      onClick={() => removeRow(i)}
                      className="text-gray-300 hover:text-red-500 text-xs"
                      disabled={totals.rows.length <= 1}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold">
                <td colSpan={5} className="py-2 px-2 text-right text-xs text-gray-600">Total</td>
                <td className="py-2 px-2 text-right text-xs font-mono text-primary-800">₦{formatNaira(totals.total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <button onClick={addRow} className="btn-secondary text-xs px-3 py-1.5">+ Add Row</button>
          <button onClick={handleValidate} disabled={validating} className="btn-primary text-sm px-5 py-2">
            {validating ? 'Validating…' : 'Validate BOQ'}
          </button>
        </div>
      </motion.div>

      {expected.total != null && (
        <div className="card bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-700 font-semibold mb-1">Expected Total</p>
          <p className="text-lg font-bold font-mono text-blue-800">₦{formatNaira(expected.total)}</p>
        </div>
      )}

      {feedback && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`card ${feedback.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="text-sm font-semibold mb-2">{feedback.passed ? '✓ BOQ Looks Good!' : '⚠ Issues Found'}</p>
          {feedback.errors?.length > 0 && (
            <ul className="space-y-1 mb-3">
              {feedback.errors.map((err, i) => (
                <li key={i} className="text-xs text-red-700 flex items-start gap-1">
                  <span>•</span> {err}
                </li>
              ))}
            </ul>
          )}
          {feedback.suggestions?.length > 0 && (
            <ul className="space-y-1">
              {feedback.suggestions.map((s, i) => (
                <li key={i} className="text-xs text-amber-700 flex items-start gap-1">
                  <span>💡</span> {s}
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}
    </div>
  );
}
