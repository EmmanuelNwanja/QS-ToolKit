import { useState } from 'react';

const DOOR_TYPES = [
  { value: 'double_leaf_steel',  label: 'Double Leaf Steel' },
  { value: 'single_leaf_steel',  label: 'Single Leaf Steel' },
  { value: 'single_leaf_panel',  label: 'Single Leaf Panel (Wood)' },
  { value: 'single_leaf_flush',  label: 'Single Leaf Flush (Wood)' },
  { value: 'custom',             label: 'Custom' }
];

const WINDOW_TYPES = [
  { value: 'sliding_aluminium',  label: 'Two-Track Sliding Aluminium' },
  { value: 'casement_aluminium', label: 'Casement Projected Aluminium' },
  { value: 'louvre',             label: 'Louvre' },
  { value: 'fixed_light',        label: 'Fixed Light' },
  { value: 'custom',             label: 'Custom' }
];

// Standard sizes from Miracle's project
const STD_DOOR_SIZES  = ['1200x2100', '900x2100', '750x2100'];
const STD_WIN_SIZES   = ['1200x1200', '600x600', '600x1800', '1800x600'];

export default function DoorWindowForm({ onCalculate, loading }) {
  const [activeTab, setActiveTab] = useState('Doors');
  const [doors, setDoors]   = useState([{ ref: 'D1', type: 'double_leaf_steel', width_mm: 1200, height_mm: 2100, quantity: 2, note: '' }]);
  const [windows, setWindows] = useState([{ ref: 'W1', type: 'sliding_aluminium', width_mm: 1200, height_mm: 1200, quantity: 19, note: '' }]);
  const [bp, setBp]           = useState([{ ref: 'G1', width_mm: 1200, height_mm: 1200, quantity: 19, mesh_type: '25×25mm hollow square pipe' }]);

  const addDoor   = () => setDoors(d => [...d, { ref: `D${d.length + 1}`, type: 'single_leaf_panel', width_mm: 900, height_mm: 2100, quantity: 1, note: '' }]);
  const addWindow = () => setWindows(w => [...w, { ref: `W${w.length + 1}`, type: 'sliding_aluminium', width_mm: 1200, height_mm: 1200, quantity: 1, note: '' }]);
  const addBp     = () => setBp(b => [...b, { ref: `G${b.length + 1}`, width_mm: 1200, height_mm: 1200, quantity: 1, mesh_type: '25×25mm hollow square pipe' }]);

  const updateDoor   = (i, k, v) => setDoors(d => d.map((item, idx) => idx === i ? { ...item, [k]: v } : item));
  const updateWindow = (i, k, v) => setWindows(w => w.map((item, idx) => idx === i ? { ...item, [k]: v } : item));
  const updateBp     = (i, k, v) => setBp(b => b.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const removeDoor   = (i) => setDoors(d => d.filter((_, idx) => idx !== i));
  const removeWindow = (i) => setWindows(w => w.filter((_, idx) => idx !== i));
  const removeBp     = (i) => setBp(b => b.filter((_, idx) => idx !== i));

  const applyStdDoorSize = (i, sizeStr) => {
    const [w, h] = sizeStr.split('x').map(Number);
    updateDoor(i, 'width_mm', w);
    updateDoor(i, 'height_mm', h);
  };
  const applyStdWinSize = (i, sizeStr) => {
    const [w, h] = sizeStr.split('x').map(Number);
    updateWindow(i, 'width_mm', w);
    updateWindow(i, 'height_mm', h);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({
      doors:   doors.map(d => ({ ...d, width_mm: +d.width_mm, height_mm: +d.height_mm, quantity: +d.quantity })),
      windows: windows.map(w => ({ ...w, width_mm: +w.width_mm, height_mm: +w.height_mm, quantity: +w.quantity })),
      burglary_proof: bp.map(b => ({ ...b, width_mm: +b.width_mm, height_mm: +b.height_mm, quantity: +b.quantity }))
    });
  };

  const inputCls = 'input py-1 text-xs';
  const lbl = 'label text-xs';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {['Doors', 'Windows', 'Burglary Proof'].map(t => (
          <button key={t} type="button" onClick={() => setActiveTab(t)}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${activeTab === t ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Doors ────────────────────────────────────────────────────── */}
      {activeTab === 'Doors' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Add each door type and quantity</p>
            <button type="button" onClick={addDoor} className="text-xs text-primary-600 hover:underline">+ Add Door Type</button>
          </div>
          {doors.map((d, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input className={`${inputCls} w-14 text-center font-bold`} value={d.ref} onChange={e => updateDoor(i, 'ref', e.target.value)} placeholder="Ref" />
                  <span className="text-xs text-gray-400">Reference</span>
                </div>
                {doors.length > 1 && <button type="button" onClick={() => removeDoor(i)} className="text-xs text-red-400">Remove</button>}
              </div>
              <div>
                <label className={lbl}>Door Type</label>
                <select className={inputCls} value={d.type} onChange={e => updateDoor(i, 'type', e.target.value)}>
                  {DOOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className={lbl}>Size (quick select)</label>
                  <select className={inputCls} onChange={e => e.target.value && applyStdDoorSize(i, e.target.value)} defaultValue="">
                    <option value="">Select standard…</option>
                    {STD_DOOR_SIZES.map(s => <option key={s} value={s}>{s}mm</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={lbl}>Width (mm)</label><input type="number" className={inputCls} value={d.width_mm} onChange={e => updateDoor(i, 'width_mm', e.target.value)} /></div>
                <div><label className={lbl}>Height (mm)</label><input type="number" className={inputCls} value={d.height_mm} onChange={e => updateDoor(i, 'height_mm', e.target.value)} /></div>
                <div><label className={lbl}>Quantity</label><input type="number" className={inputCls} min={1} value={d.quantity} onChange={e => updateDoor(i, 'quantity', e.target.value)} /></div>
              </div>
              <div><label className={lbl}>Notes (optional)</label><input className={inputCls} value={d.note} onChange={e => updateDoor(i, 'note', e.target.value)} placeholder="e.g. Main entrance" /></div>
            </div>
          ))}
        </div>
      )}

      {/* ── Windows ──────────────────────────────────────────────────── */}
      {activeTab === 'Windows' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Add each window type and quantity</p>
            <button type="button" onClick={addWindow} className="text-xs text-primary-600 hover:underline">+ Add Window Type</button>
          </div>
          {windows.map((w, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input className={`${inputCls} w-14 text-center font-bold`} value={w.ref} onChange={e => updateWindow(i, 'ref', e.target.value)} />
                  <span className="text-xs text-gray-400">Reference</span>
                </div>
                {windows.length > 1 && <button type="button" onClick={() => removeWindow(i)} className="text-xs text-red-400">Remove</button>}
              </div>
              <div>
                <label className={lbl}>Window Type</label>
                <select className={inputCls} value={w.type} onChange={e => updateWindow(i, 'type', e.target.value)}>
                  {WINDOW_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className={lbl}>Quick size select</label>
                  <select className={inputCls} onChange={e => e.target.value && applyStdWinSize(i, e.target.value)} defaultValue="">
                    <option value="">Select standard…</option>
                    {STD_WIN_SIZES.map(s => <option key={s} value={s}>{s}mm</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={lbl}>Width (mm)</label><input type="number" className={inputCls} value={w.width_mm} onChange={e => updateWindow(i, 'width_mm', e.target.value)} /></div>
                <div><label className={lbl}>Height (mm)</label><input type="number" className={inputCls} value={w.height_mm} onChange={e => updateWindow(i, 'height_mm', e.target.value)} /></div>
                <div><label className={lbl}>Quantity</label><input type="number" className={inputCls} min={1} value={w.quantity} onChange={e => updateWindow(i, 'quantity', e.target.value)} /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Burglary Proof ───────────────────────────────────────────── */}
      {activeTab === 'Burglary Proof' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">25×25mm hollow square pipe metalwork</p>
            <button type="button" onClick={addBp} className="text-xs text-primary-600 hover:underline">+ Add</button>
          </div>
          {bp.map((b, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
              <div className="flex items-center justify-between">
                <input className={`${inputCls} w-14 text-center font-bold`} value={b.ref} onChange={e => updateBp(i, 'ref', e.target.value)} />
                {bp.length > 1 && <button type="button" onClick={() => removeBp(i)} className="text-xs text-red-400">Remove</button>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={lbl}>Width (mm)</label><input type="number" className={inputCls} value={b.width_mm} onChange={e => updateBp(i, 'width_mm', e.target.value)} /></div>
                <div><label className={lbl}>Height (mm)</label><input type="number" className={inputCls} value={b.height_mm} onChange={e => updateBp(i, 'height_mm', e.target.value)} /></div>
                <div><label className={lbl}>Quantity</label><input type="number" className={inputCls} min={1} value={b.quantity} onChange={e => updateBp(i, 'quantity', e.target.value)} /></div>
              </div>
              <div><label className={lbl}>Mesh/Pipe Type</label><input className={inputCls} value={b.mesh_type} onChange={e => updateBp(i, 'mesh_type', e.target.value)} /></div>
            </div>
          ))}
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? '⏳ Generating Schedule…' : '🚪 Generate Schedule'}
      </button>
    </form>
  );
}
