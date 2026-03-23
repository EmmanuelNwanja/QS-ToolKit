// EarthworkForm.jsx
import { useState } from 'react';
export default function EarthworkForm({ onCalculate, loading }) {
  const [soilType, setSoilType] = useState('loam');
  const [sections, setSections] = useState([{ length: '', width: '', depth: '' }]);
  const add = () => setSections(s => [...s, { length: '', width: '', depth: '' }]);
  const update = (i, k, v) => setSections(s => s.map((el, idx) => idx === i ? { ...el, [k]: v } : el));
  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({ sections: sections.map(s => ({ length: +s.length, width: +s.width, depth: +s.depth })), soil_type: soilType });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div><label className="label">Soil Type</label>
        <select className="input" value={soilType} onChange={e => setSoilType(e.target.value)}>
          <option value="loam">Loam (BF 1.25)</option>
          <option value="clay">Clay (BF 1.35)</option>
          <option value="sandy">Sandy (BF 1.15)</option>
          <option value="laterite">Laterite (BF 1.20)</option>
        </select>
      </div>
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2"><label className="label mb-0">Sections</label><button type="button" onClick={add} className="text-xs text-primary-600">+ Add</button></div>
        {sections.map((s, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 mb-2">
            <div><label className="label text-xs">Length (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={s.length} onChange={e => update(i,'length',e.target.value)} required /></div>
            <div><label className="label text-xs">Width (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={s.width} onChange={e => update(i,'width',e.target.value)} required /></div>
            <div><label className="label text-xs">Depth (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={s.depth} onChange={e => update(i,'depth',e.target.value)} required /></div>
          </div>
        ))}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? '⏳ Calculating…' : '🧮 Calculate'}</button>
    </form>
  );
}
