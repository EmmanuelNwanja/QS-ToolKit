import { useState, useEffect, useMemo, useRef } from 'react';
import { projectAPI, boqAPI } from '../services/api';
import toast from 'react-hot-toast';

/* ═══════════════════════════════════════════════════════════════
   QS ITEM DATA — All 70 measurement items
   ═══════════════════════════════════════════════════════════════ */

const SUBSTRUCTURE_ITEMS = [
  { id: 1,  section: 'Site Works',      item: 'Site Clearance',                     unit: 'm²', formula: 'Length × Width',              defaultDims: { length: 15, width: 12 }, calc: (d) => d.length * d.width },
  { id: 2,  section: 'Site Works',      item: 'Remove Topsoil',                     unit: 'm³', formula: 'Length × Width × Depth',     defaultDims: { length: 15, width: 12, depth: 0.15 }, calc: (d) => d.length * d.width * d.depth },
  { id: 3,  section: 'Site Works',      item: 'Dispose Vegetation/Topsoil',         unit: 'm³', formula: 'Carry forward from Remove Topsoil', defaultDims: { carryForward: true }, calc: (d) => d.carryForward || 0, isCarryForward: true, carryForwardFrom: 2 },
  { id: 4,  section: 'Earthworks',      item: 'Trench Excavation (External Girth)',  unit: 'm³', formula: 'External Girth × Width × Depth', defaultDims: { girth: 54, width: 0.60, depth: 1.00 }, calc: (d) => d.girth * d.width * d.depth },
  { id: 5,  section: 'Earthworks',      item: 'Trench Excavation (Internal Girth)',  unit: 'm³', formula: 'Internal Girth × Width × Depth', defaultDims: { girth: 30, width: 0.60, depth: 1.00 }, calc: (d) => d.girth * d.width * d.depth },
  { id: 6,  section: 'Earthworks',      item: 'Pit Excavation',                     unit: 'm³', formula: 'Length × Width × Depth × No.', defaultDims: { length: 1.5, width: 1.5, depth: 1.2, count: 4 }, calc: (d) => d.length * d.width * d.depth * d.count },
  { id: 7,  section: 'Earthworks',      item: 'Earthwork Support to Trench Sides',  unit: 'm²', formula: 'Depth × Length × 2 Sides',   defaultDims: { depth: 1.00, length: 84, sides: 2 }, calc: (d) => d.depth * d.length * d.sides },
  { id: 8,  section: 'Earthworks',      item: 'Earthwork Support to Pit Sides',     unit: 'm²', formula: 'Perimeter × Depth × No.',     defaultDims: { perimeter: 6, depth: 1.2, count: 4 }, calc: (d) => d.perimeter * d.depth * d.count },
  { id: 9,  section: 'Foundation',      item: 'Anti-Termite Treatment',             unit: 'm²', formula: 'Area Treated',                 defaultDims: { length: 15, width: 12 }, calc: (d) => d.length * d.width },
  { id: 10, section: 'Foundation',      item: 'Concrete Blinding',                  unit: 'm³', formula: 'Length × Width × Thickness',  defaultDims: { length: 84, width: 0.60, thickness: 0.05 }, calc: (d) => d.length * d.width * d.thickness },
  { id: 11, section: 'Foundation',      item: 'Strip Footing Concrete',             unit: 'm³', formula: 'Length × Width × Thickness',  defaultDims: { length: 84, width: 0.60, thickness: 0.225 }, calc: (d) => d.length * d.width * d.thickness },
  { id: 12, section: 'Foundation',      item: 'Pad Footing Concrete',               unit: 'm³', formula: 'Length × Width × Depth × No.', defaultDims: { length: 1.5, width: 1.5, depth: 0.45, count: 4 }, calc: (d) => d.length * d.width * d.depth * d.count },
  { id: 13, section: 'Masonry',         item: 'Foundation Blockwork',               unit: 'm²', formula: 'Length × Height',              defaultDims: { length: 84, height: 0.90 }, calc: (d) => d.length * d.height },
  { id: 14, section: 'Masonry',         item: 'Foundation Columns (if any)',        unit: 'm³', formula: 'Length × Width × Height × No.', defaultDims: { length: 0.225, width: 0.225, height: 3.0, count: 4 }, calc: (d) => d.length * d.width * d.height * d.count },
  { id: 15, section: 'Backfilling',     item: 'Adjustment for Backfilling',         unit: 'm³', formula: 'Excavation − Concrete − Blockwork', defaultDims: { excavation: 50.40, concrete: 11.34, blockwork: 2.52 }, calc: (d) => d.excavation - d.concrete - d.blockwork },
  { id: 16, section: 'Backfilling',     item: 'Filling Around Foundations',         unit: 'm³', formula: 'Length × Width × Height',      defaultDims: { length: 84, width: 0.30, height: 0.90 }, calc: (d) => d.length * d.width * d.height },
  { id: 17, section: 'Backfilling',     item: 'Filling Around Building',            unit: 'm³', formula: 'Perimeter × Width × Height',   defaultDims: { perimeter: 54, width: 0.50, height: 0.30 }, calc: (d) => d.perimeter * d.width * d.height },
  { id: 18, section: 'Filling',         item: 'Laterite Filling',                   unit: 'm³', formula: 'Area × Thickness',             defaultDims: { area: 180, thickness: 0.15 }, calc: (d) => d.area * d.thickness },
  { id: 19, section: 'Filling',         item: 'Levelling & Compacting Laterite',    unit: 'm²', formula: 'Floor Area',                   defaultDims: { area: 180 }, calc: (d) => d.area },
  { id: 20, section: 'Filling',         item: 'Hardcore Filling',                   unit: 'm³', formula: 'Area × Thickness',             defaultDims: { area: 180, thickness: 0.15 }, calc: (d) => d.area * d.thickness },
  { id: 21, section: 'Filling',         item: 'Levelling & Compacting Hardcore',    unit: 'm²', formula: 'Floor Area',                   defaultDims: { area: 180 }, calc: (d) => d.area },
  { id: 22, section: 'Filling',         item: 'Sand Blinding',                      unit: 'm³', formula: 'Area × Thickness',             defaultDims: { area: 180, thickness: 0.05 }, calc: (d) => d.area * d.thickness },
  { id: 23, section: 'Ground Floor',    item: 'Damp Proof Membrane (DPM)',          unit: 'm²', formula: 'Floor Area',                   defaultDims: { area: 180 }, calc: (d) => d.area },
  { id: 24, section: 'Ground Floor',    item: 'Reinforcement Mesh',                 unit: 'm²', formula: 'Floor Area',                   defaultDims: { area: 180 }, calc: (d) => d.area },
  { id: 25, section: 'Ground Floor',    item: 'Formwork to Oversite Edges',         unit: 'm²', formula: 'Perimeter × Thickness',        defaultDims: { perimeter: 54, thickness: 0.10 }, calc: (d) => d.perimeter * d.thickness },
  { id: 26, section: 'Ground Floor',    item: 'Oversite Concrete',                  unit: 'm³', formula: 'Floor Area × Thickness',       defaultDims: { area: 180, thickness: 0.10 }, calc: (d) => d.area * d.thickness },
  { id: 27, section: 'Ground Floor',    item: 'Damp Proof Course (DPC)',            unit: 'm',  formula: 'Wall Length',                  defaultDims: { length: 84 }, calc: (d) => d.length },
];

