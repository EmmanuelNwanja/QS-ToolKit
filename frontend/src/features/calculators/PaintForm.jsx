// PaintForm.jsx
import { useState, useMemo } from 'react';
import { suggestPaint } from './dimensionSuggestions';
export default function PaintForm({ onCalculate, loading }) {
  const [coats, setCoats] = useState(2);
  const [coverage, setCoverage] = useState(10);
  const [primer, setPrimer] = useState(true);
  const [openingsConfirmed, setOpeningsConfirmed] = useState(false);
  const [surfaces, setSurfaces] = useState([{ length: '', height: '', openings: [] }]);
  const paintSuggest = useMemo(() => suggestPaint({ coats, coverage_m2_per_litre: coverage, surfaces }), [coats, coverage, surfaces]);
  const add = () => setSurfaces(s => [...s, { length: '', height: '', openings: [] }]);
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
      surfaces: surfaces.map(s => ({ length: +s.length, height: +s.height, openings: s.openings.map(o => ({ width: +o.width, height: +o.height })) })),
      coats: +coats,
      coverage_m2_per_litre: +coverage,
      include_primer: primer,
      openings_deduction_confirmed: openingsConfirmed
    });
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
      <div className="flex items-center gap-2">
        <input type="checkbox" id="openingsConfirmedPaint" checked={openingsConfirmed} onChange={e => setOpeningsConfirmed(e.target.checked)} className="rounded" />
        <label htmlFor="openingsConfirmedPaint" className="text-sm text-gray-700">I have captured all door/window openings for deductions</label>
      </div>
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2"><label className="label mb-0">Surfaces</label><button type="button" onClick={add} className="text-xs text-primary-600">+ Add</button></div>
        {surfaces.map((s, i) => (
          <div key={i} className="rounded-md border border-gray-100 p-2 mb-2">
            <div className="grid grid-cols-2 gap-2 mb-2">
            <div><label className="label text-xs">Length (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={s.length} onChange={e => update(i,'length',e.target.value)} required /></div>
            <div><label className="label text-xs">Height (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={s.height} onChange={e => update(i,'height',e.target.value)} required /></div>
            </div>
            {paintSuggest[i]?.netArea ? <p className="text-gold-600 text-xs">Suggestion: {paintSuggest[i].netArea}m² → ~{paintSuggest[i].estimatedLitres}L paint</p> : null}
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
