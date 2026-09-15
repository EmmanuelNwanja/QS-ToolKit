import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { researchAPI } from '../../services/api';
import toast from 'react-hot-toast';

const card = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

const STAGE_NAMES = [
  '', 'Topic Definition', 'Literature Search', 'Literature Review',
  'Methodology Design', 'Data Collection', 'Data Analysis',
  'Draft Writing', 'Peer Review', 'Revision', 'Final & Archive'
];

export default function ResearchDashboard() {
  const [projects, setProjects] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', research_type: 'literature_review' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [projRes, subRes] = await Promise.allSettled([
          researchAPI.getProjects(),
          researchAPI.getSubscriptionStatus()
        ]);
        if (projRes.status === 'fulfilled') setProjects(projRes.value.data.projects || []);
        if (subRes.status === 'fulfilled') setSubscription(subRes.value.data);
      } catch {
        toast.error('Failed to load research data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    setCreating(true);
    try {
      const res = await researchAPI.createProject(form);
      toast.success('Project created');
      setProjects(prev => [res.data, ...prev]);
      setShowCreate(false);
      setForm({ title: '', description: '', research_type: 'literature_review' });
    } catch {
      toast.error('Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const inProgress = projects.filter(p => p.status === 'in_progress' || p.status === 'draft');
  const completed = projects.filter(p => p.status === 'completed');

  return (
    <ProtectedRoute>
      <Head><title>QS Research — QSToolkit</title></Head>
      <Layout title="📚 QS Research">
        <div className="max-w-6xl space-y-6">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium">
            <span>←</span> Back to Dashboard
          </Link>

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-indigo-800 to-purple-700 rounded-2xl p-6 text-white"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-indigo-200 text-sm uppercase tracking-wide mb-1">QS Research Module</p>
                <h2 className="font-display text-xl font-bold">10-Stage Research Pipeline</h2>
                <p className="text-indigo-200 text-sm mt-1">AI-powered literature review, cost analysis, methodology templates, and collaborative research.</p>
              </div>
              <button onClick={() => setShowCreate(true)} className="btn-gold text-sm">New Project</button>
            </div>
          </motion.div>

          {/* Subscription Banner */}
          {subscription && !subscription.active && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4"
            >
              <div>
                <p className="font-semibold text-amber-800">Unlock Full Research Access</p>
                <p className="text-sm text-amber-600 mt-1">Get unlimited AI research assists, projects, and source curation. ₦3,000/week.</p>
              </div>
              <Link href="/research/subscribe" className="btn-gold text-sm">Subscribe to Research</Link>
            </motion.div>
          )}

          {/* Create Project Modal */}
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card border-indigo-200"
            >
              <h3 className="font-display font-bold text-primary-800 mb-4">New Research Project</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g., Sustainable Material Costs in Lagos Construction"
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Brief description of your research..."
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Research Type *</label>
                  <select
                    className="input"
                    value={form.research_type}
                    onChange={e => setForm(p => ({ ...p, research_type: e.target.value }))}
                  >
                    <option value="literature_review">Literature Review</option>
                    <option value="cost_data_analysis">Cost Data Analysis</option>
                    <option value="methodology_guide">Methodology Guide</option>
                    <option value="case_study">Case Study</option>
                    <option value="comparative_analysis">Comparative Analysis</option>
                    <option value="policy_review">Policy Review</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={creating} className="btn-primary text-sm">
                    {creating ? 'Creating...' : 'Create Project'}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)} className="btn-outline text-sm">Cancel</button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Projects', value: projects.length, icon: '📁', color: 'text-indigo-700' },
              { label: 'In Progress', value: inProgress.length, icon: '🔄', color: 'text-amber-600' },
              { label: 'Completed', value: completed.length, icon: '✅', color: 'text-emerald-600' }
            ].map(s => (
              <motion.div key={s.label} variants={card} initial="hidden" animate="show" className="stat-card text-center">
                <span className="text-2xl mb-1">{s.icon}</span>
                <p className={`stat-value ${s.color} text-xl`}>{loading ? '—' : s.value}</p>
                <p className="stat-label text-xs">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Quick access cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <motion.div variants={card} initial="hidden" animate="show" transition={{ delay: 0.1 }}>
              <Link href="/research/sources" className="card hover:shadow-card-md hover:border-indigo-200 transition-all group block border-l-4 border-l-indigo-500">
                <div className="text-3xl mb-3">📖</div>
                <h3 className="font-display font-bold text-primary-800 group-hover:text-primary-600 mb-1">Literature Sources</h3>
                <p className="text-xs text-gray-500 leading-relaxed">Browse QS research sources — journals, books, NIQS bulletins, government data.</p>
                <div className="mt-3 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700 flex items-center gap-1">
                  Browse Sources <span>&rarr;</span>
                </div>
              </Link>
            </motion.div>

            <motion.div variants={card} initial="hidden" animate="show" transition={{ delay: 0.15 }}>
              <Link href="/research/cost-data" className="card hover:shadow-card-md hover:border-purple-200 transition-all group block border-l-4 border-l-purple-500">
                <div className="text-3xl mb-3">💰</div>
                <h3 className="font-display font-bold text-primary-800 group-hover:text-primary-600 mb-1">Cost Data Explorer</h3>
                <p className="text-xs text-gray-500 leading-relaxed">Market rates, regional aggregates, and trend analysis for Nigerian QS.</p>
                <div className="mt-3 text-xs font-semibold text-purple-600 group-hover:text-purple-700 flex items-center gap-1">
                  Explore Data <span>&rarr;</span>
                </div>
              </Link>
            </motion.div>

            <motion.div variants={card} initial="hidden" animate="show" transition={{ delay: 0.2 }}>
              <Link href="/research/methodology" className="card hover:shadow-card-md hover:border-emerald-200 transition-all group block border-l-4 border-l-emerald-500">
                <div className="text-3xl mb-3">🔬</div>
                <h3 className="font-display font-bold text-primary-800 group-hover:text-primary-600 mb-1">Methodology Templates</h3>
                <p className="text-xs text-gray-500 leading-relaxed">Pre-built research templates — literature review, case study, policy review.</p>
                <div className="mt-3 text-xs font-semibold text-emerald-600 group-hover:text-emerald-700 flex items-center gap-1">
                  View Templates <span>&rarr;</span>
                </div>
              </Link>
            </motion.div>

            <motion.div variants={card} initial="hidden" animate="show" transition={{ delay: 0.25 }}>
              <Link href="/research/collaborate" className="card hover:shadow-card-md hover:border-amber-200 transition-all group block border-l-4 border-l-amber-500">
                <div className="text-3xl mb-3">👥</div>
                <h3 className="font-display font-bold text-primary-800 group-hover:text-primary-600 mb-1">Collaborate</h3>
                <p className="text-xs text-gray-500 leading-relaxed">Share projects with colleagues for peer review and collaborative research.</p>
                <div className="mt-3 text-xs font-semibold text-amber-600 group-hover:text-amber-700 flex items-center gap-1">
                  Start Collaborating <span>&rarr;</span>
                </div>
              </Link>
            </motion.div>
          </div>

          {/* In Progress Projects */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">In Progress</h2>
              <span className="text-sm text-gray-500">{inProgress.length} project{inProgress.length !== 1 ? 's' : ''}</span>
            </div>
            {loading ? (
              <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            ) : inProgress.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">🔬</p>
                <p className="text-sm">No projects in progress</p>
                <button onClick={() => setShowCreate(true)} className="btn-primary text-sm mt-3">Start Your First Project</button>
              </div>
            ) : (
              <div className="space-y-2">
                {inProgress.map(p => (
                  <Link
                    key={p.id}
                    href={`/research/${p.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate group-hover:text-primary-700">{p.title}</p>
                      <p className="text-xs text-gray-500 capitalize">{p.research_type.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                        Stage {p.current_stage}/10
                      </span>
                      <span className="text-xs text-gray-400">{STAGE_NAMES[p.current_stage]}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Completed Projects */}
          {completed.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title">Completed</h2>
                <span className="text-sm text-gray-500">{completed.length} project{completed.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {completed.map(p => (
                  <Link
                    key={p.id}
                    href={`/research/${p.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate group-hover:text-primary-700">{p.title}</p>
                      <p className="text-xs text-gray-500 capitalize">{p.research_type.replace(/_/g, ' ')}</p>
                    </div>
                    <span className="badge badge-green text-xs">Completed</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