const SUPERSTRUCTURE_ITEMS = [
  { id: 28, section: 'Frame',       item: 'Columns Concrete',         unit: 'm³', formula: 'Length × Width × Height × No.', defaultDims: { length: 0.225, width: 0.225, height: 3.0, count: 8 }, calc: (d) => d.length * d.width * d.height * d.count },
  { id: 29, section: 'Frame',       item: 'Columns Reinforcement',    unit: 'kg', formula: 'Bar Length × Unit Weight × No.', defaultDims: { barLength: 15, unitWeight: 1, count: 8 }, calc: (d) => d.barLength * d.unitWeight * d.count },
  { id: 30, section: 'Frame',       item: 'Columns Formwork',         unit: 'm²', formula: 'Perimeter × Height × No.',       defaultDims: { perimeter: 0.9, height: 3.0, count: 8 }, calc: (d) => d.perimeter * d.height * d.count },
  { id: 31, section: 'Frame',       item: 'Beam Concrete',            unit: 'm³', formula: 'Length × Width × Depth',          defaultDims: { length: 84, width: 0.225, depth: 0.45 }, calc: (d) => d.length * d.width * d.depth },
  { id: 32, section: 'Frame',       item: 'Beam Reinforcement',       unit: 'kg', formula: 'Unit Weight × Length',             defaultDims: { unitWeight: 4, length: 84 }, calc: (d) => d.unitWeight * d.length },
  { id: 33, section: 'Frame',       item: 'Beam Formwork (Sides)',    unit: 'm²', formula: '2 × Depth × Length',              defaultDims: { depth: 0.45, length: 84 }, calc: (d) => 2 * d.depth * d.length },
  { id: 34, section: 'Frame',       item: 'Beam Formwork (Soffit)',   unit: 'm²', formula: 'Width × Length',                  defaultDims: { width: 0.225, length: 84 }, calc: (d) => d.width * d.length },
  { id: 35, section: 'Frame',       item: 'Slab Concrete',            unit: 'm³', formula: 'Area × Thickness',                defaultDims: { area: 180, thickness: 0.15 }, calc: (d) => d.area * d.thickness },
  { id: 36, section: 'Frame',       item: 'Slab Reinforcement',       unit: 'kg', formula: 'Unit Weight × Area',              defaultDims: { unitWeight: 8, area: 180 }, calc: (d) => d.unitWeight * d.area },
  { id: 37, section: 'Frame',       item: 'Slab Formwork',            unit: 'm²', formula: 'Slab Area',                       defaultDims: { area: 180 }, calc: (d) => d.area },
  { id: 38, section: 'Walling',     item: 'External Blockwork',       unit: 'm²', formula: 'Length × Height − Openings',      defaultDims: { length: 54, height: 3, openings: 25 }, calc: (d) => (d.length * d.height) - d.openings },
  { id: 39, section: 'Walling',     item: 'Internal Blockwork',       unit: 'm²', formula: 'Length × Height − Openings',      defaultDims: { length: 30, height: 3, openings: 10 }, calc: (d) => (d.length * d.height) - d.openings },
  { id: 40, section: 'Walling',     item: 'Partition Walls',          unit: 'm²', formula: 'Length × Height',                 defaultDims: { length: 20, height: 3 }, calc: (d) => d.length * d.height },
  { id: 41, section: 'Walling',     item: 'Lintel Concrete',          unit: 'm³', formula: 'Length × Width × Depth',          defaultDims: { length: 20, width: 0.225, depth: 0.15 }, calc: (d) => d.length * d.width * d.depth },
  { id: 42, section: 'Walling',     item: 'Lintel Reinforcement',     unit: 'kg', formula: 'Unit Weight × Length',            defaultDims: { unitWeight: 4, length: 20 }, calc: (d) => d.unitWeight * d.length },
  { id: 43, section: 'Walling',     item: 'Lintel Formwork',          unit: 'm²', formula: 'Sides + Soffit',                  defaultDims: { length: 20, depth: 0.60 }, calc: (d) => d.length * d.depth },
  { id: 44, section: 'Roof',        item: 'Wall Plate',               unit: 'm',  formula: 'Total Length (Perimeter)',        defaultDims: { perimeter: 54 }, calc: (d) => d.perimeter },
  { id: 45, section: 'Roof',        item: 'Rafters',                  unit: 'm',  formula: 'Number × Length',                 defaultDims: { length: 4.5, count: 20 }, calc: (d) => d.length * d.count },
  { id: 46, section: 'Roof',        item: 'Purlins',                  unit: 'm',  formula: 'Number × Length',                 defaultDims: { length: 15, count: 10 }, calc: (d) => d.length * d.count },
  { id: 47, section: 'Roof',        item: 'Trusses',                  unit: 'No.', formula: 'Count',                          defaultDims: { count: 8 }, calc: (d) => d.count },
  { id: 48, section: 'Roof',        item: 'Roofing Sheets',           unit: 'm²', formula: 'Roof Slope Area × 2 Sides',      defaultDims: { length: 15, width: 8, sides: 2 }, calc: (d) => d.length * d.width * d.sides },
  { id: 49, section: 'Roof',        item: 'Ridge Cap',                unit: 'm',  formula: 'Ridge Length',                    defaultDims: { length: 15 }, calc: (d) => d.length },
  { id: 50, section: 'Roof',        item: 'Fascia Board',             unit: 'm',  formula: 'Roof Edge Length',                defaultDims: { length: 54 }, calc: (d) => d.length },
  { id: 51, section: 'Roof',        item: 'Gutters',                  unit: 'm',  formula: 'Gutter Length',                   defaultDims: { length: 30 }, calc: (d) => d.length },
  { id: 52, section: 'Doors',       item: 'Door Frames',              unit: 'No.', formula: 'Count',                          defaultDims: { count: 10 }, calc: (d) => d.count },
  { id: 53, section: 'Doors',       item: 'Doors',                    unit: 'No.', formula: 'Count',                          defaultDims: { count: 10 }, calc: (d) => d.count },
  { id: 54, section: 'Doors',       item: 'Ironmongery',              unit: 'Item', formula: 'Per Door',                       defaultDims: { count: 10 }, calc: (d) => d.count },
  { id: 55, section: 'Windows',     item: 'Window Frames',            unit: 'No.', formula: 'Count',                          defaultDims: { count: 12 }, calc: (d) => d.count },
  { id: 56, section: 'Windows',     item: 'Windows',                  unit: 'No.', formula: 'Count',                          defaultDims: { count: 12 }, calc: (d) => d.count },
  { id: 57, section: 'Windows',     item: 'Glazing',                  unit: 'm²', formula: 'Length × Width × No.',            defaultDims: { length: 1.2, width: 1.2, count: 12 }, calc: (d) => d.length * d.width * d.count },
  { id: 58, section: 'Finishes',    item: 'Internal Plastering',      unit: 'm²', formula: 'Wall Area',                       defaultDims: { area: 217 }, calc: (d) => d.area },
  { id: 59, section: 'Finishes',    item: 'External Rendering',       unit: 'm²', formula: 'Wall Area',                       defaultDims: { area: 137 }, calc: (d) => d.area },
  { id: 60, section: 'Finishes',    item: 'Wall Tiling',              unit: 'm²', formula: 'Length × Height',                 defaultDims: { length: 30, height: 1.8 }, calc: (d) => d.length * d.height },
  { id: 61, section: 'Finishes',    item: 'Floor Screed',             unit: 'm²', formula: 'Floor Area',                      defaultDims: { area: 180 }, calc: (d) => d.area },
  { id: 62, section: 'Finishes',    item: 'Floor Tiling',             unit: 'm²', formula: 'Floor Area',                      defaultDims: { area: 180 }, calc: (d) => d.area },
  { id: 63, section: 'Finishes',    item: 'Skirting',                 unit: 'm',  formula: 'Room Perimeter',                 defaultDims: { perimeter: 90 }, calc: (d) => d.perimeter },
  { id: 64, section: 'Finishes',    item: 'Ceiling Finish',           unit: 'm²', formula: 'Ceiling Area',                    defaultDims: { area: 180 }, calc: (d) => d.area },
  { id: 65, section: 'Finishes',    item: 'POP Ceiling',              unit: 'm²', formula: 'Ceiling Area',                    defaultDims: { area: 180 }, calc: (d) => d.area },
  { id: 66, section: 'Finishes',    item: 'Cornices',                 unit: 'm',  formula: 'Room Perimeter',                 defaultDims: { perimeter: 90 }, calc: (d) => d.perimeter },
  { id: 67, section: 'Finishes',    item: 'Paint to Walls',           unit: 'm²', formula: 'Internal + External Walls',       defaultDims: { area: 354 }, calc: (d) => d.area },
  { id: 68, section: 'Finishes',    item: 'Paint to Ceilings',        unit: 'm²', formula: 'Ceiling Area',                    defaultDims: { area: 180 }, calc: (d) => d.area },
  { id: 69, section: 'Finishes',    item: 'Paint to Timber',          unit: 'm²', formula: 'Surface Area',                    defaultDims: { length: 54, width: 0.30 }, calc: (d) => d.length * d.width },
  { id: 70, section: 'Finishes',    item: 'Paint to Metalwork',       unit: 'm²', formula: 'Surface Area',                    defaultDims: { length: 12, width: 1.44 }, calc: (d) => d.length * d.width },
];

