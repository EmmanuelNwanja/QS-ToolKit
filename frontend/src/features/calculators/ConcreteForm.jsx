// ============================================================
//  ConcreteForm.jsx
// ============================================================
import { useState } from 'react';

const ELEMENT_TYPES = ['slab','column','beam','footing'];
const MIX_RATIOS = ['1:1:2','1:1.5:3','1:2:4','1:3:6'];

export default function ConcreteForm({ onCalculate, loading }) {
  const [mixRatio, setMixRatio] = useState('1:2:4');
  const [wastage, setWastage]   = useState(5);
  const [elements, setElements] = useState([
    { type: 'slab', length: '', width: '', thickness: '', count: 1 }
  ]);

  const addElement = () => setElements(e => [...e, { type: 'slab', length: '', width: '', thickness: '', count: 1 }]);
  const removeElement = (i) => setElements(e => e.filter((_, idx) => idx !== i));
  const updateElement = (i, key, val) => setElements(e => e.map((el, idx) => idx === i ? { ...el, [key]: val } : el));

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({ elements: elements.map(el => ({ ...el, length: +el.length, width: +el.width, thickness: +(el.thickness||0), height: +(el.height||0), depth: +(el.depth||0), count: +el.count })), mix_ratio: mixRatio, wastage_percent: +wastage });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div>
        <label className="label">Mix Ratio</label>
        <select className="input" value={mixRatio} onChange={e => setMixRatio(e.target.value)}>
          {MIX_RATIOS.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Wastage (%)</label>
        <input type="number" className="input" value={wastage} onChange={e => setWastage(e.target.value)} min={0} max={30} />
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <label className="label mb-0">Elements</label>
          <button type="button" onClick={addElement} className="text-xs text-primary-600 hover:underline">+ Add element</button>
        </div>
        {elements.map((el, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <select className="input py-1.5 text-xs w-32" value={el.type} onChange={e => updateElement(i, 'type', e.target.value)}>
                {ELEMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              {elements.length > 1 && (
                <button type="button" onClick={() => removeElement(i)} className="text-red-400 text-xs hover:text-red-600">Remove</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label text-xs">Length (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" placeholder="e.g. 10" value={el.length} onChange={e => updateElement(i,'length',e.target.value)} required /></div>
              <div><label className="label text-xs">Width (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" placeholder="e.g. 5" value={el.width} onChange={e => updateElement(i,'width',e.target.value)} required /></div>
              {el.type === 'slab' && <div className="col-span-2"><label className="label text-xs">Thickness (m)</label><input type="number" step="0.001" className="input py-1.5 text-xs" placeholder="e.g. 0.15" value={el.thickness} onChange={e => updateElement(i,'thickness',e.target.value)} required /></div>}
              {(el.type === 'column' || el.type === 'beam') && (
                <>
                  <div><label className="label text-xs">Depth (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={el.depth||''} onChange={e => updateElement(i,'depth',e.target.value)} /></div>
                  <div><label className="label text-xs">Height/Length (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={el.height||''} onChange={e => updateElement(i,'height',e.target.value)} /></div>
                </>
              )}
              {el.type === 'footing' && <div><label className="label text-xs">Depth (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={el.depth||''} onChange={e => updateElement(i,'depth',e.target.value)} /></div>}
              <div><label className="label text-xs">Qty / Count</label><input type="number" className="input py-1.5 text-xs" min={1} value={el.count} onChange={e => updateElement(i,'count',e.target.value)} /></div>
            </div>
          </div>
        ))}
      </div>

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? '⏳ Calculating…' : '🧮 Calculate'}
      </button>
    </form>
  );
}
