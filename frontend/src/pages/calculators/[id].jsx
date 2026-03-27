import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { calcAPI } from '../../services/api';
import { CALCULATORS } from '../../utils/helpers';
import { getCalculatorMethod } from '../../features/calculators/methodology';

// ── Original 8 ──────────────────────────────────────────────────
import ConcreteForm    from '../../features/calculators/ConcreteForm';
import MasonryForm     from '../../features/calculators/MasonryForm';
import PlasteringForm  from '../../features/calculators/PlasteringForm';
import PaintForm       from '../../features/calculators/PaintForm';
import RoofingForm     from '../../features/calculators/RoofingForm';
import SteelForm       from '../../features/calculators/SteelForm';
import EarthworkForm   from '../../features/calculators/EarthworkForm';
import TilingForm      from '../../features/calculators/TilingForm';
// ── New 5 ────────────────────────────────────────────────────────
import CarpentryForm       from '../../features/calculators/CarpentryForm';
import FormworkForm        from '../../features/calculators/FormworkForm';
import RoofAccessoriesForm from '../../features/calculators/RoofAccessoriesForm';
import DoorWindowForm      from '../../features/calculators/DoorWindowForm';
import BrcDpmForm          from '../../features/calculators/BrcDpmForm';
import ResultsPanel        from '../../features/calculators/ResultsPanel';

const FORM_MAP = {
  concrete:         ConcreteForm,
  masonry:          MasonryForm,
  plastering:       PlasteringForm,
  paint:            PaintForm,
  roofing:          RoofingForm,
  steel:            SteelForm,
  earthwork:        EarthworkForm,
  tiling:           TilingForm,
  carpentry:        CarpentryForm,
  formwork:         FormworkForm,
  'roof-accessories': RoofAccessoriesForm,
  'door-window':    DoorWindowForm,
  'brc-dpm':        BrcDpmForm
};

// Map calc ID to API method (handles hyphened IDs)
function callCalcAPI(id, inputs) {
  const apiMap = {
    concrete:           calcAPI.concrete,
    masonry:            calcAPI.masonry,
    plastering:         calcAPI.plastering,
    paint:              calcAPI.paint,
    roofing:            calcAPI.roofing,
    steel:              calcAPI.steel,
    earthwork:          calcAPI.earthwork,
    tiling:             calcAPI.tiling,
    carpentry:          calcAPI.carpentry,
    formwork:           calcAPI.formwork,
    'roof-accessories': calcAPI.roofAccessories,
    'door-window':      calcAPI.doorWindow,
    'brc-dpm':          calcAPI.brcDpm
  };
  const fn = apiMap[id];
  if (!fn) throw new Error(`No API method for calculator: ${id}`);
  return fn(inputs);
}

export default function CalculatorPage() {
  const router  = useRouter();
  const { id }  = router.query;
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedCalculations, setSavedCalculations] = useState([]);
  const [expandedCalcId, setExpandedCalcId] = useState(null);

  const calc = CALCULATORS.find(c => c.id === id);
  const FormComponent = id ? FORM_MAP[id] : null;
  const method = id ? getCalculatorMethod(id) : null;

  const loadSaved = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await calcAPI.getSaved({ calculator_type: id, limit: 10 });
      setSavedCalculations(data.calculations || []);
    } catch {
      setSavedCalculations([]);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadSaved();
  }, [id, loadSaved]);

  if (!id || !calc) return null;

  const handleCalculate = async (inputs) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await callCalcAPI(id, inputs);
      setResult({ inputs, outputs: res.data, calculator_type: id });
      toast.success('Calculation complete!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Calculation failed';
      if (err.response?.status === 402) {
        toast.error(msg + ' — Upgrade your plan to continue.');
        router.push('/subscription');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>{calc.label} — QSToolkit</title></Head>
      <Layout title={`${calc.icon} ${calc.label}`}>
        <div className="max-w-5xl">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/calculators" className="hover:text-primary-700">Calculators</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{calc.label}</span>
            <span className="badge-blue ml-2">{calc.category}</span>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Input form */}
            <div className="lg:col-span-2">
              <div className="card sticky top-20">
                <h2 className="section-title mb-4">{calc.icon} Inputs</h2>
                {FormComponent ? (
                  <FormComponent onCalculate={handleCalculate} loading={loading} />
                ) : (
                  <p className="text-gray-400 text-sm">Calculator form not found.</p>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-3">
              <ResultsPanel result={result} calculatorId={id} calculatorLabel={calc.label} onSaved={loadSaved} methodology={method} />

              <div className="card mt-4">
                <h3 className="section-title mb-3">📋 Saved Calculations</h3>
                {savedCalculations.length === 0 ? (
                  <p className="text-sm text-gray-500">No saved calculations yet for this calculator.</p>
                ) : (
                  <div className="space-y-2">
                    {savedCalculations.map((item) => (
                      <div key={item.id} className="border border-gray-100 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedCalcId(expandedCalcId === item.id ? null : item.id)}
                          className="w-full text-left p-3 hover:bg-gray-50 transition-colors flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-primary-800">{item.title || 'Untitled calculation'}</p>
                            <p className="text-xs text-gray-500 mt-1">{new Date(item.created_at).toLocaleString('en-NG')}</p>
                          </div>
                          <span className="text-gray-400">{expandedCalcId === item.id ? '▼' : '▶'}</span>
                        </button>
                        
                        {expandedCalcId === item.id && (
                          <div className="bg-gray-50 border-t border-gray-100 p-4 space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Inputs</p>
                              <div className="bg-white rounded p-2 text-xs text-gray-700 space-y-1 max-h-40 overflow-y-auto">
                                {Object.entries(item.inputs || {}).map(([key, val]) => (
                                  <div key={key} className="flex justify-between gap-2">
                                    <span className="text-gray-600">{formatKey(key)}:</span>
                                    <span className="font-mono text-gray-900">{String(val)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Results</p>
                              <div className="bg-white rounded p-2 text-xs text-gray-700 space-y-1 max-h-40 overflow-y-auto">
                                {Object.entries(item.outputs || {}).map(([key, val]) => (
                                  <div key={key} className="flex justify-between gap-2">
                                    <span className="text-gray-600">{formatKey(key)}:</span>
                                    <span className="font-mono font-semibold text-gray-900">
                                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => {
                                  setResult({ inputs: item.inputs, outputs: item.outputs, calculator_type: id });
                                  setExpandedCalcId(null);
                                  toast.success('Calculation loaded!');
                                }}
                                className="btn-secondary text-xs flex-1"
                              >
                                ↻ Reload
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

export async function getStaticPaths() {
  const paths = Object.keys(FORM_MAP).map(id => ({ params: { id } }));
  return { paths, fallback: false };
}

export async function getStaticProps() {
  return { props: {} };
}

// ── Helpers ───────────────────────────────────────────────────
function formatKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
