import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { academyAPI } from '../../../services/api';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

export default function SimulationRunner() {
  const router = useRouter();
  const { id } = router.query;
  const [simulation, setSimulation] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    if (!id) return;
    academyAPI.getSimulations({})
      .then(res => {
        const sim = (res.data.simulations || []).find(s => s.id === id);
        if (sim) setSimulation(sim);
      })
      .catch(() => toast.error('Failed to load simulation'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const { data } = await academyAPI.startSimulation(id);
      setAttempt(data.attempt);
      setSimulation(data.simulation);
      toast.success('Simulation started!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start');
    } finally { setStarting(false); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data } = await academyAPI.submitSimulation(id, {
        attempt_id: attempt.id,
        answers,
        time_spent_seconds: 0
      });
      setResults(data);
      toast.success('Simulation submitted!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  if (loading) return <ProtectedRoute><Layout title="Loading..."><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700" /></div></Layout></ProtectedRoute>;
  if (!simulation) return <ProtectedRoute><Layout title="Not Found"><div className="card text-center py-12"><p>Simulation not found</p><Link href="/academy/simulations" className="text-purple-600 underline mt-2 inline-block">Back to simulations</Link></div></Layout></ProtectedRoute>;

  const config = simulation.config || {};
  const items = config.items || [];
  const materials = config.materials || [];
  const elements = config.elements || [];
  const isBOQ = simulation.simulation_type === 'boq_scenario';
  const isRate = simulation.simulation_type === 'rate_analysis';
  const isTakeoff = simulation.simulation_type === 'measurement_takeoff';
  const isCostPlan = simulation.simulation_type === 'cost_plan';

  return (
    <ProtectedRoute>
      <Head><title>{simulation.title} — QS Academy</title></Head>
      <Layout title="">
        <div className="max-w-4xl mx-auto space-y-6">
          <motion.div {...fadeUp}>
            <Link href="/academy/simulations" className="text-sm text-purple-600 hover:underline mb-2 inline-block">← Back to Simulations</Link>
            <h1 className="font-display font-bold text-2xl text-primary-800">{simulation.title}</h1>
            {simulation.description && <p className="text-sm text-slate-500 mt-1">{simulation.description}</p>}
          </motion.div>

          {/* Results */}
          {results && (
            <motion.div {...fadeUp} className="card border-2 border-green-200 bg-green-50">
              <h3 className="font-semibold text-green-800 mb-2">📊 Results</h3>
              <div className="text-3xl font-bold text-green-700">{results.score} / {results.max_score}</div>
              <p className="text-sm text-green-600 mt-1">{results.score >= results.max_score * 0.7 ? 'Well done!' : 'Keep practicing!'}</p>
              <Link href="/academy/simulations" className="btn-primary mt-4 inline-block text-sm">Back to Simulations</Link>
            </motion.div>
          )}

          {/* Not Started */}
          {!attempt && !results && (
            <motion.div {...fadeUp} className="card text-center py-8">
              <p className="text-4xl mb-3">{isBOQ ? '📋' : isRate ? '💰' : isTakeoff ? '📐' : '📊'}</p>
              <h3 className="font-display font-bold text-primary-800 mb-2">Ready to Start?</h3>
              <p className="text-sm text-slate-500 mb-4">This simulation will test your {simulation.simulation_type.replace(/_/g, ' ')} skills</p>
              <button onClick={handleStart} disabled={starting} className="btn-primary px-8">
                {starting ? 'Starting...' : 'Start Simulation'}
              </button>
            </motion.div>
          )}

          {/* BOQ Scenario */}
          {attempt && isBOQ && !results && (
            <motion.div {...fadeUp} className="card">
              <h3 className="font-semibold text-primary-800 mb-4">📋 Bill of Quantities — Enter Your Quantities & Rates</h3>
              <p className="text-sm text-slate-500 mb-4">Fill in your estimated quantities and rates for each item</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="p-2 font-medium text-slate-600">Item</th>
                      <th className="p-2 font-medium text-slate-600">Unit</th>
                      <th className="p-2 font-medium text-slate-600">Your Qty</th>
                      <th className="p-2 font-medium text-slate-600">Your Rate (₦)</th>
                      <th className="p-2 font-medium text-slate-600">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="p-2 text-slate-800">{item.name}</td>
                        <td className="p-2 text-slate-500">{item.unit}</td>
                        <td className="p-2">
                          <input type="number" className="input w-20 text-sm" placeholder="--"
                            onChange={e => setAnswers(a => ({ ...a, items: (a.items || []).map(ai => ai.id === item.id ? { ...ai, user_qty: Number(e.target.value) } : ai.id ? ai : { id: item.id, user_qty: Number(e.target.value) }).filter(x => x.id || x.user_qty) }))} />
                        </td>
                        <td className="p-2">
                          <input type="number" className="input w-28 text-sm" placeholder="--"
                            onChange={e => setAnswers(a => ({ ...a, items: (a.items || []).map(ai => ai.id === item.id ? { ...ai, user_rate: Number(e.target.value) } : ai.id ? ai : { id: item.id, user_rate: Number(e.target.value) }).filter(x => x.id || x.user_rate) }))} />
                        </td>
                        <td className="p-2 text-slate-400 text-xs">{item.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary mt-4 w-full">
                {submitting ? 'Submitting...' : 'Submit BOQ'}
              </button>
            </motion.div>
          )}

          {/* Rate Analysis */}
          {attempt && isRate && !results && (
            <motion.div {...fadeUp} className="card">
              <h3 className="font-semibold text-primary-800 mb-4">💰 Rate Analysis</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Materials</h4>
                  {materials.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 mb-2">
                      <span className="text-sm text-slate-600 flex-1">{m.name} ({m.quantity} {m.unit})</span>
                      <input type="number" className="input w-28 text-sm" placeholder="Rate (₦)"
                        onChange={e => setAnswers(a => ({ ...a, [`mat_${i}`]: Number(e.target.value) }))} />
                    </div>
                  ))}
                </div>
                {config.labor?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Labor</h4>
                    {config.labor.map((l, i) => (
                      <div key={i} className="flex items-center gap-3 mb-2">
                        <span className="text-sm text-slate-600 flex-1">{l.role} ({l.hours}h)</span>
                        <input type="number" className="input w-28 text-sm" placeholder="Rate/hr (₦)"
                          onChange={e => setAnswers(a => ({ ...a, [`labor_${i}`]: Number(e.target.value) }))} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Overhead %</label>
                    <input type="number" className="input w-full text-sm" placeholder="15"
                      onChange={e => setAnswers(a => ({ ...a, overhead: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Profit %</label>
                    <input type="number" className="input w-full text-sm" placeholder="10"
                      onChange={e => setAnswers(a => ({ ...a, profit: Number(e.target.value) }))} />
                  </div>
                </div>
              </div>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary mt-4 w-full">
                {submitting ? 'Submitting...' : 'Submit Rate Analysis'}
              </button>
            </motion.div>
          )}

          {/* Measurement Takeoff */}
          {attempt && isTakeoff && !results && (
            <motion.div {...fadeUp} className="card">
              <h3 className="font-semibold text-primary-800 mb-4">📐 Measurement Takeoff</h3>
              <div className="space-y-4">
                {elements.map((el, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-800">{el.name}</p>
                    <p className="text-xs text-slate-500 mb-2">{el.description}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-slate-600">Quantity</label>
                        <input type="number" className="input w-full text-sm" placeholder="--"
                          onChange={e => setAnswers(a => ({ ...a, [`el_${i}_qty`]: Number(e.target.value) }))} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600">Unit</label>
                        <input type="text" className="input w-full text-sm" placeholder={el.unit || 'm2'}
                          onChange={e => setAnswers(a => ({ ...a, [`el_${i}_unit`]: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600">Notes</label>
                        <input type="text" className="input w-full text-sm" placeholder="Optional"
                          onChange={e => setAnswers(a => ({ ...a, [`el_${i}_notes`]: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary mt-4 w-full">
                {submitting ? 'Submitting...' : 'Submit Takeoff'}
              </button>
            </motion.div>
          )}

          {/* Cost Plan */}
          {attempt && isCostPlan && !results && (
            <motion.div {...fadeUp} className="card">
              <h3 className="font-semibold text-primary-800 mb-4">📊 Elemental Cost Plan</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Total Estimated Cost (₦)</label>
                    <input type="number" className="input w-full text-sm" placeholder="e.g. 75000000"
                      onChange={e => setAnswers(a => ({ ...a, total_cost: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Area (m²)</label>
                    <input type="number" className="input w-full text-sm" placeholder="e.g. 500"
                      onChange={e => setAnswers(a => ({ ...a, area: Number(e.target.value) }))} />
                  </div>
                </div>
                {config.elements?.map((el, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 flex-1">{el.name}</span>
                    <input type="number" className="input w-20 text-sm" placeholder={`${el.pct}%`}
                      onChange={e => setAnswers(a => ({ ...a, [`elem_${i}`]: Number(e.target.value) }))} />
                    <span className="text-xs text-slate-400 w-20 text-right">₦{el.estimated_cost_ngn?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary mt-4 w-full">
                {submitting ? 'Submitting...' : 'Submit Cost Plan'}
              </button>
            </motion.div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
