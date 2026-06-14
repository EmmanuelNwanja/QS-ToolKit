import { useState, useEffect } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { academyAPI } from '../../services/api';

const RESOURCE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'video', label: '🎥 Video' },
  { value: 'article', label: '📄 Article' },
  { value: 'quiz', label: '❓ Quiz' },
  { value: 'exercise', label: '✏️ Exercise' },
  { value: 'case_study', label: '📋 Case Study' },
];

const LEVELS = [
  { value: '', label: 'All Levels' },
  { value: '1', label: 'Level 1' },
  { value: '2', label: 'Level 2' },
  { value: '3', label: 'Level 3' },
  { value: '4', label: 'Level 4' },
  { value: '5', label: 'Level 5' },
];

const TYPE_BADGES = {
  video: 'bg-blue-100 text-blue-700',
  article: 'bg-gray-100 text-gray-700',
  quiz: 'bg-purple-100 text-purple-700',
  exercise: 'bg-emerald-100 text-emerald-700',
  case_study: 'bg-gold-100 text-gold-700',
};

export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ pathway: '', level: '', type: '' });
  const [selectedResource, setSelectedResource] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = {};
        if (filters.pathway) params.pathway = filters.pathway;
        if (filters.level) params.level = filters.level;
        if (filters.type) params.type = filters.type;
        const res = await academyAPI.getResources(params);
        setResources(res.data.resources || []);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, [filters]);

  const handleViewResource = async (id) => {
    setDetailLoading(true);
    try {
      const res = await academyAPI.getResource(id);
      setSelectedResource(res.data.resource);
    } catch {
      setDetailLoading(false);
    }
  };

  const set = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  return (
    <ProtectedRoute>
      <Head><title>Resources — QS Academy</title></Head>
      <Layout title="📖 Resource Library">
        <div className="max-w-6xl space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select value={filters.pathway} onChange={(e) => set('pathway', e.target.value)} className="input text-sm py-2">
              <option value="">All Pathways</option>
              <option value="technical-qs-practice">Technical QS Practice</option>
              <option value="construction-commercial-management">Commercial Management</option>
              <option value="construction-project-management">Project Management</option>
              <option value="real-estate-property-advisory">Real Estate Advisory</option>
              <option value="construction-dispute-resolution">Dispute Resolution</option>
              <option value="qs-technology-digital-construction">QS Technology</option>
              <option value="academic-research-career">Academic & Research</option>
            </select>
            <select value={filters.level} onChange={(e) => set('level', e.target.value)} className="input text-sm py-2">
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <select value={filters.type} onChange={(e) => set('type', e.target.value)} className="input text-sm py-2">
              {RESOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-5 bg-gray-100 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                  <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : resources.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📚</p>
              <p className="font-medium">No resources found</p>
              <p className="text-sm mt-1">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resources.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => handleViewResource(r.id)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGES[r.type] || 'bg-gray-100 text-gray-600'}`}>
                      {r.type?.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-400">Level {r.level}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm group-hover:text-primary-700 mb-1">{r.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{r.excerpt}</p>
                  {r.pathway_name && (
                    <p className="text-xs text-primary-500 mt-2">{r.pathway_name}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Detail modal */}
        <AnimatePresence>
          {selectedResource && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
                  <h2 className="font-display text-lg font-bold text-primary-800">{selectedResource.title}</h2>
                  <button onClick={() => setSelectedResource(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                </div>
                <div className="px-6 py-5 prose prose-sm max-w-none">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGES[selectedResource.type] || 'bg-gray-100 text-gray-600'}`}>
                      {selectedResource.type?.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-400">Level {selectedResource.level}</span>
                  </div>
                  {selectedResource.content ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedResource.content }} />
                  ) : (
                    <p className="text-gray-500 italic">Full content will be displayed here.</p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Layout>
    </ProtectedRoute>
  );
}
