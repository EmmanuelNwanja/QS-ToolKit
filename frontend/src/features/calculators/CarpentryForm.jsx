import { useState } from 'react';

const TIMBER_SIZES = {
  wall_plate:  ['75x100', '75x150', '100x100'],
  tie_beam:    ['75x150', '100x150', '75x200'],
  king_post:   ['100x100', '75x100', '125x125'],
  rafter:      ['50x150', '50x175', '75x150'],
  purlin:      ['50x75', '50x100', '75x75'],
  fascia:      ['25x300', '25x225', '38x225']
};

export default function CarpentryForm({ onCalculate, loading }) {
  const [form, setForm] = useState({
    building_length_mm:   13350,
    building_width_mm:    12525,
    pitch_degrees:        25,
    eaves_projection_mm:  900,
    roof_type:            'hipped',
    wall_plate_size:      '75x100',
    tie_beam_size:        '75x150',
    king_post_size:       '100x100',
    rafter_size:          '50x150',
    purlin_size:          '50x75',
    fascia_size:          '25x300',
    wastage_percent:      10
  });
  const [sections, setSections] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addSection = () => setSections(s => [...s, { name: `Section ${String.fromCharCode(65 + s.length)}`, halfSpan_mm: '', length_mm: '' }]);
  const updateSection = (i, k, v) => setSections(s => s.map((sec, idx) => idx === i ? { ...sec, [k]: v } : sec));
  const removeSection = (i) => setSections(s => s.filter((_, idx) => idx !== i));

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate({
      ...form,
      building_length_mm:  +form.building_length_mm,
      building_width_mm:   +form.building_width_mm,
      pitch_degrees:       +form.pitch_degrees,
      eaves_projection_mm: +form.eaves_projection_mm,
      wastage_percent:     +form.wastage_percent,
      sections: sections.map(s => ({ ...s, halfSpan_mm: +s.halfSpan_mm, length_mm: +s.length_mm }))
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {/* Building dimensions */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Building Dimensions</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-xs">Building Length (mm)</label>
            <input type="number" className="input py-1.5 text-xs" value={form.building_length_mm}
              onChange={e => set('building_length_mm', e.target.value)} required />
            <p className="text-xs text-gray-400 mt-0.5">e.g. 13350 for Miracle project</p>
          </div>
          <div>
            <label className="label text-xs">Building Width (mm)</label>
            <input type="number" className="input py-1.5 text-xs" value={form.building_width_mm}
              onChange={e => set('building_width_mm', e.target.value)} required />
          </div>
          <div>
            <label className="label text-xs">Pitch Angle (°)</label>
            <input type="number" className="input py-1.5 text-xs" min={10} max={60} step={1}
              value={form.pitch_degrees} onChange={e => set('pitch_degrees', e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Eaves Projection (mm)</label>
            <input type="number" className="input py-1.5 text-xs" value={form.eaves_projection_mm}
              onChange={e => set('eaves_projection_mm', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Roof type + Wastage */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label text-xs">Roof Type</label>
          <select className="input py-1.5 text-xs" value={form.roof_type} onChange={e => set('roof_type', e.target.value)}>
            <option value="hipped">Hipped</option>
            <option value="gabled">Gabled</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">Wastage (%)</label>
          <input type="number" className="input py-1.5 text-xs" min={0} max={30} value={form.wastage_percent}
            onChange={e => set('wastage_percent', e.target.value)} />
        </div>
      </div>

      {/* Timber sizes toggle */}
      <div>
        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-primary-600 hover:underline flex items-center gap-1">
          {showAdvanced ? '▼' : '▶'} {showAdvanced ? 'Hide' : 'Show'} Timber Sizes
        </button>
        {showAdvanced && (
          <div className="mt-2 bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-2">
            {[
              { label: 'Wall Plate', key: 'wall_plate_size', sizes: TIMBER_SIZES.wall_plate },
              { label: 'Tie Beam',   key: 'tie_beam_size',   sizes: TIMBER_SIZES.tie_beam },
              { label: 'King Post',  key: 'king_post_size',  sizes: TIMBER_SIZES.king_post },
              { label: 'Rafter',     key: 'rafter_size',     sizes: TIMBER_SIZES.rafter },
              { label: 'Purlin',     key: 'purlin_size',     sizes: TIMBER_SIZES.purlin },
              { label: 'Fascia',     key: 'fascia_size',     sizes: TIMBER_SIZES.fascia }
            ].map(t => (
              <div key={t.key}>
                <label className="label text-xs">{t.label} (mm)</label>
                <select className="input py-1 text-xs" value={form[t.key]} onChange={e => set(t.key, e.target.value)}>
                  {t.sizes.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Optional: roof sections (for complex hipped roofs) */}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Optional: Individual Roof Sections
          </p>
          <button type="button" onClick={addSection} className="text-xs text-primary-600 hover:underline">+ Add section</button>
        </div>
        <p className="text-xs text-gray-400 mb-2">Add named sections (A, B, C…) from your drawings for section-by-section rafter details.</p>
        {sections.map((sec, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-2 mb-2 flex items-end gap-2">
            <div className="flex-1">
              <label className="label text-xs">Section Name</label>
              <input className="input py-1 text-xs" value={sec.name} onChange={e => updateSection(i, 'name', e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="label text-xs">Half Span (mm)</label>
              <input type="number" className="input py-1 text-xs" value={sec.halfSpan_mm} onChange={e => updateSection(i, 'halfSpan_mm', e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="label text-xs">Length (mm)</label>
              <input type="number" className="input py-1 text-xs" value={sec.length_mm} onChange={e => updateSection(i, 'length_mm', e.target.value)} />
            </div>
            <button type="button" onClick={() => removeSection(i)} className="text-red-400 text-xs pb-2">✕</button>
          </div>
        ))}
      </div>

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? '⏳ Calculating…' : '🪵 Calculate Timbers'}
      </button>
    </form>
  );
}