const SECTION_GROUPS = {
  substructure: [
    { name: 'Site Works',    items: SUBSTRUCTURE_ITEMS.filter(i => i.section === 'Site Works') },
    { name: 'Earthworks',    items: SUBSTRUCTURE_ITEMS.filter(i => i.section === 'Earthworks') },
    { name: 'Foundation',    items: SUBSTRUCTURE_ITEMS.filter(i => i.section === 'Foundation') },
    { name: 'Masonry',       items: SUBSTRUCTURE_ITEMS.filter(i => i.section === 'Masonry') },
    { name: 'Backfilling',   items: SUBSTRUCTURE_ITEMS.filter(i => i.section === 'Backfilling') },
    { name: 'Filling',       items: SUBSTRUCTURE_ITEMS.filter(i => i.section === 'Filling') },
    { name: 'Ground Floor',  items: SUBSTRUCTURE_ITEMS.filter(i => i.section === 'Ground Floor') },
  ],
  superstructure: [
    { name: 'Frame',    items: SUPERSTRUCTURE_ITEMS.filter(i => i.section === 'Frame') },
    { name: 'Walling',  items: SUPERSTRUCTURE_ITEMS.filter(i => i.section === 'Walling') },
    { name: 'Roof',     items: SUPERSTRUCTURE_ITEMS.filter(i => i.section === 'Roof') },
    { name: 'Doors',    items: SUPERSTRUCTURE_ITEMS.filter(i => i.section === 'Doors') },
    { name: 'Windows',  items: SUPERSTRUCTURE_ITEMS.filter(i => i.section === 'Windows') },
    { name: 'Finishes', items: SUPERSTRUCTURE_ITEMS.filter(i => i.section === 'Finishes') },
  ],
};

