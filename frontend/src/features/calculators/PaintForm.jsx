// PaintForm.jsx
import { useState } from 'react';
export default function PaintForm({ onCalculate, loading }) {
  const [coats, setCoats] = useState(2);
  const [coverage, setCoverage] = useState(10);
  const [primer, setPrimer] = useState(true);
  const [surfaces, setSurfaces] = useState([{ length: '', height: '', openings: [] }]);
  const add = () => setSurfaces(s => [...s, { length: '', height: '', openings: [] }]);
  const update = (i, k, v) => setSurfaces(s => s.map((el, idx) => idx === i ? { ...el, [k]: v } : el));
  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({ surfaces: surfaces.map(s => ({ length: +s.length, height: +s.height, openings: s.openings.map(o => ({ width: +o.width, height: +o.height })) })), coats: +coats, coverage_m2_per_litre: +coverage, include_primer: primer });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">No. of Coats</label><input type="number" className="input" value={coats} onChange={e => setCoats(e.target.value)} min={1} max={5} /></div>
        <div><label className="label">Coverage (m²/L)</label><input type="number" className="input" value={coverage} onChange={e => setCoverage(e.target.value)} /></div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="primer" checked={primer} onChange={e => setPrimer(e.target.checked)} className="rounded" />
        <label htmlFor="primer" className="text-sm text-gray-700">Include primer coat</label>
      </div>
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2"><label className="label mb-0">Surfaces</label><button type="button" onClick={add} className="text-xs text-primary-600">+ Add</button></div>
        {surfaces.map((s, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 mb-2">
            <div><label className="label text-xs">Length (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={s.length} onChange={e => update(i,'length',e.target.value)} required /></div>
            <div><label className="label text-xs">Height (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={s.height} onChange={e => update(i,'height',e.target.value)} required /></div>
          </div>
        ))}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? '⏳ Calculating…' : '🧮 Calculate'}</button>
    </form>
  );
}
