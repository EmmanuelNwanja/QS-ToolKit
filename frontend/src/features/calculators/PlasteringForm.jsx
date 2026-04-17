// PlasteringForm.jsx
import { useState } from 'react';
export default function PlasteringForm({ onCalculate, loading }) {
  const [thickness, setThickness] = useState(15);
  const [mortarRatio, setMortarRatio] = useState('1:4');
  const [wastage, setWastage] = useState(10);
  const [openingsConfirmed, setOpeningsConfirmed] = useState(false);
  const [surfaces, setSurfaces] = useState([{ length: '', height: '', openings: [] }]);

  const addSurface = () => setSurfaces(s => [...s, { length: '', height: '', openings: [] }]);
  const update = (i, k, v) => setSurfaces(s => s.map((el, idx) => idx === i ? { ...el, [k]: v } : el));
  const addOpening = (surfaceIdx) => setSurfaces((state) => state.map((surface, idx) => (
    idx === surfaceIdx ? { ...surface, openings: [...(surface.openings || []), { width: '', height: '' }] } : surface
  )));
  const updateOpening = (surfaceIdx, openingIdx, key, value) => setSurfaces((state) => state.map((surface, idx) => {
    if (idx !== surfaceIdx) return surface;
    return {
      ...surface,
      openings: (surface.openings || []).map((opening, oi) => (oi === openingIdx ? { ...opening, [key]: value } : opening))
    };
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({
      surfaces: surfaces.map(s => ({ length: +s.length, height: +s.height, openings: (s.openings || []).map((o) => ({ width: +o.width, height: +o.height })) })),
      thickness_mm: +thickness,
      mortar_ratio: mortarRatio,
      wastage_percent: +wastage,
      openings_deduction_confirmed: openingsConfirmed
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <div><label className="label">Thickness (mm)</label><input type="number" className="input" value={thickness} onChange={e => setThickness(e.target.value)} /></div>
        <div><label className="label">Mix Ratio</label><select className="input" value={mortarRatio} onChange={e => setMortarRatio(e.target.value)}><option value="1:3">1:3</option><option value="1:4">1:4</option></select></div>
        <div><label className="label">Wastage (%)</label><input type="number" className="input" value={wastage} onChange={e => setWastage(e.target.value)} /></div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="openingsConfirmedPlaster" checked={openingsConfirmed} onChange={e => setOpeningsConfirmed(e.target.checked)} className="rounded" />
        <label htmlFor="openingsConfirmedPlaster" className="text-sm text-gray-700">I have captured all door/window openings for deductions</label>
      </div>
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2"><label className="label mb-0">Surfaces</label><button type="button" onClick={addSurface} className="text-xs text-primary-600">+ Add surface</button></div>
        {surfaces.map((s, i) => (
          <div key={i} className="rounded-md border border-gray-100 p-2 mb-2">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><label className="label text-xs">Length (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={s.length} onChange={e => update(i,'length',e.target.value)} required /></div>
              <div><label className="label text-xs">Height (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={s.height} onChange={e => update(i,'height',e.target.value)} required /></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="label text-xs mb-0">Openings Deductions</label>
                <button type="button" onClick={() => addOpening(i)} className="text-xs text-primary-600">+ Add Opening</button>
              </div>
              {(s.openings || []).map((opening, oi) => (
                <div key={`${i}-opening-${oi}`} className="grid grid-cols-2 gap-2">
                  <div><input type="number" step="0.01" className="input py-1.5 text-xs" placeholder="Width (m)" value={opening.width} onChange={e => updateOpening(i, oi, 'width', e.target.value)} /></div>
                  <div><input type="number" step="0.01" className="input py-1.5 text-xs" placeholder="Height (m)" value={opening.height} onChange={e => updateOpening(i, oi, 'height', e.target.value)} /></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? '⏳ Calculating…' : '🧮 Calculate'}</button>
    </form>
  );
}
