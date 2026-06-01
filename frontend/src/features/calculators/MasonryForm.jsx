// MasonryForm.jsx
import { useState, useMemo } from 'react';
import { suggestMasonry } from './dimensionSuggestions';
export default function MasonryForm({ onCalculate, loading }) {
  const [blockSize, setBlockSize] = useState('9inch');
  const [mortarRatio, setMortarRatio] = useState('1:6');
  const [wastage, setWastage] = useState(5);
  const [walls, setWalls] = useState([{ length: '', height: '', openings: [] }]);
  const masonrySuggest = useMemo(() => suggestMasonry({ block_size: blockSize, walls }), [blockSize, walls]);

  const addWall = () => setWalls(w => [...w, { length: '', height: '', openings: [] }]);
  const updateWall = (i, k, v) => setWalls(w => w.map((el, idx) => idx === i ? { ...el, [k]: v } : el));
  const addOpening = (i) => setWalls(w => w.map((el, idx) => idx === i ? { ...el, openings: [...el.openings, { width: '', height: '' }] } : el));

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({
      walls: walls.map(w => ({ ...w, length: +w.length, height: +w.height, openings: w.openings.map(o => ({ width: +o.width, height: +o.height })) })),
      block_size: blockSize, mortar_ratio: mortarRatio, wastage_percent: +wastage
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Block Size</label>
          <select className="input" value={blockSize} onChange={e => setBlockSize(e.target.value)}>
            <option value="9inch">9 Inch</option>
            <option value="6inch">6 Inch</option>
            <option value="5inch">5 Inch</option>
          </select>
        </div>
        <div>
          <label className="label">Mortar Ratio</label>
          <select className="input" value={mortarRatio} onChange={e => setMortarRatio(e.target.value)}>
            <option value="1:4">1:4</option>
            <option value="1:6">1:6</option>
          </select>
        </div>
      </div>
      <div><label className="label">Wastage (%)</label><input type="number" className="input" value={wastage} onChange={e => setWastage(e.target.value)} min={0} max={20} /></div>
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Walls</label>
          <button type="button" onClick={addWall} className="text-xs text-primary-600 hover:underline">+ Add wall</button>
        </div>
        {walls.map((wall, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label text-xs">Length (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={wall.length} onChange={e => updateWall(i,'length',e.target.value)} required /></div>
              <div><label className="label text-xs">Height (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={wall.height} onChange={e => updateWall(i,'height',e.target.value)} required /></div>
            </div>
            {masonrySuggest[i]?.netArea ? <p className="text-gold-600 text-xs">Suggestion: {masonrySuggest[i].netArea}m² net → ~{masonrySuggest[i].estimatedBlocks} blocks, {masonrySuggest[i].mortarM3}m³ mortar</p> : null}
            <button type="button" onClick={() => addOpening(i)} className="text-xs text-gray-500 hover:text-primary-600">+ Deduct opening (door/window)</button>
            {wall.openings.map((o, j) => (
              <div key={j} className="grid grid-cols-2 gap-2 ml-3">
                <div><label className="label text-xs">Opening W (m)</label><input type="number" step="0.01" className="input py-1 text-xs" value={o.width} onChange={e => { const w=[...wall.openings]; w[j]={...o,width:e.target.value}; updateWall(i,'openings',w); }} /></div>
                <div><label className="label text-xs">Opening H (m)</label><input type="number" step="0.01" className="input py-1 text-xs" value={o.height} onChange={e => { const w=[...wall.openings]; w[j]={...o,height:e.target.value}; updateWall(i,'openings',w); }} /></div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? '⏳ Calculating…' : '🧮 Calculate'}</button>
    </form>
  );
}
