// EarthworkForm.jsx
import { useState, useMemo } from 'react';
import { suggestEarthwork } from './dimensionSuggestions';
export default function EarthworkForm({ onCalculate, loading }) {
  const [soilType, setSoilType] = useState('loam');
  const [sections, setSections] = useState([{ length: '', width: '', depth: '' }]);
  const [workingSpace, setWorkingSpace] = useState(300);
  const [workingSpaceMode, setWorkingSpaceMode] = useState('both_sides');
  const [excavationMethod, setExcavationMethod] = useState('mechanical');
  const [excavationType, setExcavationType] = useState('trench');
  const [backfillFactor, setBackfillFactor] = useState(0.6);
  const [compactionUnit, setCompactionUnit] = useState('m3');
  const earthSuggest = useMemo(() => suggestEarthwork({ sections, working_space_mm: workingSpace, working_space_mode: workingSpaceMode, soil_type: soilType }), [sections, workingSpace, workingSpaceMode, soilType]);
  const add = () => setSections(s => [...s, { length: '', width: '', depth: '' }]);
  const update = (i, k, v) => setSections(s => s.map((el, idx) => idx === i ? { ...el, [k]: v } : el));
  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({
      sections: sections.map(s => ({ length: +s.length, width: +s.width, depth: +s.depth })),
      soil_type: soilType,
      working_space_mm: +workingSpace,
      working_space_mode: workingSpaceMode,
      excavation_method: excavationMethod,
      excavation_type: excavationType,
      backfill_factor: +backfillFactor,
      compaction_unit: compactionUnit
    });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Soil Type</label>
          <select className="input" value={soilType} onChange={e => setSoilType(e.target.value)}>
            <option value="loam">Loam (BF 1.25)</option>
            <option value="clay">Clay (BF 1.35)</option>
            <option value="sandy">Sandy (BF 1.15)</option>
            <option value="laterite">Laterite (BF 1.20)</option>
          </select>
        </div>
        <div><label className="label">Excavation Method</label>
          <select className="input" value={excavationMethod} onChange={e => setExcavationMethod(e.target.value)}>
            <option value="mechanical">Mechanical</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Excavation Type</label>
          <select className="input" value={excavationType} onChange={e => setExcavationType(e.target.value)}>
            <option value="trench">Trench</option>
            <option value="bulk">Bulk</option>
          </select>
        </div>
        <div><label className="label">Working Space (mm)</label>
          <input type="number" min="0" className="input" value={workingSpace} onChange={e => setWorkingSpace(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className="label">Working Space Mode</label>
          <select className="input" value={workingSpaceMode} onChange={e => setWorkingSpaceMode(e.target.value)}>
            <option value="both_sides">Both Sides</option>
            <option value="single_side">Single Side</option>
          </select>
        </div>
        <div><label className="label">Backfill Factor</label>
          <input type="number" step="0.01" min="0" max="1" className="input" value={backfillFactor} onChange={e => setBackfillFactor(e.target.value)} />
        </div>
        <div><label className="label">Compaction Unit</label>
          <select className="input" value={compactionUnit} onChange={e => setCompactionUnit(e.target.value)}>
            <option value="m3">m3</option>
            <option value="m2">m2</option>
          </select>
        </div>
      </div>
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2"><label className="label mb-0">Sections</label><button type="button" onClick={add} className="text-xs text-primary-600">+ Add</button></div>
        {sections.map((s, i) => (
          <div key={i}>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div><label className="label text-xs">Length (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={s.length} onChange={e => update(i,'length',e.target.value)} required /></div>
              <div><label className="label text-xs">Width (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={s.width} onChange={e => update(i,'width',e.target.value)} required /></div>
              <div><label className="label text-xs">Depth (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={s.depth} onChange={e => update(i,'depth',e.target.value)} required /></div>
            </div>
            {earthSuggest[i]?.inSituVolume ? <p className="text-gold-600 text-xs">Suggestion: {earthSuggest[i].inSituVolume}m³ in-situ → ~{earthSuggest[i].looseVolume}m³ loose, ~{earthSuggest[i].estimatedTruckLoads} truck loads</p> : null}
          </div>
        ))}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? '⏳ Calculating…' : '🧮 Calculate'}</button>
    </form>
  );
}
