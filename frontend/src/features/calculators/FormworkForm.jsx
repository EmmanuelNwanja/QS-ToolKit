import { useState, useMemo } from 'react';
import { suggestFormwork } from './dimensionSuggestions';

const TABS = ['Slabs', 'Beams', 'Columns', 'Lintels', 'Staircase'];

export default function FormworkForm({ onCalculate, loading }) {
  const [tab, setTab]           = useState('Slabs');
  const [wastage, setWastage]   = useState(5);
  const [slabs, setSlabs]       = useState([{ name: 'Slab A', length_mm: '', width_mm: '', beam_width_mm: 225, no_beams_l: 0, no_beams_w: 0 }]);
  const [beams, setBeams]       = useState([{ name: 'Beam 1', length_mm: '', width_mm: 225, depth_mm: 450, quantity: 1 }]);
  const [columns, setColumns]   = useState([{ name: 'Columns', width_mm: 225, depth_mm: 225, height_mm: 3000, quantity: 1 }]);
  const [lintels, setLintels]   = useState([{ name: 'Lintel D1', length_mm: '', width_mm: 225, depth_mm: 225, quantity: 1 }]);
  const [stairEnabled, setStairEnabled] = useState(false);
  const [stair, setStair]       = useState({ waist_length_m: 3.09, width_m: 1.225, no_risers: 20, riser_h_mm: 150, tread_d_mm: 270, landing_l_m: 2.2, landing_w_m: 1.2 });

  const fwSuggest = useMemo(() => suggestFormwork({ beams, slabs, columns, lintels, stairEnabled, stair }), [beams, slabs, columns, lintels, stairEnabled, stair]);

  // Generic array item editors
  const addItem = (setter, template) => setter(arr => [...arr, { ...template, name: template.name + ' ' + (arr.length + 1) }]);
  const removeItem = (setter, i) => setter(arr => arr.filter((_, idx) => idx !== i));
  const updateItem = (setter, i, k, v) => setter(arr => arr.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({
      wastage_percent: +wastage,
      slabs:   slabs.map(s => ({ ...s, length_mm: +s.length_mm, width_mm: +s.width_mm, beam_width_mm: +s.beam_width_mm, no_beams_l: +s.no_beams_l, no_beams_w: +s.no_beams_w })),
      beams:   beams.map(b => ({ ...b, length_mm: +b.length_mm, width_mm: +b.width_mm, depth_mm: +b.depth_mm, quantity: +b.quantity })),
      columns: columns.map(c => ({ ...c, width_mm: +c.width_mm, depth_mm: +c.depth_mm, height_mm: +c.height_mm, quantity: +c.quantity })),
      lintels: lintels.map(l => ({ ...l, length_mm: +l.length_mm, width_mm: +l.width_mm, depth_mm: +l.depth_mm, quantity: +l.quantity })),
      staircase: stairEnabled ? { ...stair, waist_length_m: +stair.waist_length_m, width_m: +stair.width_m, no_risers: +stair.no_risers, riser_h_mm: +stair.riser_h_mm, tread_d_mm: +stair.tread_d_mm, landing_l_m: +stair.landing_l_m, landing_w_m: +stair.landing_w_m } : null
    });
  };

  const inputCls = 'input py-1 text-xs';
  const lbl      = 'label text-xs';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {/* Wastage */}
      <div className="flex items-center gap-3">
        <div className="w-28">
          <label className={lbl}>Wastage (%)</label>
          <input type="number" className={inputCls} value={wastage} onChange={e => setWastage(e.target.value)} min={0} max={20} />
        </div>
        <p className="text-xs text-gray-400 mt-4 flex-1">Enter only the elements present in your project.</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 flex-wrap bg-gray-100 rounded-lg p-1">
        {TABS.map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${tab === t ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Slabs ───────────────────────────────────────────────────── */}
      {tab === 'Slabs' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Soffit area of suspended floor slabs (less beam widths)</p>
            <button type="button" onClick={() => addItem(setSlabs, { name: 'Slab', length_mm: '', width_mm: '', beam_width_mm: 225, no_beams_l: 0, no_beams_w: 0 })} className="text-xs text-primary-600">+ Add Slab</button>
          </div>
          {slabs.map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <input className={`${inputCls} w-28`} value={s.name} onChange={e => updateItem(setSlabs, i, 'name', e.target.value)} placeholder="Slab name" />
                {slabs.length > 1 && <button type="button" onClick={() => removeItem(setSlabs, i)} className="text-xs text-red-400">Remove</button>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Length (mm)</label><input type="number" className={inputCls} value={s.length_mm} onChange={e => updateItem(setSlabs, i, 'length_mm', e.target.value)} placeholder="e.g. 10500" /></div>
                <div><label className={lbl}>Width (mm)</label><input type="number" className={inputCls} value={s.width_mm} onChange={e => updateItem(setSlabs, i, 'width_mm', e.target.value)} placeholder="e.g. 3937" /></div>
                <div><label className={lbl}>Beam Width (mm)</label><input type="number" className={inputCls} value={s.beam_width_mm} onChange={e => updateItem(setSlabs, i, 'beam_width_mm', e.target.value)} /></div>
                <div><label className={lbl}>No. Beams (L dir.)</label><input type="number" className={inputCls} value={s.no_beams_l} onChange={e => updateItem(setSlabs, i, 'no_beams_l', e.target.value)} /></div>
                <div><label className={lbl}>No. Beams (W dir.)</label><input type="number" className={inputCls} value={s.no_beams_w} onChange={e => updateItem(setSlabs, i, 'no_beams_w', e.target.value)} /></div>
              </div>
              {fwSuggest.slabs.filter(sg => sg.index === i && sg.soffitAreaM2).map((sg, si) => <p key={si} className="text-gold-600 text-xs mt-1">Suggestion: {sg.soffitAreaM2}m² soffit area</p>)}
            </div>
          ))}
        </div>
      )}

      {/* ── Beams ───────────────────────────────────────────────────── */}
      {tab === 'Beams' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Sides + soffit of rectangular beams</p>
            <button type="button" onClick={() => addItem(setBeams, { name: 'Beam', length_mm: '', width_mm: 225, depth_mm: 450, quantity: 1 })} className="text-xs text-primary-600">+ Add Beam</button>
          </div>
          {beams.map((b, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <input className={`${inputCls} w-24`} value={b.name} onChange={e => updateItem(setBeams, i, 'name', e.target.value)} />
                {beams.length > 1 && <button type="button" onClick={() => removeItem(setBeams, i)} className="text-xs text-red-400">Remove</button>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Length (mm)</label><input type="number" className={inputCls} value={b.length_mm} onChange={e => updateItem(setBeams, i, 'length_mm', e.target.value)} placeholder="e.g. 13350" /></div>
                <div><label className={lbl}>Width (mm)</label><input type="number" className={inputCls} value={b.width_mm} onChange={e => updateItem(setBeams, i, 'width_mm', e.target.value)} />{fwSuggest.beams.filter(s => s.index === i).map((s, si) => <span key={si} className="text-gold-600 text-xs ml-1">Suggestion: {s.width}mm</span>)}</div>
                <div><label className={lbl}>Depth (mm)</label><input type="number" className={inputCls} value={b.depth_mm} onChange={e => updateItem(setBeams, i, 'depth_mm', e.target.value)} />{fwSuggest.beams.filter(s => s.index === i).map((s, si) => <span key={si} className="text-gold-600 text-xs ml-1">Suggestion: {s.depth}mm</span>)}</div>
                <div><label className={lbl}>Quantity</label><input type="number" className={inputCls} value={b.quantity} onChange={e => updateItem(setBeams, i, 'quantity', e.target.value)} /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Columns ─────────────────────────────────────────────────── */}
      {tab === 'Columns' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">4 vertical faces of isolated columns</p>
            <button type="button" onClick={() => addItem(setColumns, { name: 'Columns', width_mm: 225, depth_mm: 225, height_mm: 3000, quantity: 1 })} className="text-xs text-primary-600">+ Add Group</button>
          </div>
          {columns.map((c, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
              <input className={`${inputCls} w-28`} value={c.name} onChange={e => updateItem(setColumns, i, 'name', e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Width (mm)</label><input type="number" className={inputCls} value={c.width_mm} onChange={e => updateItem(setColumns, i, 'width_mm', e.target.value)} />{fwSuggest.columns.filter(sg => sg.index === i).map((sg, si) => <span key={si} className="text-gold-600 text-xs ml-1">Suggestion: {sg.width}mm</span>)}</div>
                <div><label className={lbl}>Depth (mm)</label><input type="number" className={inputCls} value={c.depth_mm} onChange={e => updateItem(setColumns, i, 'depth_mm', e.target.value)} />{fwSuggest.columns.filter(sg => sg.index === i).map((sg, si) => <span key={si} className="text-gold-600 text-xs ml-1">Suggestion: {sg.depth}mm</span>)}</div>
                <div><label className={lbl}>Height (mm)</label><input type="number" className={inputCls} value={c.height_mm} onChange={e => updateItem(setColumns, i, 'height_mm', e.target.value)} /></div>
                <div><label className={lbl}>Quantity</label><input type="number" className={inputCls} value={c.quantity} onChange={e => updateItem(setColumns, i, 'quantity', e.target.value)} /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Lintels ─────────────────────────────────────────────────── */}
      {tab === 'Lintels' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Attached lintel & beam partition from blockwall</p>
            <button type="button" onClick={() => addItem(setLintels, { name: 'Lintel', length_mm: '', width_mm: 225, depth_mm: 225, quantity: 1 })} className="text-xs text-primary-600">+ Add</button>
          </div>
          {lintels.map((l, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
              <input className={`${inputCls} w-28`} value={l.name} onChange={e => updateItem(setLintels, i, 'name', e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Length (mm)</label><input type="number" className={inputCls} value={l.length_mm} onChange={e => updateItem(setLintels, i, 'length_mm', e.target.value)} /></div>
                <div><label className={lbl}>Width (mm)</label><input type="number" className={inputCls} value={l.width_mm} onChange={e => updateItem(setLintels, i, 'width_mm', e.target.value)} />{fwSuggest.lintels.filter(sg => sg.index === i).map((sg, si) => <span key={si} className="text-gold-600 text-xs ml-1">Suggestion: {sg.width}mm</span>)}</div>
                <div><label className={lbl}>Depth (mm)</label><input type="number" className={inputCls} value={l.depth_mm} onChange={e => updateItem(setLintels, i, 'depth_mm', e.target.value)} />{fwSuggest.lintels.filter(sg => sg.index === i).map((sg, si) => <span key={si} className="text-gold-600 text-xs ml-1">Suggestion: {sg.depth}mm</span>)}</div>
                <div><label className={lbl}>Quantity</label><input type="number" className={inputCls} value={l.quantity} onChange={e => updateItem(setLintels, i, 'quantity', e.target.value)} /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Staircase ────────────────────────────────────────────────── */}
      {tab === 'Staircase' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="stairEnabled" checked={stairEnabled} onChange={e => setStairEnabled(e.target.checked)} className="rounded" />
            <label htmlFor="stairEnabled" className="text-sm text-gray-700">Include staircase formwork</label>
          </div>
          {stairEnabled && (
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-2">
              <div><label className={lbl}>Waist Length (m)</label><input type="number" step="0.01" className={inputCls} value={stair.waist_length_m} onChange={e => setStair(s => ({ ...s, waist_length_m: e.target.value }))} />{fwSuggest.staircase.map((sg, si) => <span key={si} className="text-gold-600 text-xs ml-1">Est.: {sg.waistLengthM}m</span>)}</div>
              <div><label className={lbl}>Stair Width (m)</label><input type="number" step="0.01" className={inputCls} value={stair.width_m} onChange={e => setStair(s => ({ ...s, width_m: e.target.value }))} /></div>
              <div><label className={lbl}>No. of Risers</label><input type="number" className={inputCls} value={stair.no_risers} onChange={e => setStair(s => ({ ...s, no_risers: e.target.value }))} /></div>
              <div><label className={lbl}>Riser Height (mm)</label><input type="number" className={inputCls} value={stair.riser_h_mm} onChange={e => setStair(s => ({ ...s, riser_h_mm: e.target.value }))} /></div>
              <div><label className={lbl}>Landing Length (m)</label><input type="number" step="0.01" className={inputCls} value={stair.landing_l_m} onChange={e => setStair(s => ({ ...s, landing_l_m: e.target.value }))} /></div>
              <div><label className={lbl}>Landing Width (m)</label><input type="number" step="0.01" className={inputCls} value={stair.landing_w_m} onChange={e => setStair(s => ({ ...s, landing_w_m: e.target.value }))} /></div>
            </div>
          )}
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? '⏳ Calculating…' : '📐 Calculate Formwork'}
      </button>
    </form>
  );
}