const DIM_LABELS = {
  length: 'Length (m)', width: 'Width (m)', depth: 'Depth (m)', height: 'Height (m)',
  thickness: 'Thickness (m)', area: 'Area (m²)', perimeter: 'Perimeter (m)',
  count: 'Quantity', sides: 'Sides', girth: 'Girth (m)',
  excavation: 'Excavation (m³)', concrete: 'Concrete (m³)', blockwork: 'Blockwork (m²)',
  barLength: 'Bar Length (m)', unitWeight: 'Unit Weight (kg/m)', openings: 'Openings (m²)',
  carryForward: 'Carry Forward (m³)',
};


/* ═══════════════════════════════════════════════════════════════
   MAIN MODAL COMPONENT
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'qst_qs_flow_progress';

function loadSavedProgress() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.project?.id || !data?.savedAt) return null;
    if (Date.now() - data.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}

function saveProgress(data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {}
}

function clearSavedProgress() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export default function QSFlowModal({ isOpen, onClose }) {
  const [step, setStep] = useState(0);
  const [project, setProject] = useState(null);
  const [subResults, setSubResults] = useState({});
  const [superResults, setSuperResults] = useState({});
  const [resumed, setResumed] = useState(false);

  const STEPS = [
    { label: 'Project',        icon: '📁' },
    { label: 'Substructure',   icon: '🏗️' },
    { label: 'Superstructure', icon: '🏢' },
    { label: 'Create BOQ',     icon: '📋' },
  ];

  // Restore saved progress when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const saved = loadSavedProgress();
    if (saved && !resumed) {
      setProject(saved.project);
      setStep(saved.step || 0);
      setSubResults(saved.subResults || {});
      setSuperResults(saved.superResults || {});
      setResumed(true);
    }
  }, [isOpen, resumed]);

  // Persist progress after each step change
  useEffect(() => {
    if (!isOpen || !project) return;
    if (step === 0) return; // Don't save at project selection
    saveProgress({ project, step, subResults, superResults });
  }, [step, project, subResults, superResults, isOpen]);

  const persistAndSetStep = (newStep) => {
    setStep(newStep);
    if (project && newStep > 0) {
      saveProgress({ project, step: newStep, subResults, superResults });
    }
  };

  const resetFlow = () => {
    setStep(0);
    setProject(null);
    setSubResults({});
    setSuperResults({});
    setResumed(false);
    clearSavedProgress();
  };

  const handleClose = () => {
    resetFlow();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-700 to-primary-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center">
              <span className="text-gold-400 font-bold text-sm">QS</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-display">QS Flow</h2>
              <p className="text-xs text-white/60">
                {resumed ? 'Resuming from saved progress' : 'End-to-end quantity surveying process'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ── Step Indicator ─────────────────────────────── */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {STEPS.map((s, idx) => (
              <div key={idx} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    idx < step ? 'bg-emerald-500 text-white' :
                    idx === step ? 'bg-primary-700 text-white ring-4 ring-primary-200' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {idx < step ? '✓' : s.icon}
                  </div>
                  <span className={`text-xs mt-1.5 font-medium ${
                    idx <= step ? 'text-primary-700' : 'text-gray-400'
                  }`}>{s.label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`w-16 md:w-24 h-0.5 mx-2 mt-[-18px] transition-all duration-500 ${
                    idx < step ? 'bg-emerald-400' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Step Content ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <ProjectSelection
              project={project}
              onNext={(p) => { setProject(p); persistAndSetStep(1); }}
            />
          )}
          {step === 1 && (
            <CalculationStep
              title="Substructure"
              groups={SECTION_GROUPS.substructure}
              results={subResults}
              onResultsChange={setSubResults}
              onBack={() => persistAndSetStep(0)}
              onNext={() => persistAndSetStep(2)}
            />
          )}
          {step === 2 && (
            <CalculationStep
              title="Superstructure"
              groups={SECTION_GROUPS.superstructure}
              results={superResults}
              onResultsChange={setSuperResults}
              onBack={() => persistAndSetStep(1)}
              onNext={() => persistAndSetStep(3)}
            />
          )}
          {step === 3 && (
            <BOQCreationStep
              project={project}
              subResults={subResults}
              superResults={superResults}
              onBack={() => persistAndSetStep(2)}
              onFinish={handleClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   STEP 1: PROJECT SELECTION
   ═══════════════════════════════════════════════════════════════ */

function ProjectSelection({ project, onNext }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(project);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', client_name: '', project_type: 'Residential Building' });
  const createRef = useRef(null);

  useEffect(() => {
    projectAPI.list({ limit: 100 }).then(r => {
      setProjects(r.data?.projects || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter(p =>
    p.title?.toLowerCase().includes(search.toLowerCase()) ||
    p.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newProject.title.trim()) return toast.error('Project title is required');
    setCreating(true);
    try {
      const res = await projectAPI.create(newProject);
      const created = res?.data?.project;
      if (created) {
        setProjects(prev => [created, ...prev]);
        setSelected(created);
        setShowCreate(false);
        setNewProject({ title: '', client_name: '', project_type: 'Residential Building' });
        toast.success('Project created!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📁</span>
        </div>
        <h3 className="text-xl font-bold text-primary-800 font-display">Select a Project</h3>
        <p className="text-gray-500 text-sm mt-1">Choose an existing project or create a new one to begin</p>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search projects by name or client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* Project List */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-sm mt-3">Loading projects...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">
              {search ? 'No projects match your search' : 'No projects yet — create one below'}
            </p>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                  selected?.id === p.id
                    ? 'bg-primary-50 border-l-4 border-primary-600'
                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  selected?.id === p.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {p.title?.charAt(0)?.toUpperCase() || 'P'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{p.title}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {p.client_name || 'No client'} · {p.project_type || 'General'}
                    {p.location ? ` · ${p.location}` : ''}
                  </p>
                </div>
                {selected?.id === p.id && (
                  <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create New Project */}
      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors text-sm font-medium"
        >
          + Create New Project
        </button>
      ) : (
        <div className="border border-primary-200 bg-primary-50/30 rounded-xl p-4 space-y-3" ref={createRef}>
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-primary-800">New Project</h4>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Project Title *</label>
              <input
                type="text"
                className="input text-sm"
                placeholder="e.g. 3-Bedroom Bungalow"
                value={newProject.title}
                onChange={(e) => setNewProject(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="label text-xs">Client Name</label>
              <input
                type="text"
                className="input text-sm"
                placeholder="e.g. Mr. Adebayo"
                value={newProject.client_name}
                onChange={(e) => setNewProject(p => ({ ...p, client_name: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label text-xs">Project Type</label>
              <select
                className="input text-sm"
                value={newProject.project_type}
                onChange={(e) => setNewProject(p => ({ ...p, project_type: e.target.value }))}
              >
                {['Residential Building','Commercial Building','Industrial Facility','Road & Infrastructure','Hospital / Healthcare','Educational Facility','Other'].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newProject.title.trim()}
            className="btn-primary text-sm w-full"
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      )}

      {/* Selected project summary + Continue */}
      {selected && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold">
              {selected.title?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm text-emerald-800">{selected.title}</p>
              <p className="text-xs text-emerald-600">{selected.client_name || 'No client specified'}</p>
            </div>
          </div>
          <button onClick={() => onNext(selected)} className="btn-primary text-sm">
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   CALCULATION STEP (used for both Substructure & Superstructure)
   ═══════════════════════════════════════════════════════════════ */

function CalculationStep({ title, groups, results, onResultsChange, onBack, onNext }) {
  const allItems = groups.flatMap(g => g.items);
  const completedCount = Object.keys(results).length;
  const totalCount = allItems.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const [currentItemId, setCurrentItemId] = useState(allItems[0]?.id || null);
  const [dims, setDims] = useState({});
  const [activeSection, setActiveSection] = useState(groups[0]?.name || '');

  const currentItem = allItems.find(i => i.id === currentItemId);

  // Initialize dims when current item changes
  useEffect(() => {
    if (currentItem) {
      if (results[currentItem.id]) {
        setDims(results[currentItem.id].dims);
      } else {
        setDims({ ...currentItem.defaultDims });
      }
      setActiveSection(currentItem.section);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItemId]);

  // Compute live result
  const liveResult = useMemo(() => {
    if (!currentItem) return 0;
    if (currentItem.isCarryForward) {
      const prevResult = results[currentItem.carryForwardFrom];
      return prevResult ? prevResult.quantity : 0;
    }
    try {
      return Math.round(currentItem.calc(dims) * 100) / 100;
    } catch {
      return 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem, dims]);

  const handleSaveAndContinue = () => {
    if (!currentItem) return;
    const quantity = liveResult;
    const newResults = {
      ...results,
      [currentItem.id]: { dims: { ...dims }, quantity, item: currentItem }
    };
    onResultsChange(newResults);

    // Move to next item
    const currentIdx = allItems.findIndex(i => i.id === currentItemId);
    if (currentIdx < allItems.length - 1) {
      setCurrentItemId(allItems[currentIdx + 1].id);
    }
  };

  const handleAcceptSuggestion = () => {
    if (!currentItem) return;
    setDims({ ...currentItem.defaultDims });
  };

  const handleJumpToItem = (itemId) => {
    setCurrentItemId(itemId);
  };

  const sectionItems = groups.find(g => g.name === activeSection)?.items || [];

  return (
    <div className="flex gap-6 h-full">
      {/* ── Left: Section Nav + Item List ────────────── */}
      <div className="w-64 flex-shrink-0 space-y-4">
        {/* Progress */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">Progress</span>
            <span className="text-xs font-bold text-primary-700">{completedCount}/{totalCount}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Section Tabs */}
        <div className="space-y-1">
          {groups.map(g => {
            const sectionDone = g.items.filter(i => results[i.id]).length;
            const sectionTotal = g.items.length;
            const isActive = activeSection === g.name;
            return (
              <button
                key={g.name}
                onClick={() => {
                  setActiveSection(g.name);
                  const firstIncomplete = g.items.find(i => !results[i.id]);
                  setCurrentItemId(firstIncomplete?.id || g.items[0].id);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                  isActive ? 'bg-primary-100 text-primary-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">{g.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  sectionDone === sectionTotal ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
                }`}>
                  {sectionDone}/{sectionTotal}
                </span>
              </button>
            );
          })}
        </div>

        {/* Items in current section */}
        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          {sectionItems.map(item => {
            const done = !!results[item.id];
            const isCurrent = item.id === currentItemId;
            return (
              <button
                key={item.id}
                onClick={() => handleJumpToItem(item.id)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-b border-gray-50 last:border-0 transition-colors ${
                  isCurrent ? 'bg-primary-50 text-primary-700 font-semibold' :
                  done ? 'bg-emerald-50/50 text-emerald-700' :
                  'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                  done ? 'bg-emerald-500 text-white' :
                  isCurrent ? 'bg-primary-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {done ? '✓' : item.id}
                </span>
                <span className="truncate">{item.item}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Current Item Calculator ───────────── */}
      <div className="flex-1 space-y-4">
        {currentItem ? (
          <>
            {/* Item Header */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge badge-blue">{currentItem.section}</span>
                    <span className="text-xs text-gray-400">Item #{currentItem.id}</span>
                    {results[currentItem.id] && (
                      <span className="badge badge-green">Saved</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-primary-800 font-display">{currentItem.item}</h3>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Unit</p>
                  <p className="text-lg font-bold text-gold-600">{currentItem.unit}</p>
                </div>
              </div>

              {/* Formula */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Formula / Measurement</p>
                <p className="text-sm font-semibold text-gray-800">{currentItem.formula}</p>
              </div>

              {/* Dimension Inputs */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {Object.keys(currentItem.defaultDims).map(key => {
                  if (currentItem.isCarryForward) return null;
                  return (
                    <div key={key}>
                      <label className="label text-xs">{DIM_LABELS[key] || key}</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input text-sm"
                        placeholder={String(currentItem.defaultDims[key])}
                        value={dims[key] ?? ''}
                        onChange={(e) => setDims(d => ({ ...d, [key]: parseFloat(e.target.value) || 0 }))}
                      />
                      {dims[key] !== currentItem.defaultDims[key] && dims[key] !== undefined && dims[key] !== '' && (
                        <button
                          onClick={() => setDims(d => ({ ...d, [key]: currentItem.defaultDims[key] }))}
                          className="text-[10px] text-gold-600 hover:text-gold-700 mt-0.5"
                        >
                          Use suggested: {currentItem.defaultDims[key]}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Live Result Preview */}
              <div className="bg-gradient-to-r from-primary-50 to-gold-50 border border-primary-100 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Calculated Quantity</p>
                    <p className="text-2xl font-bold text-primary-700 font-display">
                      {currentItem.isCarryForward ? (
                        results[currentItem.carryForwardFrom] ? (
                          <>{results[currentItem.carryForwardFrom].quantity} <span className="text-sm font-normal text-gray-500">m³ (carried forward)</span></>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )
                      ) : (
                        <>{liveResult} <span className="text-sm font-normal text-gray-500">{currentItem.unit}</span></>
                      )}
                    </p>
                  </div>
                  {!currentItem.isCarryForward && (
                    <button
                      onClick={handleAcceptSuggestion}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Reset to Defaults
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <button onClick={onBack} className="btn-secondary text-sm">
                ← Back
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {allItems.findIndex(i => i.id === currentItemId) + 1} of {allItems.length}
                </span>
                <button onClick={handleSaveAndContinue} className="btn-gold text-sm">
                  Save & Continue →
                </button>
              </div>
            </div>

            {/* Completed items summary */}
            {completedCount > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-emerald-700 mb-2">Saved Calculations ({completedCount})</p>
                <div className="flex flex-wrap gap-1.5">
                  {allItems.filter(i => results[i.id]).map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleJumpToItem(item.id)}
                      className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full hover:bg-emerald-200 transition-colors"
                    >
                      #{item.id} {results[item.id].quantity}{item.unit}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Final step: Proceed to next phase */}
            {completedCount === totalCount && (
              <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-gold-700 mb-2">
                  All {title.toLowerCase()} calculations complete!
                </p>
                <button onClick={onNext} className="btn-gold text-sm">
                  Proceed to {title === 'Substructure' ? 'Superstructure' : 'BOQ Creation'} →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p>Select an item to begin calculating</p>
          </div>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   STEP 4: BOQ CREATION
   ═══════════════════════════════════════════════════════════════ */

function BOQCreationStep({ project, subResults, superResults, onBack, onFinish }) {
  const [existingBoqs, setExistingBoqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [boqChoice, setBoqChoice] = useState(null); // 'new' | 'override' | null
  const [selectedBoqId, setSelectedBoqId] = useState(null);
  const [createdBoq, setCreatedBoq] = useState(null);

  useEffect(() => {
    if (!project) return;
    boqAPI.list({ project_id: project.id }).then(r => {
      const data = Array.isArray(r.data) ? r.data : (r.data?.data || []);
      setExistingBoqs(data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [project]);

  // Build BOQ sections from results
  const buildBoqPayload = () => {
    const sections = [];

    // Substructure section
    const subItems = Object.values(subResults).map((r, idx) => ({
      item_no: `S${idx + 1}`,
      description: r.item.item,
      unit: r.item.unit,
      quantity: r.quantity,
      rate: 0,
      material_type: r.item.section,
      spec_reference: r.item.formula,
    }));
    if (subItems.length > 0) {
      sections.push({ title: 'Substructure', section_type: 'measured_work', items: subItems });
    }

    // Superstructure sections by sub-section
    const superSections = {};
    Object.values(superResults).forEach(r => {
      const sectionName = r.item.section;
      if (!superSections[sectionName]) superSections[sectionName] = [];
      superSections[sectionName].push(r);
    });

    Object.entries(superSections).forEach(([sectionName, items]) => {
      const boqItems = items.map((r, idx) => ({
        item_no: `${sectionName.charAt(0)}${idx + 1}`,
        description: r.item.item,
        unit: r.item.unit,
        quantity: r.quantity,
        rate: 0,
        material_type: sectionName,
        spec_reference: r.item.formula,
      }));
      sections.push({ title: sectionName, section_type: 'measured_work', items: boqItems });
    });

    return sections;
  };

  const handleCreateBOQ = async () => {
    setCreating(true);
    try {
      const sections = buildBoqPayload();
      const boqData = {
        title: `BOQ — ${project.title}`,
        project_id: project.id,
        client_name: project.client_name,
        location: project.location,
        notes: `Auto-generated via QS Flow on ${new Date().toLocaleDateString('en-NG')}`,
        measurement_standard: project.measurement_standard || 'NRM2',
        sections,
      };

      if (boqChoice === 'override' && selectedBoqId) {
        // Delete existing sections and recreate
        await boqAPI.update(selectedBoqId, { ...boqData, sections });
        toast.success('BOQ updated successfully!');
        clearSavedProgress();
        setCreatedBoq({ id: selectedBoqId, title: boqData.title });
      } else {
        const res = await boqAPI.create(boqData);
        toast.success('BOQ created successfully!');
        clearSavedProgress();
        setCreatedBoq(res?.data?.boq);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create BOQ');
    } finally {
      setCreating(false);
    }
  };

  const totalItems = Object.keys(subResults).length + Object.keys(superResults).length;

  if (createdBoq) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-8">
        <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
          <span className="text-4xl">✅</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-primary-800 font-display">BOQ Ready!</h3>
          <p className="text-gray-500 text-sm mt-1">
            Your Bill of Quantities has been {boqChoice === 'override' ? 'updated' : 'created'} with {totalItems} measured items.
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-left">
          <p className="text-xs text-gray-500 mb-1">Project</p>
          <p className="font-semibold text-sm">{project.title}</p>
          <p className="text-xs text-gray-500 mt-2 mb-1">Items Included</p>
          <p className="font-semibold text-sm">{totalItems} measurement items across {Object.keys({...subResults, ...Object.fromEntries(Object.values(superResults).map(r => [r.item.section, true]))}).length} sections</p>
        </div>
        <div className="flex gap-3 justify-center">
          <a href={`/boq/${createdBoq?.id || ''}`} className="btn-primary text-sm">
            View BOQ →
          </a>
          <button onClick={onFinish} className="btn-secondary text-sm">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-gold-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📋</span>
        </div>
        <h3 className="text-xl font-bold text-primary-800 font-display">Create Bill of Quantities</h3>
        <p className="text-gray-500 text-sm mt-1">
          Generate a BOQ auto-populated with your {totalItems} saved measurements
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-3">
        <h4 className="font-semibold text-sm text-gray-700">Measurement Summary</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-500">Project</p>
            <p className="font-semibold text-sm text-primary-700">{project.title}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-500">Total Items</p>
            <p className="font-semibold text-sm text-primary-700">{totalItems}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-500">Substructure Items</p>
            <p className="font-semibold text-sm">{Object.keys(subResults).length}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-500">Superstructure Items</p>
            <p className="font-semibold text-sm">{Object.keys(superResults).length}</p>
          </div>
        </div>
      </div>

      {/* Existing BOQs */}
      {loading ? (
        <div className="text-center py-4">
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : existingBoqs.length > 0 ? (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-gray-700">
            Existing BOQs for this project ({existingBoqs.length})
          </h4>
          {existingBoqs.map(boq => (
            <div
              key={boq.id}
              className={`border rounded-xl p-4 transition-colors ${
                boqChoice === 'override' && selectedBoqId === boq.id
                  ? 'border-gold-400 bg-gold-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{boq.title}</p>
                  <p className="text-xs text-gray-500">
                    {boq.status} · {boq.measurement_standard || 'NRM2'} · {new Date(boq.created_at).toLocaleDateString('en-NG')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary-700">
                    {boq.total_amount ? `₦${Number(boq.total_amount).toLocaleString()}` : 'No rates'}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            <button
              onClick={() => { setBoqChoice('override'); setSelectedBoqId(existingBoqs[0]?.id); }}
              className={`flex-1 py-3 border-2 rounded-xl text-sm font-medium transition-colors ${
                boqChoice === 'override'
                  ? 'border-gold-400 bg-gold-50 text-gold-700'
                  : 'border-gray-200 text-gray-600 hover:border-gold-300'
              }`}
            >
              Override Existing BOQ
            </button>
            <button
              onClick={() => { setBoqChoice('new'); setSelectedBoqId(null); }}
              className={`flex-1 py-3 border-2 rounded-xl text-sm font-medium transition-colors ${
                boqChoice === 'new'
                  ? 'border-primary-400 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-primary-300'
              }`}
            >
              Create New BOQ
            </button>
          </div>

          {boqChoice === 'override' && existingBoqs.length > 1 && (
            <div>
              <label className="label text-xs">Select which BOQ to override</label>
              <select
                className="input text-sm"
                value={selectedBoqId || ''}
                onChange={(e) => setSelectedBoqId(e.target.value)}
              >
                {existingBoqs.map(b => (
                  <option key={b.id} value={b.id}>{b.title} ({b.status})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-sm text-blue-700">No existing BOQs — a new one will be created</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button onClick={onBack} className="btn-secondary text-sm">
          ← Back
        </button>
        <button
          onClick={handleCreateBOQ}
          disabled={creating || (!boqChoice && existingBoqs.length > 0)}
          className="btn-gold text-sm"
        >
          {creating ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating BOQ...
            </>
          ) : (
            `Create BOQ (${totalItems} items)`
          )}
        </button>
      </div>
    </div>
  );
}
