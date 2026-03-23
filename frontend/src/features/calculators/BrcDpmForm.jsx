import { useState } from 'react';

const BRC_TYPES = [
  { value: 'A142', label: 'A142 — 2.22 kg/m² (6mm @ 200c/c)', note: 'Oversite slabs, light duty' },
  { value: 'A193', label: 'A193 — 3.02 kg/m² (7mm @ 200c/c)', note: 'Ground slabs, medium duty' },
  { value: 'A252', label: 'A252 — 3.95 kg/m² (8mm @ 200c/c)', note: 'Raft foundations' },
  { value: 'A393', label: 'A393 — 6.16 kg/m² (10mm @ 200c/c)', note: 'Heavy duty/raft slabs' }
];

export default function BrcDpmForm({ onCalculate, loading }) {
  const [areas, setAreas]   = useState([{ name: 'Store', length_mm: 13350, width_mm: 12525 }]);
  const [voids, setVoids]   = useState([]);
  const [form, setForm]     = useState({
    brc_mesh_type:        'A142',
    brc_side_lap_mm:      100,
    brc_end_lap_mm:       200,
    include_dpm:          true,
    dpm_laps_mm:          150,
    include_dpc:          true,
    dpc_width_mm:         225,
    dpc_perimeter_m:      0,
    include_herbicide:    true,
    include_oversite_concrete: false,
    oversite_thickness_mm: 150,
    oversite_mix:         '1:2:4',
    wastage_percent:      10
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addArea  = () => setAreas(a => [...a, { name: `Room ${a.length + 1}`, length_mm: '', width_mm: '' }]);
  const addVoid  = () => setVoids(v => [...v, { name: 'Void/Pit', length_mm: '', width_mm: '' }]);
  const updateArr = (setter, i, k, v) => setter(arr => arr.map((item, idx) => idx === i ? { ...item, [k]: v } : item));
  const removeArr = (setter, i) => setter(arr => arr.filter((_, idx) => idx !== i));

  const selectedBrc = BRC_TYPES.find(b => b.value === form.brc_mesh_type);

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({
      ...form,
      brc_side_lap_mm:  +form.brc_side_lap_mm,
      brc_end_lap_mm:   +form.brc_end_lap_mm,
      dpm_laps_mm:      +form.dpm_laps_mm,
      dpc_width_mm:     +form.dpc_width_mm,
      dpc_perimeter_m:  +form.dpc_perimeter_m,
      oversite_thickness_mm: +form.oversite_thickness_mm,
      wastage_percent:  +form.wastage_percent,
      floor_areas: areas.map(a => ({ ...a, length_mm: +a.length_mm, width_mm: +a.width_mm })),
      voids: voids.map(v => ({ ...v, length_mm: +v.length_mm, width_mm: +v.width_mm }))
    });
  };

  const inputCls = 'input py-1.5 text-xs';
  const lbl = 'label text-xs';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">

      {/* Floor Areas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Floor Areas</p>
          <button type="button" onClick={addArea} className="text-xs text-primary-600 hover:underline">+ Add Area</button>
        </div>
        {areas.map((a, i) => (
          <div key={i} className="flex items-end gap-2 mb-2">
            <div className="w-20">
              <label className={lbl}>Name</label>
              <input className={inputCls} value={a.name} onChange={e => updateArr(setAreas, i, 'name', e.target.value)} />
            </div>
            <div className="flex-1">
              <label className={lbl}>Length (mm)</label>
              <input type="number" className={inputCls} value={a.length_mm} onChange={e => updateArr(setAreas, i, 'length_mm', e.target.value)} required />
            </div>
            <div className="flex-1">
              <label className={lbl}>Width (mm)</label>
              <input type="number" className={inputCls} value={a.width_mm} onChange={e => updateArr(setAreas, i, 'width_mm', e.target.value)} required />
            </div>
            {areas.length > 1 && <button type="button" onClick={() => removeArr(setAreas, i)} className="text-red-400 text-xs pb-2">✕</button>}
          </div>
        ))}
      </div>

      {/* Voids / deductions */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deductions (Voids / Pits)</p>
          <button type="button" onClick={addVoid} className="text-xs text-primary-600 hover:underline">+ Add Void</button>
        </div>
        {voids.length === 0 && <p className="text-xs text-gray-400">No voids/pits to deduct</p>}
        {voids.map((v, i) => (
          <div key={i} className="flex items-end gap-2 mb-2">
            <div className="w-20"><label className={lbl}>Name</label><input className={inputCls} value={v.name} onChange={e => updateArr(setVoids, i, 'name', e.target.value)} /></div>
            <div className="flex-1"><label className={lbl}>Length (mm)</label><input type="number" className={inputCls} value={v.length_mm} onChange={e => updateArr(setVoids, i, 'length_mm', e.target.value)} /></div>
            <div className="flex-1"><label className={lbl}>Width (mm)</label><input type="number" className={inputCls} value={v.width_mm} onChange={e => updateArr(setVoids, i, 'width_mm', e.target.value)} /></div>
            <button type="button" onClick={() => removeArr(setVoids, i)} className="text-red-400 text-xs pb-2">✕</button>
          </div>
        ))}
      </div>

      {/* BRC Mesh */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">BRC Wire Mesh</p>
        <div>
          <label className={lbl}>Mesh Type</label>
          <select className={inputCls} value={form.brc_mesh_type} onChange={e => set('brc_mesh_type', e.target.value)}>
            {BRC_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          {selectedBrc && <p className="text-xs text-blue-600 mt-1">💡 Use: {selectedBrc.note}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div><label className={lbl}>Side Lap (mm)</label><input type="number" className={inputCls} value={form.brc_side_lap_mm} onChange={e => set('brc_side_lap_mm', e.target.value)} /></div>
          <div><label className={lbl}>End Lap (mm)</label><input type="number" className={inputCls} value={form.brc_end_lap_mm} onChange={e => set('brc_end_lap_mm', e.target.value)} /></div>
          <div><label className={lbl}>Wastage (%)</label><input type="number" className={inputCls} value={form.wastage_percent} onChange={e => set('wastage_percent', e.target.value)} /></div>
        </div>
      </div>

      {/* Toggle items */}
      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Include in Calculation</p>

        {/* DPM */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <input type="checkbox" id="dpm" checked={form.include_dpm} onChange={e => set('include_dpm', e.target.checked)} />
            <label htmlFor="dpm" className="text-sm font-medium text-gray-700">Damp Proof Membrane (DPM)</label>
          </div>
          {form.include_dpm && (
            <div className="ml-5">
              <label className={lbl}>Lap size (mm)</label>
              <input type="number" className={`${inputCls} w-24`} value={form.dpm_laps_mm} onChange={e => set('dpm_laps_mm', e.target.value)} />
            </div>
          )}
        </div>

        {/* DPC */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <input type="checkbox" id="dpc" checked={form.include_dpc} onChange={e => set('include_dpc', e.target.checked)} />
            <label htmlFor="dpc" className="text-sm font-medium text-gray-700">Damp Proof Course (DPC)</label>
          </div>
          {form.include_dpc && (
            <div className="ml-5 grid grid-cols-2 gap-2">
              <div><label className={lbl}>DPC Width (mm)</label><input type="number" className={inputCls} value={form.dpc_width_mm} onChange={e => set('dpc_width_mm', e.target.value)} /></div>
              <div><label className={lbl}>Known Perimeter (m) <span className="text-gray-400">(0 = auto)</span></label><input type="number" className={inputCls} value={form.dpc_perimeter_m} onChange={e => set('dpc_perimeter_m', e.target.value)} /></div>
            </div>
          )}
        </div>

        {/* Herbicide */}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="herb" checked={form.include_herbicide} onChange={e => set('include_herbicide', e.target.checked)} />
          <label htmlFor="herb" className="text-sm font-medium text-gray-700">Surface Treatment (Herbicide)</label>
        </div>

        {/* Oversite concrete */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <input type="checkbox" id="oversite" checked={form.include_oversite_concrete} onChange={e => set('include_oversite_concrete', e.target.checked)} />
            <label htmlFor="oversite" className="text-sm font-medium text-gray-700">Oversite Concrete Bed</label>
          </div>
          {form.include_oversite_concrete && (
            <div className="ml-5 grid grid-cols-2 gap-2">
              <div><label className={lbl}>Thickness (mm)</label><input type="number" className={inputCls} value={form.oversite_thickness_mm} onChange={e => set('oversite_thickness_mm', e.target.value)} /></div>
              <div>
                <label className={lbl}>Mix Ratio</label>
                <select className={inputCls} value={form.oversite_mix} onChange={e => set('oversite_mix', e.target.value)}>
                  <option value="1:2:4">1:2:4</option>
                  <option value="1:3:6">1:3:6</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? '⏳ Calculating…' : '🕸️ Calculate BRC / DPM'}
      </button>
    </form>
  );
}
