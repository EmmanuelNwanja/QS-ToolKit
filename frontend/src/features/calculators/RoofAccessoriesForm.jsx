import { useState, useMemo } from 'react';
import { suggestRoofAccessories } from './dimensionSuggestions';

export default function RoofAccessoriesForm({ onCalculate, loading }) {
  const [form, setForm] = useState({
    building_length_mm:     13350,
    building_width_mm:      12525,
    roof_type:              'hipped',
    no_valleys:             0,
    valley_length_mm:       0,
    ridge_type:             'flashing',
    ridge_cap_width_mm:     600,
    metal_strap_spacing_mm: 1200,
    include_barge_board:    false,
    eaves_projection_mm:    900,
    wastage_percent:        10
  });
  const roofAccSuggest = useMemo(() => suggestRoofAccessories(form), [form]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({
      ...form,
      building_length_mm:     +form.building_length_mm,
      building_width_mm:      +form.building_width_mm,
      no_valleys:             +form.no_valleys,
      valley_length_mm:       +form.valley_length_mm,
      ridge_cap_width_mm:     +form.ridge_cap_width_mm,
      metal_strap_spacing_mm: +form.metal_strap_spacing_mm,
      eaves_projection_mm:    +form.eaves_projection_mm,
      wastage_percent:        +form.wastage_percent
    });
  };

  const inputCls = 'input py-1.5 text-xs';
  const lbl      = 'label text-xs';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>Building Length (mm)</label>
          <input type="number" className={inputCls} value={form.building_length_mm} onChange={e => set('building_length_mm', e.target.value)} required />
        </div>
        <div>
          <label className={lbl}>Building Width (mm)</label>
          <input type="number" className={inputCls} value={form.building_width_mm} onChange={e => set('building_width_mm', e.target.value)} required />
        </div>
        <div>
          <label className={lbl}>Roof Type</label>
          <select className={inputCls} value={form.roof_type} onChange={e => set('roof_type', e.target.value)}>
            <option value="hipped">Hipped</option>
            <option value="gabled">Gabled</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Eaves Projection (mm)</label>
          <input type="number" className={inputCls} value={form.eaves_projection_mm} onChange={e => set('eaves_projection_mm', e.target.value)} />
        </div>
      </div>

      {/* Ridge */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ridge Capping</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Ridge Type</label>
            <select className={inputCls} value={form.ridge_type} onChange={e => set('ridge_type', e.target.value)}>
              <option value="flashing">Flashing</option>
              <option value="ridge_tile">Ridge Tile</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Girth / Width (mm)</label>
            <input type="number" className={inputCls} value={form.ridge_cap_width_mm} onChange={e => set('ridge_cap_width_mm', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Valley gutters */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Valley Gutters</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Number of Valleys</label>
            <input type="number" className={inputCls} value={form.no_valleys} min={0} onChange={e => set('no_valleys', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Valley Length (mm)</label>
            <input type="number" className={inputCls} value={form.valley_length_mm} onChange={e => set('valley_length_mm', e.target.value)} disabled={+form.no_valleys === 0} />
          </div>
        </div>
      </div>

      {/* Metal straps */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Metal Fixing Straps</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Strap Spacing (mm)</label>
            <select className={inputCls} value={form.metal_strap_spacing_mm} onChange={e => set('metal_strap_spacing_mm', e.target.value)}>
              <option value={900}>900</option>
              <option value={1200}>1200</option>
              <option value={1500}>1500</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Wastage (%)</label>
            <input type="number" className={inputCls} value={form.wastage_percent} onChange={e => set('wastage_percent', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Barge board (gabled only) */}
      {form.roof_type === 'gabled' && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="barge" checked={form.include_barge_board} onChange={e => set('include_barge_board', e.target.checked)} />
          <label htmlFor="barge" className="text-sm text-gray-700">Include barge board (verge fascia)</label>
        </div>
      )}

      {roofAccSuggest.map((s, si) => <p key={si} className="text-gold-600 text-xs">Suggestion: Ridge ~{s.ridgeLengthMm}mm, fascia ~{s.fasciaLengthMm}mm, ~{s.estimatedStraps} straps</p>)}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? '⏳ Calculating…' : '🔩 Calculate Roof Accessories'}
      </button>
    </form>
  );
}
