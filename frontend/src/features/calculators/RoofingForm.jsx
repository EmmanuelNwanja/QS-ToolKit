import { useState, useMemo } from 'react';
import { suggestRoofing } from './dimensionSuggestions';
export default function RoofingForm({ onCalculate, loading }) {
  const [form, setForm] = useState({ roof_type: 'gable', length: '', width: '', pitch_degrees: 25, sheet_length_m: 3.6, sheet_width_m: 0.9, wastage_percent: 10, include_accessories: true });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const roofSuggest = useMemo(() => suggestRoofing(form), [form]);
  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({ ...form, length: +form.length, width: +form.width, pitch_degrees: +form.pitch_degrees, sheet_length_m: +form.sheet_length_m, sheet_width_m: +form.sheet_width_m, wastage_percent: +form.wastage_percent });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div><label className="label">Roof Type</label><select className="input" value={form.roof_type} onChange={e => set('roof_type', e.target.value)}><option value="gable">Gable</option><option value="hip">Hip</option><option value="flat">Flat</option></select></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Building Length (m)</label><input type="number" step="0.1" className="input" value={form.length} onChange={e => set('length', e.target.value)} required /></div>
        <div><label className="label">Building Width (m)</label><input type="number" step="0.1" className="input" value={form.width} onChange={e => set('width', e.target.value)} required /></div>
        <div><label className="label">Pitch (°)</label><input type="number" className="input" value={form.pitch_degrees} onChange={e => set('pitch_degrees', e.target.value)} min={0} max={60} /></div>
        <div><label className="label">Wastage (%)</label><input type="number" className="input" value={form.wastage_percent} onChange={e => set('wastage_percent', e.target.value)} /></div>
        <div><label className="label">Sheet Length (m)</label><input type="number" step="0.1" className="input" value={form.sheet_length_m} onChange={e => set('sheet_length_m', e.target.value)} /></div>
        <div><label className="label">Sheet Width (m)</label><input type="number" step="0.1" className="input" value={form.sheet_width_m} onChange={e => set('sheet_width_m', e.target.value)} /></div>
      </div>
      <div className="flex items-center gap-2"><input type="checkbox" checked={form.include_accessories} onChange={e => set('include_accessories', e.target.checked)} /><label className="text-sm text-gray-700">Include accessories (purlins, ridging)</label></div>
      {roofSuggest.map((s, si) => <p key={si} className="text-gold-600 text-xs">Suggestion: {s.roofArea}m² roof area, ~{s.estimatedSheets} sheets, ~{s.purlinLengthM}m purlin</p>)}
      <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? '⏳ Calculating…' : '🧮 Calculate'}</button>
    </form>
  );
}
