import { useState } from 'react';
export default function TilingForm({ onCalculate, loading }) {
  const [tileL, setTileL] = useState(0.6);
  const [tileW, setTileW] = useState(0.6);
  const [wastage, setWastage] = useState(10);
  const [rooms, setRooms] = useState([{ length: '', width: '' }]);
  const add = () => setRooms(r => [...r, { length: '', width: '' }]);
  const update = (i, k, v) => setRooms(r => r.map((el, idx) => idx === i ? { ...el, [k]: v } : el));
  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({ rooms: rooms.map(r => ({ length: +r.length, width: +r.width })), tile_length_m: +tileL, tile_width_m: +tileW, wastage_percent: +wastage });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <div><label className="label">Tile L (m)</label><input type="number" step="0.05" className="input" value={tileL} onChange={e => setTileL(e.target.value)} /></div>
        <div><label className="label">Tile W (m)</label><input type="number" step="0.05" className="input" value={tileW} onChange={e => setTileW(e.target.value)} /></div>
        <div><label className="label">Wastage (%)</label><input type="number" className="input" value={wastage} onChange={e => setWastage(e.target.value)} /></div>
      </div>
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2"><label className="label mb-0">Rooms / Areas</label><button type="button" onClick={add} className="text-xs text-primary-600">+ Add</button></div>
        {rooms.map((r, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 mb-2">
            <div><label className="label text-xs">Length (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={r.length} onChange={e => update(i,'length',e.target.value)} required /></div>
            <div><label className="label text-xs">Width (m)</label><input type="number" step="0.01" className="input py-1.5 text-xs" value={r.width} onChange={e => update(i,'width',e.target.value)} required /></div>
          </div>
        ))}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? '⏳ Calculating…' : '🧮 Calculate'}</button>
    </form>
  );
}
