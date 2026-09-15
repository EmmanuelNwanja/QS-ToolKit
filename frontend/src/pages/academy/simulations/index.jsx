import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { academyAPI } from '../../../services/api';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

const SIM_TYPES = [
  { value: 'boq_scenario', label: 'BOQ Scenario', icon: '📋', desc: 'Practice creating Bills of Quantities for real projects' },
  { value: 'rate_analysis', label: 'Rate Analysis', icon: '💰', desc: 'Analyze and build rates for construction items' },
  { value: 'measurement_takeoff', label: 'Measurement Takeoff', icon: '📐', desc: 'Extract quantities from drawings and specifications' },
  { value: 'cost_plan', label: 'Cost Planning', icon: '📊', desc: 'Develop elemental cost plans for buildings' },
];

const DIFFICULTY_COLORS = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700',
};

export default function SimulationsPage() {
  const [simulations, setSimulations] = useState([]);
  const [pathways, setPathways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [filter, setFilter] = useState({ pathway_id: '', simulation_type: '' });

  useEffect(() => {
    async function load() {
      try {
        const [simsRes, pathwaysRes] = await Promise.allSettled([
          academyAPI.getSimulations(filter.pathway_id ? { pathway_id: filter.pathway_id, simulation_type: filter.simulation_type || undefined } : {}),
          academyAPI.getPathways(),
        ]);
        if (simsRes.status === 'fulfilled') setSimulations(simsRes.value.data.simulations || []);
        if (pathwaysRes.status === 'fulfilled') setPathways(pathwaysRes.value.data.pathways || []);
      } catch { toast.error('Failed to load simulations'); }
      finally { setLoading(false); }
    }
    load();
  }, [filter]);

  const handleGenerate = async (type) => {
    if (!pathways.length) { toast.error('No pathways available'); return; }
    setGenerating(type);
    try {
      const { data } = await academyAPI.generateSimulation({
        pathway_id: pathways[0].id,
        simulation_type: type,
        difficulty: 'medium'
      });
      toast.success('Simulation generated!');
      setSimulations(prev => [data.simulation || data, ...prev]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate simulation');
    } finally { setGenerating(null); }
  };

  return (
    <ProtectedRoute>
      <Head><title>QS Simulations — QS Academy</title></Head>
      <Layout title="🧮 QS Simulations">
        <div className="max-w-7xl space-y-6">
          {/* Generate Cards */}
          <motion.div {...fadeUp}>
            <h3 className="font-display text-lg font-bold text-primary-800 mb-4">Generate New Simulation</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {SIM_TYPES.map(st => (
                <div key={st.value} className="card hover:shadow-md transition-shadow">
                  <div className="text-2xl mb-2">{st.icon}</div>
                  <h4 className="font-semibold text-sm text-primary-800">{st.label}</h4>
                  <p className="text-xs text-slate-500 mt-1 mb-3">{st.desc}</p>
                  <button
                    onClick={() => handleGenerate(st.value)}
                    disabled={generating !== null}
                    className="w-full btn-primary text-xs py-2 disabled:opacity-50"
                  >
                    {generating === st.value ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div {...fadeUp} className="flex flex-wrap gap-3">
            <select value={filter.pathway_id} onChange={e => setFilter(f => ({ ...f, pathway_id: e.target.value }))} className="input text-sm">
              <option value="">All Pathways</option>
              {pathways.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <select value={filter.simulation_type} onChange={e => setFilter(f => ({ ...f, simulation_type: e.target.value }))} className="input text-sm">
              <option value="">All Types</option>
              {SIM_TYPES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
            </select>
          </motion.div>

          {/* Simulations List */}
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700" /></div>
          ) : simulations.length === 0 ? (
            <motion.div {...fadeUp} className="card text-center py-12">
              <p className="text-4xl mb-3">🧮</p>
              <h3 className="font-display font-bold text-primary-800 mb-2">No Simulations Yet</h3>
              <p className="text-sm text-slate-500">Generate your first simulation to start practicing</p>
            </motion.div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {simulations.map((sim, i) => {
                const typeInfo = SIM_TYPES.find(t => t.value === sim.simulation_type) || SIM_TYPES[0];
                return (
                  <motion.div key={sim.id} {...fadeUp} transition={{ delay: i * 0.05 }}
                    className="card hover:shadow-md transition-shadow">
                    <Link href={`/academy/simulations/${sim.id}`}>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{typeInfo.icon}</span>
                            <span className="text-xs font-medium text-slate-500">{typeInfo.label}</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[sim.difficulty] || ''}`}>
                            {sim.difficulty}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm text-primary-800 line-clamp-2">{sim.title}</h4>
                        {sim.description && <p className="text-xs text-slate-500 line-clamp-2">{sim.description}</p>}
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>⏱ {sim.estimated_minutes || 20} min</span>
                          <span className="ml-auto text-purple-600 font-medium">Start →</span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
