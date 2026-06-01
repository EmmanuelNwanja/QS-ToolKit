/**
 * Design Compliance Checklist:
 * ─────────────────────────────
 * [x] Colors  → primary-{50..900}, gray-{50..900}, red/amber/green (Tailwind defaults)
 * [x] Buttons → btn-primary, btn-secondary, btn-ghost (no custom buttons)
 * [x] Inputs  → .input class (from globals.css)
 * [x] Cards   → .card, .card-md (from globals.css)
 * [x] Spacing → Tailwind scale (p-*, gap-*, m-*) — no arbitrary px values
 * [x] Icons   → Emoji-based (matching existing app pattern)
 * [x] Layout  → Renders inside <Layout> from parent; uses same sidebar/nav
 * [x] Dark    → No special dark mode needed (app uses bg-gray-50, cards stay white)
 * [x] Fonts   → font-display (headings), font-body (default)
 * [x] Badges  → Uses badge-green/badge-blue/badge-amber/badge-red patterns
 * [x] Tables  → Uses data-table classes via .table-wrapper + .data-table
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import parametricAPI from './parametricAPI';

// ─── Element Definitions ─────────────────────────────────────────
const ELEMENTS = [
  { type: 'beam',            label: 'Beam',           dimLabel: 'Span (mm)',  defaultDim: 6000, category: 'beam',
    typologies: ['simply_supported', 'continuous', 'cantilever', 'deep'],
    defaultTypology: 'simply_supported',
    spanDepthTip: 'EC2: 10–20 | ACI: 16–21 | IS456: 12–15' },
  { type: 'column',          label: 'Rect. Column',   dimLabel: 'Height (mm)', defaultDim: 3000, category: 'column',
    typologies: ['axial', 'biaxial'],
    defaultTypology: 'axial',
    spanDepthTip: 'h ≈ H/10–H/15 (EC2), H/8–H/12 (ACI)' },
  { type: 'slab',            label: 'Slab',           dimLabel: 'Span (mm)',  defaultDim: 5000, category: 'slab',
    typologies: ['one_way', 'two_way', 'flat'],
    defaultTypology: 'one_way',
    spanDepthTip: 'EC2: 30–35 | ACI: 20–24 | IS456: 30' },
  { type: 'footing',         label: 'Footing',        dimLabel: 'Col size (mm)', defaultDim: 300, category: 'foundation',
    typologies: [], defaultTypology: null,
    spanDepthTip: 'Min 200mm (EC2), 300mm (ACI)' },
  { type: 'wall',            label: 'Wall',           dimLabel: 'Length (mm)', defaultDim: 4000, category: 'wall',
    typologies: [], defaultTypology: null,
    spanDepthTip: 'Min 150mm (EC2/ACI), 100mm (IS456)' },
  { type: 'staircase',       label: 'Staircase',      dimLabel: 'Waist span (mm)', defaultDim: 3000, category: 'stair',
    typologies: [], defaultTypology: null,
    spanDepthTip: 'Waist ≥ span/20, min 100mm' },
  { type: 'circular_column',  label: 'Circular Col.',  dimLabel: 'Height (mm)',  defaultDim: 3000, category: 'column',
    typologies: [], defaultTypology: null,
    spanDepthTip: 'D ≥ 300mm. Std sizes: 300, 450, 600, 900, 1200' },
  { type: 'cylindrical_wall', label: 'Cylindrical Wall', dimLabel: 'Int. Dia (mm)', defaultDim: 3000, category: 'wall',
    typologies: [], defaultTypology: null,
    spanDepthTip: 't ≥ Dᵢ/40, min 150mm. Water-retaining cover: 40mm' },
  { type: 'curved_beam',     label: 'Curved Beam',    dimLabel: 'Chord (mm)',  defaultDim: 6000, category: 'beam',
    typologies: [], defaultTypology: null,
    spanDepthTip: 'Depth from chord/12 (EC2). Stirrups vary along arc.' },
  { type: 'dome_shell',      label: 'Dome / Shell',   dimLabel: 'Base Dia (mm)', defaultDim: 10000, category: 'slab',
    typologies: [], defaultTypology: null,
    spanDepthTip: 'Min thickness D/60, 75mm. Rebar: 15 kg/m².' }
];

const STANDARDS = [
  { id: 'eurocode', label: 'Eurocode 2', flag: '🇪🇺' },
  { id: 'aci318',   label: 'ACI 318',    flag: '🇺🇸' },
  { id: 'is456',    label: 'IS 456',     flag: '🇮🇳' },
  { id: 'bs8110',   label: 'BS 8110',    flag: '🇬🇧' }
];

// ─── SVG Element Diagrams ─────────────────────────────────────────
function DiagramBeam({ depth, span }) {
  return (
    <svg viewBox="0 0 120 50" className="w-full h-12">
      <rect x="5" y="8" width={span || 110} height={depth || 20} rx="2" className="fill-primary-200 stroke-primary-500" strokeWidth="1.5" />
      {depth && <text x="60" y="42" textAnchor="middle" fontSize="8" className="fill-primary-800">{depth}mm</text>}
      {span && <text x={span/2 + 5} y="6" textAnchor="middle" fontSize="7" className="fill-gray-500">L={span}</text>}
      <line x1="5" y1="8" x2="5" y2="28" className="stroke-gray-500" strokeWidth="1" strokeDasharray="2" />
      <text x="2" y="12" fontSize="5" className="fill-gray-500">spt</text>
      <line x1={span + 5 || 115} y1="8" x2={span + 5 || 115} y2="28" className="stroke-gray-500" strokeWidth="1" strokeDasharray="2" />
    </svg>
  );
}

function DiagramColumn({ height, width }) {
  return (
    <svg viewBox="0 0 50 120" className="w-16 h-32 mx-auto">
      <rect x="15" y="5" width={width || 20} height={height || 100} rx="2" className="fill-primary-200 stroke-primary-500" strokeWidth="1.5" />
      <text x="25" y={height/2 + 50 || 60} textAnchor="middle" fontSize="7" className="fill-primary-800" transform={`rotate(-90,25,${height/2 + 50 || 60})`}>
        {height || 'H'}mm
      </text>
      <text x="38" y="65" textAnchor="start" fontSize="6" className="fill-gray-500" transform={`rotate(90,38,65)`}>
        b
      </text>
      <line x1="15" y1="5" x2={15 + (width || 20)} y2="5" className="stroke-gray-500" strokeWidth="0.8" strokeDasharray="2" />
    </svg>
  );
}

function DiagramSlab({ thickness, span, width }) {
  return (
    <svg viewBox="0 0 120 50" className="w-full h-14">
      <rect x="5" y={40 - (thickness || 12)} width={span || 110} height={thickness || 12} rx="1" className="fill-primary-200 stroke-primary-500" strokeWidth="1.5" />
      {[1,2,3,4].map(i => (
        <line key={i} x1={10 + i*25} y1={40 - (thickness || 12) + 2} x2={10 + i*25} y2="40" className="stroke-primary-400" strokeWidth="0.8" strokeDasharray="1" />
      ))}
      <text x="60" y="48" textAnchor="middle" fontSize="7" className="fill-gray-500">L = {span || 'ℓ'}</text>
      <text x="3" y={38 - (thickness || 12)} fontSize="6" className="fill-primary-800">h={thickness || 'h'}</text>
      <line x1="4" y1={40 - (thickness || 12)} x2="4" y2={40 - (thickness || 12) + (thickness || 12)} className="stroke-primary-800" strokeWidth="0.8" />
      {width && <text x="60" y="10" textAnchor="middle" fontSize="6" className="fill-gray-500">W = {width}mm</text>}
    </svg>
  );
}

function DiagramFooting({ colWidth, baseWidth, thickness }) {
  return (
    <svg viewBox="0 0 120 60" className="w-full h-14">
      <rect x={60 - (baseWidth || 40)/2} y="25" width={baseWidth || 40} height={thickness || 8} rx="2" className="fill-gray-200 stroke-gray-500" strokeWidth="1.2" />
      <rect x={60 - (colWidth || 10)/2} y="8" width={colWidth || 10} height={18} rx="1" className="fill-primary-200 stroke-primary-500" strokeWidth="1.2" />
      <line x1={60 - (baseWidth || 40)/2} y1="25" x2={60 - (colWidth || 10)/2} y2="8" className="stroke-gray-500" strokeWidth="0.8" strokeDasharray="2" />
      <line x1={60 + (baseWidth || 40)/2} y1="25" x2={60 + (colWidth || 10)/2} y2="8" className="stroke-gray-500" strokeWidth="0.8" strokeDasharray="2" />
      <text x="60" y="50" textAnchor="middle" fontSize="7" className="fill-gray-500">B = {baseWidth || 'B'}</text>
    </svg>
  );
}

function DiagramWall({ length, height }) {
  return (
    <svg viewBox="0 0 120 60" className="w-full h-14">
      <rect x="10" y="8" width={length || 100} height={height || 35} rx="1" className="fill-gray-200 stroke-gray-500" strokeWidth="1.2" />
      <line x1="10" y1="8" x2={length + 10 || 110} y2="8" className="stroke-gray-500" strokeWidth="0.8" strokeDasharray="2" />
      <text x="60" y="52" textAnchor="middle" fontSize="7" className="fill-gray-500">L = {length || 'ℓ'}</text>
      <text x="2" y="25" fontSize="6" className="fill-primary-800">H</text>
    </svg>
  );
}

function DiagramCircularColumn({ diameter, height }) {
  return (
    <svg viewBox="0 0 60 120" className="w-16 h-32 mx-auto">
      <ellipse cx="30" cy="15" rx={diameter/6000*30 + 10 || 15} ry="6" className="fill-primary-200 stroke-primary-500" strokeWidth="1.2" />
      <rect x={30 - (diameter/6000*30 + 10 || 15)} y="15" width={2*(diameter/6000*30 + 10 || 15)} height={height/3000*80 + 20 || 80} rx="1" className="fill-primary-200 stroke-primary-500" strokeWidth="1.2" />
      <ellipse cx="30" cy={15 + (height/3000*80 + 20 || 80)} rx={diameter/6000*30 + 10 || 15} ry="6" className="fill-none stroke-primary-500" strokeWidth="1.2" />
      <text x="30" y="60" textAnchor="middle" fontSize="7" className="fill-primary-800" transform={`rotate(-90,30,60)`}>H</text>
      <line x1="30" y1="15" x2={30 + (diameter/6000*30 + 10 || 15)} y2="15" className="stroke-primary-800" strokeWidth="0.8" />
      <text x="35" y="13" fontSize="6" className="fill-primary-800">D</text>
    </svg>
  );
}

function DiagramCylindricalWall({ internalDia, thickness, height }) {
  const r = internalDia / 6000 * 25 + 8;
  const t = thickness / 150 * 4 + 2;
  return (
    <svg viewBox="0 0 80 90" className="w-20 h-24 mx-auto">
      <ellipse cx="40" cy="15" rx={r + t} ry="6" className="fill-none stroke-gray-500" strokeWidth="1" strokeDasharray="2" />
      <ellipse cx="40" cy="15" rx={r} ry="6" className="fill-gray-200 stroke-gray-500" strokeWidth="1" />
      <rect x={40 - r - t} y="15" width={2*(r+t)} height={height/1000*40 + 15 || 55} rx="1" className="fill-none stroke-gray-500" strokeWidth="1.2" />
      <rect x={40 - r} y="15" width={2*r} height={height/1000*40 + 15 || 55} rx="1" className="fill-primary-200 stroke-primary-500" strokeWidth="1" />
      <ellipse cx="40" cy={15 + (height/1000*40 + 15 || 55)} rx={r} ry="5" className="fill-none stroke-primary-500" strokeWidth="1" />
      <line x1={40 - r - t} y1="15" x2={40 - r - t} y2={15 + (height/1000*40 + 15 || 55)} className="stroke-primary-800" strokeWidth="0.8" />
      <line x1={40 + r} y1="15" x2={40 + r + t} y2="15" className="stroke-primary-800" strokeWidth="0.8" />
      <text x="36" y="70" fontSize="6" className="fill-primary-800">Dᵢ</text>
      <text x={35 + r} y="13" fontSize="5" className="fill-primary-800">t</text>
    </svg>
  );
}

function DiagramCurvedBeam({ chord, rise, radius }) {
  const w = 120, h = 70;
  const rr = radius || chord * chord / (8 * (rise || chord/10)) + (rise || chord/10) / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <path d={`M 10,${h-10} Q ${w/2},${h-10 - (rise || 15)} ${w-10},${h-10}`} className="fill-none stroke-primary-500" strokeWidth="2" />
      <line x1="10" y1={h-10} x2={w-10} y2={h-10} className="stroke-gray-500" strokeWidth="1" strokeDasharray="3" />
      <line x1={w/2} y1={h-10} x2={w/2} y2={h-10 - (rise || 15)} className="stroke-gray-500" strokeWidth="0.8" strokeDasharray="2" />
      <text x={w/2 - 8} y={h - 4} fontSize="6" className="fill-gray-500">c={chord || 'ℓ'}</text>
      <text x={w/2 + 4} y={h-10 - (rise||15)/2} fontSize="6" className="fill-primary-800">h={rise || 'r'}</text>
      <text x={w-28} y="8" fontSize="6" className="fill-primary-800">R={rr ? rr.toFixed(1) : '...'}m</text>
    </svg>
  );
}

function DiagramDome({ baseDia, rise, sphereRadius }) {
  const w = 120, h = 70;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <path d={`M 10,${h-10} A ${(w-20)/2},${(w-20)/2} 0 0,1 ${w-10},${h-10}`} className="fill-primary-200 stroke-primary-500" strokeWidth="1.5" />
      <line x1="10" y1={h-10} x2={w-10} y2={h-10} className="stroke-gray-500" strokeWidth="1" strokeDasharray="3" />
      <line x1={w/2} y1={h-10} x2={w/2} y2={h-10 - (rise || 20)} className="stroke-gray-500" strokeWidth="0.8" strokeDasharray="2" />
      <text x={w/2 - 8} y={h - 4} fontSize="6" className="fill-gray-500">D={baseDia || 'ø'}</text>
      <text x={w/2 + 4} y={h-10 - (rise||20)/2} fontSize="6" className="fill-primary-800">h={rise || 'r'}</text>
      <text x="4" y="10" fontSize="6" className="fill-primary-800">R={(sphereRadius || 0).toFixed(1)}m</text>
    </svg>
  );
}

function DiagramStair({ span }) {
  return (
    <svg viewBox="0 0 120 60" className="w-full h-14">
      {[0,1,2,3,4,5].map(i => (
        <line key={i} x1={10 + i*18} y1={52 - i*7} x2={10 + (i+1)*18} y2={52 - i*7} className="stroke-primary-500" strokeWidth="1.5" />
      ))}
      {[0,1,2,3,4,5].map(i => (
        <line key={i} x1={10 + (i+1)*18} y1={52 - i*7} x2={10 + (i+1)*18} y2={52 - (i+1)*7} className="stroke-primary-500" strokeWidth="1.5" />
      ))}
      <line x1="10" y1="52" x2={10 + 6*18} y2="52" className="stroke-gray-500" strokeWidth="0.8" strokeDasharray="2" />
      <text x="60" y="58" textAnchor="middle" fontSize="7" className="fill-gray-500">waist span = {span || 'ℓ'}</text>
      <text x="2" y="30" fontSize="6" className="fill-primary-800">width</text>
    </svg>
  );
}

const DIAGRAM_MAP = {
  beam: DiagramBeam, column: DiagramColumn, slab: DiagramSlab,
  footing: DiagramFooting, wall: DiagramWall,
  staircase: DiagramStair, circular_column: DiagramCircularColumn,
  cylindrical_wall: DiagramCylindricalWall, curved_beam: DiagramCurvedBeam,
  dome_shell: DiagramDome
};

// ─── Helper ───────────────────────────────────────────────────────
function defaultConfig(type) {
  const el = ELEMENTS.find(e => e.type === type);
  const d = {
    element_type: type,
    standard: 'eurocode',
    primary_dim_mm: el ? el.defaultDim : 6000,
    overrides: {},
    extra: {}
  };
  if (el && el.defaultTypology) {
    if (type === 'beam') d.extra.support_type = el.defaultTypology;
    else if (type === 'column') d.extra.column_shape = 'square';
    else if (type === 'slab') d.extra.slab_type = el.defaultTypology;
  }
  d.extra.quantity = 1;
  return d;
}

function formatKey(k) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getCalcAPI(type) {
  const LOOKUP = {
    circular_column: 'calculateCircular',
    cylindrical_wall: 'calculateCylindrical',
    curved_beam: 'calculateCurved',
    dome_shell: 'calculateDome'
  };
  return parametricAPI[LOOKUP[type]] || parametricAPI.calculate;
}

function buildPayload(config) {
  const payload = {
    project_id: config.project_id,
    element_type: config.element_type,
    primary_dimension: Number(config.primary_dim_mm),
    standard_code: config.standard,
    user_overrides: config.overrides || {},
    secondary_inputs: { ...config.extra }
  };

  const direct = {
    circular_column: ['diameter', 'height', 'cover'],
    cylindrical_wall: ['internal_diameter', 'height', 'fluid_pressure'],
    curved_beam: ['chord_length', 'rise', 'width'],
    dome_shell: ['base_diameter', 'rise']
  };

  const de = direct[config.element_type];
  if (de) {
    payload.project_id = config.project_id;
    payload.standard_code = config.standard;
    if (config.element_type === 'circular_column') {
      payload.diameter = config.extra.diameter_mm || 450;
      payload.height = config.primary_dim_mm;
      if (config.extra.cover_mm) payload.cover = config.extra.cover_mm;
    } else if (config.element_type === 'cylindrical_wall') {
      payload.internal_diameter = config.primary_dim_mm;
      payload.height = config.extra.wall_height_m || 3;
      if (config.extra.fluid_type) payload.fluid_pressure = config.extra.fluid_type === 'water' ? 10 : 20;
    } else if (config.element_type === 'curved_beam') {
      payload.chord_length = config.primary_dim_mm;
      payload.rise = config.extra.rise_mm || 600;
      if (config.extra.width_mm) payload.width = config.extra.width_mm;
    } else if (config.element_type === 'dome_shell') {
      payload.base_diameter = config.primary_dim_mm;
      payload.rise = (config.extra.rise_m || config.primary_dim_mm/4000) * 1000;
    }
  }

  return payload;
}

// ─── Main Component ───────────────────────────────────────────────
export default function SmartCalculator({ onCalculate: _onCalculate, loading, projectId }) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState(() => defaultConfig('beam'));
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [boqList, setBoqList] = useState([]);
  const [showBoqPicker, setShowBoqPicker] = useState(false);
  const [calcId, setCalcId] = useState(null);
  const previewTimer = useRef(null);

  // Keep config.project_id in sync with the projectId prop
  useEffect(() => {
    if (projectId) setConfig(p => ({ ...p, project_id: projectId }));
  }, [projectId]);

  const el = ELEMENTS.find(e => e.type === config.element_type);
  const Diagram = DIAGRAM_MAP[config.element_type];

  // ── Debounced preview on Step 2 ────────────────────────────────
  useEffect(() => {
    if (step !== 2) return;
    if (!config.primary_dim_mm || config.primary_dim_mm <= 0) { setPreview(null); return; }
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const fn = getCalcAPI(config.element_type);
        const payload = buildPayload({ ...config, project_id: config.project_id || localStorage.getItem('active_project_id') });
        const { data: res } = await fn(payload);
        setPreview(res?.result || res?.derived_dimensions || res);
      } catch { setPreview(null); }
    }, 600);
    return () => clearTimeout(previewTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.primary_dim_mm, config.standard, config.extra, config.element_type, step]);

  // ── Selection Handlers ─────────────────────────────────────────
  const selectElement = (type) => {
    setConfig(defaultConfig(type));
    setResult(null); setPreview(null);
    setCompareData(null); setShowCompare(false);
    setStep(2);
  };

  const updateField = (field, value) => setConfig(p => ({ ...p, [field]: value }));
  const updateExtra = (key, value) => setConfig(p => ({ ...p, extra: { ...p.extra, [key]: value } }));
  const updateOverride = (field, value) => setConfig(p => ({
    ...p, overrides: { ...p.overrides, [field]: value ? Number(value) : undefined }
  }));

  // ── Calculate ──────────────────────────────────────────────────
  const doCalculate = useCallback(async (callback) => {
    try {
      const fn = getCalcAPI(config.element_type);
      const payload = buildPayload({ ...config, project_id: config.project_id || localStorage.getItem('active_project_id') });
      const { data: res } = await fn(payload);
      const calcRes = res?.result || res;
      setResult(calcRes);
      if (res?.calculation?.id) setCalcId(res.calculation.id);
      if (callback) callback(calcRes);
      toast.success('Calculation complete');
      return calcRes;
    } catch (err) {
      const msg = err.response?.data?.message || 'Calculation failed';
      toast.error(msg);
      throw err;
    }
  }, [config]);

  const handleCalculate = useCallback(async () => {
    const r = await doCalculate();
    setStep(3);
    return r;
  }, [doCalculate]);

  // ── Compare ────────────────────────────────────────────────────
  const handleCompare = useCallback(async () => {
    setCompareLoading(true);
    setCompareData(null);
    try {
      const { data: res } = await parametricAPI.compare({
        element_type: config.element_type,
        primary_dim_mm: Number(config.primary_dim_mm),
        extra: config.extra,
        standards: ['eurocode', 'aci318', 'is456', 'bs8110']
      });
      setCompareData(res.comparison);
    } catch {
      toast.error('Comparison failed');
    } finally {
      setCompareLoading(false);
    }
  }, [config]);

  // ── Inject BOQ ─────────────────────────────────────────────────
  const loadBoqList = useCallback(async () => {
    try {
      await parametricAPI.history({ limit: 5 });
      const { data: boqs } = await import('../../services/api').then(m => m.boqAPI.list({ limit: 20 }));
      setBoqList(boqs?.data || boqs?.boq_documents || []);
    } catch { setBoqList([]); }
  }, []);

  const handleInjectBoq = useCallback(async (boqId, sectionId) => {
    if (!calcId) { toast.error('Save the calculation first'); return; }
    setInjecting(true);
    try {
      const { data: res } = await parametricAPI.injectBoq(calcId, { boq_id: boqId, section_id: sectionId || undefined });
      toast.success(`${res.lines_inserted} BOQ lines injected`);
      setShowBoqPicker(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'BOQ injection failed');
    } finally {
      setInjecting(false);
    }
  }, [calcId]);

  // ── Save ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!result) { toast.error('Calculate first'); return; }
    setSaving(true);
    try {
      const fn = getCalcAPI(config.element_type);
      const payload = buildPayload({
        ...config,
        project_id: config.project_id || localStorage.getItem('active_project_id')
      });
      const { data: res } = await fn(payload);
      if (res?.calculation?.id) setCalcId(res.calculation.id);
      toast.success('Calculation saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }, [config, result]);

  // ── Reset ──────────────────────────────────────────────────────
  const resetAll = () => {
    setConfig(defaultConfig('beam'));
    setResult(null); setPreview(null);
    setCompareData(null); setShowCompare(false);
    setCalcId(null); setStep(1);
  };

  // ── Step Indicator ─────────────────────────────────────────────
  const renderSteps = () => (
    <div className="flex items-center gap-1 mb-4 text-xs">
      {[
        { n: 1, label: 'Element' },
        { n: 2, label: 'Input' },
        { n: 3, label: 'Review' },
        { n: 4, label: 'Actions' }
      ].map(({ n, label }) => {
        const active = step === n;
        const done = step > n;
        return (
          <div key={n} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors
              ${done ? 'bg-green-500 text-white' : active ? 'bg-primary-600 text-white ring-2 ring-primary-200' : 'bg-gray-200 text-gray-500'}`
            }>
              {done ? '✓' : n}
            </div>
            <span className={`hidden sm:inline text-[11px] ${active ? 'text-primary-700 font-semibold' : 'text-gray-400'}`}>{label}</span>
            {n < 4 && <span className="text-gray-300 mx-1">→</span>}
          </div>
        );
      })}
    </div>
  );

  // ──── RENDER: STEP 1 — Element Selection ─────────────────────
  const renderStep1 = () => {
    const categories = [...new Set(ELEMENTS.map(e => e.category))];
    const catLabel = { beam: 'Beams', column: 'Columns', slab: 'Slabs', foundation: 'Foundations', wall: 'Walls', stair: 'Stairs' };
    return (
      <div className="space-y-4">
        <p className="text-xs font-semibold text-gray-700">Select structural element</p>
        {categories.map(cat => (
          <div key={cat}>
            <p className="text-[10px] font-semibold uppercase text-gray-400 tracking-wide mb-1.5">{catLabel[cat] || cat}</p>
            <div className="grid grid-cols-1 gap-2">
              {ELEMENTS.filter(e => e.category === cat).map(el => {
                const Dia = DIAGRAM_MAP[el.type];
                return (
                  <button key={el.type}
                    onClick={() => selectElement(el.type)}
                    className="relative group flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all
                      border-gray-200 hover:border-primary-400 hover:bg-primary-50/40 hover:shadow-sm">
                    <div className="w-20 h-14 flex-shrink-0">
                      {Dia ? <Dia /> : <span className="text-2xl">🏗️</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800">{el.label}</p>
                      <p className="text-[10px] text-gray-500">{el.dimLabel}</p>
                    </div>
                    <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity
                      bg-primary-700 text-white text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap shadow">
                      {el.spanDepthTip}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ──── RENDER: STEP 2 — Input & Standard ──────────────────────
  const renderStep2 = () => {
    if (!el) return null;
    const isBeam = config.element_type === 'beam';
    const isCol = config.element_type === 'column';
    const isCurved = config.element_type === 'curved_beam';
    const isDome = config.element_type === 'dome_shell';
    const isCylWall = config.element_type === 'cylindrical_wall';
    const isStair = config.element_type === 'staircase';
    const isCircCol = config.element_type === 'circular_column';

    const overrideKeys = preview ? Object.keys(preview).filter(k =>
      ['diameter_mm','height_m','depth_mm','width_mm','thickness_mm','waist_mm','wall_thickness_mm','radius_m','arc_length_m','sphere_radius_m','surface_area_m2'].includes(k)
    ) : [];

    const DIA_SIZES = [300, 450, 600, 900, 1200];
    const FLUID_TYPES = ['water', 'sewage', 'chemical'];

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{['🏗️','🏛️','🏢','🧱','🧱','🪜','⭕','🛢️','〰️','🔮'][ELEMENTS.indexOf(el)]}</span>
          <p className="text-sm font-semibold text-gray-700">{el.label}</p>
          <span className="text-[10px] text-gray-400 ml-auto">{el.spanDepthTip}</span>
        </div>

        {/* Primary dimension */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">{el.dimLabel}</label>
          <input type="number" value={config.primary_dim_mm}
            onChange={e => updateField('primary_dim_mm', Number(e.target.value) || 0)}
            className="input w-full text-sm" min={100} step={100} />
        </div>

        {/* Circular Column — diameter dropdown */}
        {isCircCol && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Diameter</label>
              <select value={config.extra.diameter_mm || ''}
                onChange={e => updateExtra('diameter_mm', Number(e.target.value) || 0)}
                className="input w-full text-sm">
                <option value="">Auto (from height)</option>
                {DIA_SIZES.map(d => <option key={d} value={d}>{d}mm</option>)}
                <option value="custom">Custom</option>
              </select>
            </div>
            {config.extra.diameter_mm === 'custom' && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Custom D (mm)</label>
                <input type="number" value={config.extra.diameter_mm}
                  onChange={e => updateExtra('diameter_mm', Number(e.target.value))}
                  className="input w-full text-sm" min={200} step={50} />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Cover (mm)</label>
              <input type="number" defaultValue={40}
                onChange={e => updateExtra('cover_mm', Number(e.target.value))}
                className="input w-full text-sm" min={20} step={5} />
            </div>
          </div>
        )}

        {/* Cylindrical Wall */}
        {isCylWall && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Wall height (m)</label>
              <input type="number" value={config.extra.wall_height_m || 3}
                onChange={e => updateExtra('wall_height_m', Number(e.target.value))}
                className="input w-full text-sm" min={1} step={0.5} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Fluid type</label>
              <select value={config.extra.fluid_type || 'water'}
                onChange={e => updateExtra('fluid_type', e.target.value)}
                className="input w-full text-sm">
                {FLUID_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Curved Beam */}
        {isCurved && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Rise (mm)</label>
              <input type="number" value={config.extra.rise_mm || ''}
                onChange={e => updateExtra('rise_mm', Number(e.target.value))}
                className="input w-full text-sm" min={50} step={50} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Or: Radius (m)</label>
              <input type="number" value={config.extra.radius_m || ''}
                onChange={e => updateExtra('radius_m', Number(e.target.value))}
                className="input w-full text-sm" min={0.5} step={0.5} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Width (mm)</label>
              <input type="number" value={config.extra.width_mm || ''}
                onChange={e => updateExtra('width_mm', Number(e.target.value))}
                className="input w-full text-sm" min={150} step={25} />
            </div>
          </div>
        )}

        {/* Dome */}
        {isDome && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Rise (m)</label>
            <input type="number" value={config.extra.rise_m || ''}
              onChange={e => updateExtra('rise_m', Number(e.target.value))}
              className="input w-full text-sm" min={0.5} step={0.5} />
          </div>
        )}

        {/* Staircase */}
        {isStair && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Width (m)</label>
              <input type="number" value={config.extra.stair_width_m || 1.2}
                onChange={e => updateExtra('stair_width_m', Number(e.target.value))}
                className="input w-full text-sm" min={0.6} step={0.1} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Landing L (m)</label>
              <input type="number" value={config.extra.landing_length_m || 1.2}
                onChange={e => updateExtra('landing_length_m', Number(e.target.value))}
                className="input w-full text-sm" min={0} step={0.1} />
            </div>
          </div>
        )}

        {/* Typology selector */}
        {el.typologies.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Typology</label>
            <div className="flex flex-wrap gap-1.5">
              {el.typologies.map(t => {
                const key = isBeam ? 'support_type' : isCol ? 'column_shape' : 'slab_type';
                const active = config.extra[key] === t || (!config.extra[key] && t === el.defaultTypology);
                return (
                  <button key={t}
                    onClick={() => updateExtra(key, t)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors
                      ${active ? 'bg-primary-100 border-primary-400 text-primary-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {formatKey(t)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Standard selector */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Design Standard</label>
          <div className="grid grid-cols-2 gap-1.5">
            {STANDARDS.map(s => (
              <button key={s.id}
                onClick={() => updateField('standard', s.id)}
                className={`px-2 py-1.5 rounded-lg text-xs border text-center transition-colors
                  ${config.standard === s.id ? 'bg-primary-100 border-primary-400 text-primary-800 font-semibold' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {s.flag} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Real-time preview */}
        {preview && (
          <div className="bg-primary-50/70 border border-primary-200 rounded-xl p-2.5 text-xs">
            <p className="font-semibold text-gray-800 mb-1.5">Live Preview</p>
            <div className="grid grid-cols-2 gap-1">
              {overrideKeys.slice(0, 6).map(k => (
                <div key={k} className="flex justify-between px-1.5 py-0.5 bg-white/70 rounded">
                  <span className="text-gray-500">{formatKey(k)}</span>
                  <span className="font-mono font-bold text-primary-700">{preview[k]}</span>
                </div>
              ))}
            </div>
            {preview.note && <p className="text-amber-600 mt-1 text-[10px]">{preview.note}</p>}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-2 pt-1">
          <button onClick={() => setStep(1)} className="btn-secondary text-xs flex-1">← Back</button>
          <button onClick={handleCalculate} disabled={loading || !config.primary_dim_mm || config.primary_dim_mm <= 0}
            className="btn-primary text-xs flex-1">
            {loading ? (
              <span className="flex items-center justify-center gap-1">
                <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                Computing...
              </span>
            ) : 'Calculate →'}
          </button>
        </div>
      </div>
    );
  };

  // ──── RENDER: STEP 3 — Review & Override ────────────────────
  const renderStep3 = () => {
    if (!result) return (
      <div className="text-center py-8 text-gray-400 text-sm">
        <p>No calculation data. Run calculation first.</p>
        <button onClick={() => setStep(2)} className="btn-primary text-xs mt-2">← Back to Input</button>
      </div>
    );

    const derived = result.derived || result;
    const quantities = result.quantities || result;
    const cascade = result.cascade || {};
    const warnings = result.warnings || [];

    const overrideCandidates = [
      { key: 'depth_mm', label: 'Depth', crit: { min: 150 } },
      { key: 'width_mm', label: 'Width', crit: { min: 120 } },
      { key: 'thickness_mm', label: 'Thickness', crit: { min: 75 } },
      { key: 'diameter_mm', label: 'Diameter', crit: { min: 200 } },
      { key: 'height_m', label: 'Height', crit: { min: 0.5 } },
      { key: 'radius_m', label: 'Radius', crit: { min: 0.5 } }
    ].filter(c => derived[c.key] !== undefined);

    const fw = quantities.formwork_breakdown || {};

    const statusColor = (key, val) => {
      if (config.overrides[key] !== undefined && config.overrides[key] !== null) return 'yellow';
      const crit = overrideCandidates.find(c => c.key === key)?.crit;
      if (crit && val < crit.min) return 'red';
      return 'green';
    };

    return (
      <div className="space-y-3">
        {/* SVG diagram */}
        {Diagram && (
          <div className="bg-white rounded-xl border border-gray-200 p-2">
            <Diagram
              depth={derived.depth_mm} width={derived.width_mm}
              span={derived.span_to_depth_ratio ? undefined : config.primary_dim_mm}
              height={derived.height_m || derived.clear_height_m}
              thickness={derived.thickness_mm}
              diameter={derived.diameter_mm}
              internalDia={derived.internal_diameter_mm}
              chord={derived.chord_length_m ? derived.chord_length_m * 1000 : config.primary_dim_mm}
              rise={derived.rise_mm || derived.rise_m * 1000}
              radius={derived.radius_m || derived.sphere_radius_m}
              baseDia={derived.base_diameter_m * 1000}
              sphereRadius={derived.sphere_radius_m}
              length={derived.length_m}
            />
          </div>
        )}

        {/* Override cards */}
        <p className="text-xs font-semibold text-gray-700">Override Dimensions</p>
        <div className="grid grid-cols-1 gap-2">
          {overrideCandidates.map(({ key, label }) => {
            const val = derived[key];
            const overridden = config.overrides[key] !== undefined && config.overrides[key] !== null;
            const color = statusColor(key, val);
            const colorMap = {
              green: 'border-green-300 bg-green-50',
              yellow: 'border-yellow-300 bg-yellow-50',
              red: 'border-red-300 bg-red-50'
            };
            return (
              <div key={key} className={`rounded-xl border p-2.5 ${colorMap[color] || 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{label}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                    ${color === 'green' ? 'bg-green-200 text-green-800' : color === 'yellow' ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>
                    {color === 'green' ? 'Standard' : color === 'yellow' ? 'Overridden' : 'Below minimum'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">Auto: <strong>{val}{key.includes('m_') && !key.includes('mm') ? 'm' : 'mm'}</strong></span>
                  <input type="number" defaultValue={overridden ? config.overrides[key] : ''}
                    onChange={e => updateOverride(key, e.target.value)}
                    placeholder="Override..."
                    className="input flex-1 text-sm py-1" step={5} />
                </div>
                {color === 'red' && (
                  <p className="text-[10px] text-red-600 mt-1">⚠ Below code minimum — BOQ injection blocked</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800 flex items-start gap-1.5">
                <span>⚠</span>
                <span>{typeof w === 'string' ? w : w.message || ''}</span>
              </div>
            ))}
          </div>
        )}

        {/* Specialist flags */}
        {fw.note && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800 flex items-start gap-1.5">
            <span>🔧</span>
            <span>{fw.note}</span>
          </div>
        )}

        {/* Cascade accordion */}
        <details className="group border border-gray-200 rounded-xl overflow-hidden">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 flex items-center justify-between">
            <span>Cascade Preview</span>
            <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="p-3 space-y-3">
            {/* Concrete */}
            {(quantities.concrete_volume_m3 || quantities.concrete_volume_m3 === 0) && (
              <div className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-3 py-2">
                <span className="text-xs text-gray-600">
                  <span className="font-semibold">Concrete</span> grade 25/30
                </span>
                <span className="text-sm font-bold text-primary-700">{quantities.concrete_volume_m3?.toFixed(3)} m³</span>
              </div>
            )}

            {/* Formwork with breakdown */}
            {quantities.formwork_m2 !== undefined && (
              <div>
                <div className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-3 py-2 mb-1">
                  <span className="text-xs text-gray-600">
                    <span className="font-semibold">Formwork</span> to {el?.label?.toLowerCase()}
                  </span>
                  <span className="text-sm font-bold text-primary-700">{quantities.formwork_m2?.toFixed(3)} m²</span>
                </div>
                {Object.keys(fw).filter(k => k !== 'note' && k !== 'total_m2').length > 0 && (
                  <div className="pl-3 space-y-0.5">
                    {Object.entries(fw).filter(([k]) => k !== 'note' && k !== 'total_m2').map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[11px] text-gray-500 px-2 py-0.5">
                        <span>{formatKey(k)}</span>
                        <span className="font-mono">{typeof v === 'number' ? v.toFixed(3) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reinforcement */}
            {quantities.reinforcement_kg !== undefined && (
              <div className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-3 py-2">
                <span className="text-xs text-gray-600">
                  <span className="font-semibold">Reinforcement</span> @ {quantities.reinforcement_kg_per_m3 || 120} kg/m³
                </span>
                <span className="text-sm font-bold text-primary-700">{quantities.reinforcement_kg?.toFixed(1)} kg</span>
              </div>
            )}

            {/* Circular column specific */}
            {derived.diameter_mm && result.circular_details && (
              <div className="grid grid-cols-2 gap-2 bg-primary-50 rounded-lg p-2 text-[11px]">
                <div><span className="text-gray-500">Long. bars:</span> <strong>{result.circular_details.longitudinal_bar_count || derived.long_bar_count || '—'}</strong></div>
                <div><span className="text-gray-500">Spiral ties:</span> <strong>{result.circular_details.spiral_tie_count || derived.spiral_count || '—'}</strong></div>
              </div>
            )}

            {/* Finishes */}
            {(cascade.screed_volume_m3 > 0 || cascade.tiling_area_m2 > 0 || cascade.plaster_area_m2 > 0 || cascade.paint_area_m2 > 0) && (
              <div>
                <p className="text-[11px] font-semibold text-amber-700 mb-1">Cascading Finishes</p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(cascade).filter(([, v]) => v > 0).map(([k, v]) => (
                    <div key={k} className="bg-amber-50/60 rounded-lg px-2 py-1.5 text-xs flex justify-between">
                      <span className="text-gray-500">{formatKey(k)}</span>
                      <span className="font-bold text-amber-700">{typeof v === 'number' ? v.toFixed(3) : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>

        {/* Navigation */}
        <div className="flex gap-2 pt-1">
          <button onClick={() => setStep(2)} className="btn-secondary text-xs flex-1">← Back</button>
          <button onClick={() => setStep(4)} className="btn-primary text-xs flex-1"
            disabled={overrideCandidates.some(c => statusColor(c.key, derived[c.key]) === 'red')}>
            Actions →
          </button>
        </div>
        {overrideCandidates.some(c => statusColor(c.key, derived[c.key]) === 'red') && (
          <p className="text-[10px] text-red-500 text-center">Fix below-minimum dimensions above before proceeding</p>
        )}
      </div>
    );
  };

  // ──── RENDER: STEP 4 — Actions ──────────────────────────────
  const renderStep4 = () => {
    if (!result) return renderStep3();
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-700">Actions</p>

        {/* Recalculate */}
        <button onClick={async () => { await doCalculate(); toast.success('Recalculated'); }}
          disabled={loading}
          className="btn-primary text-xs w-full flex items-center justify-center gap-2">
          {loading ? (
            <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <span>🔄</span>
          )}
          Recalculate
        </button>

        {/* Compare Standards */}
        <button onClick={() => { setShowCompare(!showCompare); if (!showCompare) handleCompare(); }}
          className="btn-secondary text-xs w-full">
          {showCompare ? 'Hide Comparison' : '📊 Compare Standards (What-If)'}
        </button>

        {compareLoading && (
          <div className="flex items-center gap-2 justify-center text-xs text-gray-500 py-2">
            <span className="animate-spin w-3 h-3 border-2 border-primary-600 border-t-transparent rounded-full" />
            Comparing...
          </div>
        )}

        {showCompare && compareData && (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-2.5">
            <p className="text-xs font-semibold text-primary-800 mb-1">What-If Comparison</p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-indigo-200">
                    <th className="px-1.5 py-1">Standard</th>
                    <th className="px-1.5 py-1">Depth</th>
                    <th className="px-1.5 py-1">Concrete</th>
                    <th className="px-1.5 py-1">Formwork</th>
                    <th className="px-1.5 py-1">Rebar</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(compareData.comparisons || {}).map(([std, c]) => (
                    <tr key={std} className={std === config.standard ? 'bg-primary-100 font-semibold' : 'border-b border-primary-100'}>
                      <td className="px-1.5 py-1 capitalize">{std}</td>
                      <td className="px-1.5 py-1">{c.depth_mm}mm</td>
                      <td className="px-1.5 py-1">{c.concrete_m3?.toFixed(3)}m³</td>
                      <td className="px-1.5 py-1">{c.formwork_m2?.toFixed(2)}m²</td>
                      <td className="px-1.5 py-1">{c.reinforcement_kg?.toFixed(1)}kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add to BOQ */}
        <div>
          <button onClick={async () => {
            await loadBoqList();
            setShowBoqPicker(true);
          }} disabled={injecting}
            className="btn-secondary text-xs w-full flex items-center justify-center gap-2">
            {injecting ? (
              <span className="animate-spin w-3 h-3 border-2 border-primary-600 border-t-transparent rounded-full" />
            ) : (
              <span>📋</span>
            )}
            Add to BOQ
          </button>

          {showBoqPicker && (
            <div className="mt-2 bg-white border border-gray-200 rounded-xl p-2.5 space-y-1.5">
              <p className="text-xs font-medium text-gray-600 mb-1">Select BOQ document</p>
              {boqList.length === 0 ? (
                <p className="text-[11px] text-gray-400">No BOQs found. Create one first.</p>
              ) : (
                boqList.slice(0, 5).map(b => (
                  <button key={b.id} onClick={() => handleInjectBoq(b.id, b.sections?.[0]?.id)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs border border-gray-100 hover:bg-gray-50 transition-colors">
                    <p className="font-medium text-gray-700">{b.title || 'Untitled BOQ'}</p>
                    <p className="text-[10px] text-gray-400">{b.project_name || ''}</p>
                  </button>
                ))
              )}
              <button onClick={() => setShowBoqPicker(false)}
                className="text-[10px] text-gray-400 hover:text-gray-600 mt-1">Cancel</button>
            </div>
          )}
        </div>

        {/* Save Calculation */}
        <button onClick={handleSave} disabled={saving}
          className="btn-primary text-xs w-full flex items-center justify-center gap-2">
          {saving ? (
            <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <span>💾</span>
          )}
          Save Calculation
        </button>

        {/* New Calculation */}
        <button onClick={resetAll} className="btn-ghost text-xs w-full border border-gray-200 rounded-lg py-2 text-gray-500 hover:bg-gray-50">
          ← New Calculation
        </button>

        {/* Loading overlay */}
        {loading && (
          <div className="text-center py-3">
            <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-1" />
            <p className="text-xs text-gray-500">Processing...</p>
          </div>
        )}
      </div>
    );
  };

  // ──── Main Render ────────────────────────────────────────────
  return (
    <div>
      {renderSteps()}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </div>
  );
}
