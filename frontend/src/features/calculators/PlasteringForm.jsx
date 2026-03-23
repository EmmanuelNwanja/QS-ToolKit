// PlasteringForm.jsx
import { useState } from 'react';
export default function PlasteringForm({ onCalculate, loading }) {
  const [thickness, setThickness] = useState(15);
  const [mortarRatio, setMortarRatio] = useState('1:4');
  const [wastage, setWastage] = useState(10);
  const [surfaces, setSurfaces] = useState([{ length: '', height: '' }]);

  const addSurface = () => setSurfaces(s => [...s, { length: '', height: '' }]);
  const update = (i, k, v) => setSurfaces(s => s.map((el, idx) => idx === i ? { ...el, [k]: v } : el));

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({ surfaces: surfaces.map(s => ({ length: +s.length, height: +s.height })), thickness_mm: +thickness, mortar_ratio: mortarRatio, wastage_percent: +wastage });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <div><label className="label">Thickness (mm)</label><input type="number" className="input" value={thickness} onChange={e => setThickness(e.target.value)} /></div>
        <div><label className="label">Mix Ratio</label><select className="input" value={mortarRatio} onChange={e => setMortarRatio(e.target.value)}><option value="1:3">1:3</option><option value="1:4">1:4</option></select></div>
        <div><label className="label">Wastage (%)</label><input type="number" className="input" value={wastage} onChange={e => setWastage(e.target.value)} /></div>
      </div>
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2"><label className="label mb-0">Surfaces</label><button type="button" onClick={addSurface} className="text-xs text-primary-600">+ Add surface</button></div>
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
