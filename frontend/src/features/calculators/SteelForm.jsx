// SteelForm.jsx
import { useState, useMemo } from 'react';
import { suggestSteel } from './dimensionSuggestions';
export default function SteelForm({ onCalculate, loading }) {
  const [bars, setBars] = useState([{ diameter_mm: 12, length_m: '', quantity: '' }]);
  const steelSuggest = useMemo(() => suggestSteel({ bars }), [bars]);
  const add = () => setBars(b => [...b, { diameter_mm: 12, length_m: '', quantity: '' }]);
  const remove = (i) => setBars(b => b.filter((_, idx) => idx !== i));
  const update = (i, k, v) => setBars(b => b.map((el, idx) => idx === i ? { ...el, [k]: v } : el));
  const DIAMETERS = [6, 8, 10, 12, 16, 20, 25, 32];
  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({ bars: bars.map(b => ({ diameter_mm: +b.diameter_mm, length_m: +b.length_m, quantity: +b.quantity })) });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="flex items-center justify-between"><label className="label mb-0">Rebar Schedule</label><button type="button" onClick={add} className="text-xs text-primary-600">+ Add bar</button></div>
      {bars.map((bar, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Bar {i + 1}</span>
            {bars.length > 1 && <button type="button" onClick={() => remove(i)} className="text-xs text-red-400">Remove</button>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="label text-xs">Diameter (mm)</label><select className="input py-1.5 text-xs" value={bar.diameter_mm} onChange={e => update(i,'diameter_mm',e.target.value)}>{DIAMETERS.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label className="label text-xs">Length (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={bar.length_m} onChange={e => update(i,'length_m',e.target.value)} required /></div>
            <div><label className="label text-xs">Quantity</label><input type="number" className="input py-1.5 text-xs" value={bar.quantity} onChange={e => update(i,'quantity',e.target.value)} required /></div>
          </div>
          {steelSuggest[i]?.weightPerBar ? <p className="text-gold-600 text-xs mt-1">Suggestion: {steelSuggest[i].weightPerBar} kg/bar{steelSuggest[i].totalKg ? `, total ~${steelSuggest[i].totalKg} kg` : ''}</p> : null}
        </div>
      ))}
      <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? '⏳ Calculating…' : '🧮 Calculate'}</button>
    </form>
  );
}
