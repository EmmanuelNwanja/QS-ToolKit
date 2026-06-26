import { useState, useEffect } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import { academyAPI } from '../../services/api';
import toast from 'react-hot-toast';

const RESOURCE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'video', label: '🎥 Video' },
  { value: 'article', label: '📄 Article' },
  { value: 'document', label: '📑 Document' },
  { value: 'quiz', label: '❓ Quiz' },
  { value: 'exercise', label: '✏️ Exercise' },
  { value: 'case_study', label: '📋 Case Study' },
];

const LEVELS = [
  { value: '', label: 'All Levels' },
  { value: '1', label: 'Level 1 - Foundation' },
  { value: '2', label: 'Level 2 - Intermediate' },
  { value: '3', label: 'Level 3 - Advanced' },
  { value: '4', label: 'Level 4 - Expert' },
  { value: '5', label: 'Level 5 - Master' },
];

const TYPE_BADGES = {
  video: 'bg-blue-100 text-blue-700',
  article: 'bg-gray-100 text-gray-700',
  document: 'bg-indigo-100 text-indigo-700',
  quiz: 'bg-purple-100 text-purple-700',
  exercise: 'bg-emerald-100 text-emerald-700',
  case_study: 'bg-gold-100 text-gold-700',
};

// Curated resources for the Nigerian QS domain
const FEATURED_RESOURCES = [
  {
    id: 'featured-1',
    title: 'Understanding SMM7 - Standard Method of Measurement',
    type: 'video',
    level: '1',
    excerpt: 'A comprehensive video guide to SMM7 (Standard Method of Measurement 7th Edition) for building works.',
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    pathway_name: 'Technical QS Practice'
  },
  {
    id: 'featured-2',
    title: 'BOQ Preparation Masterclass',
    type: 'video', 
    level: '2',
    excerpt: 'Learn how to prepare a professional Bill of Quantities from scratch.',
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    pathway_name: 'Technical QS Practice'
  },
  {
    id: 'featured-3',
    title: 'Nigerian Construction Standards Guide',
    type: 'document',
    level: '1',
    excerpt: 'Essential standards every Nigerian QS professional must know.',
    pathway_name: 'Technical QS Practice'
  },
];

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
      } catch {
        toast.error('Failed to load resources');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filters]);

  const handleViewResource = async (id) => {
    setDetailLoading(true);
    try {
      const res = await academyAPI.getResource(id);
      setSelectedResource(res.data.resource);
    } catch {
      toast.error('Failed to load resource');
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
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-gray-500 mb-1 block">Pathway</label>
                <select value={filters.pathway} onChange={(e) => set('pathway', e.target.value)} className="w-full input text-sm py-2">
                  <option value="">All Pathways</option>
                  <option value="technical-qs-practice">Technical QS Practice</option>
                  <option value="construction-commercial-management">Commercial Management</option>
                  <option value="construction-project-management">Project Management</option>
                  <option value="real-estate-property-advisory">Real Estate Advisory</option>
                  <option value="construction-dispute-resolution">Dispute Resolution</option>
                  <option value="qs-technology-digital-construction">QS Technology</option>
                  <option value="academic-research-career">Academic & Research</option>
                </select>
              </div>
              <div className="w-32">
                <label className="text-xs text-gray-500 mb-1 block">Level</label>
                <select value={filters.level} onChange={(e) => set('level', e.target.value)} className="w-full input text-sm py-2">
                  {LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-40">
                <label className="text-xs text-gray-500 mb-1 block">Resource Type</label>
                <select value={filters.type} onChange={(e) => set('type', e.target.value)} className="w-full input text-sm py-2">
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              {(filters.pathway || filters.level || filters.type) && (
                <button
                  onClick={() => setFilters({ pathway: '', level: '', type: '' })}
                  className="mt-5 text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
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
            <div className="space-y-6">
              {/* Group resources by level */}
              {(() => {
                const grouped = {};
                resources.forEach(r => {
                  const level = r.level || 1;
                  if (!grouped[level]) grouped[level] = [];
                  grouped[level].push(r);
                });
                const sortedLevels = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
                
                return sortedLevels.map(level => (
                  <div key={level}>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">Level {level}</h3>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">{grouped[level].length} resource{grouped[level].length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {grouped[level].map((r) => (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer group bg-white"
                          onClick={() => handleViewResource(r.id)}
                        >
                          {/* Video thumbnail */}
                          {r.type === 'video' && (r.video_url || r.resource_url) && (
                            <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-200 relative">
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                  <span className="text-primary-600 text-xl ml-1">▶</span>
                                </div>
                              </div>
                              <div className="absolute top-2 left-2">
                                <span className="px-2 py-0.5 bg-black/50 text-white text-xs rounded">VIDEO</span>
                              </div>
                            </div>
                          )}
                          
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGES[r.type] || 'bg-gray-100 text-gray-600'}`}>
                                {r.type?.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-gray-400">Level {r.level}</span>
                            </div>
                            <h3 className="font-semibold text-gray-900 text-sm group-hover:text-primary-700 mb-1 line-clamp-2">{r.title}</h3>
                            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{r.excerpt}</p>
                            {r.pathway_name && (
                              <p className="text-xs text-primary-500 mt-2">{r.pathway_name}</p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
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
                <div className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGES[selectedResource.type] || 'bg-gray-100 text-gray-600'}`}>
                      {selectedResource.type?.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-400">Level {selectedResource.level}</span>
                    {selectedResource.pathway_name && (
                      <span className="text-xs text-primary-500">• {selectedResource.pathway_name}</span>
                    )}
                  </div>
                  {/* Video embed if available */}
                  {(selectedResource.video_url || selectedResource.resource_url) && (
                    <div className="mb-6">
                      {(selectedResource.video_url || selectedResource.resource_url || '').includes('youtube.com') || 
                       (selectedResource.video_url || selectedResource.resource_url || '').includes('youtu.be') ? (
                        <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                          <iframe
                            src={(selectedResource.video_url || selectedResource.resource_url || '').replace('watch?v=', 'embed/')}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title={selectedResource.title}
                          />
                        </div>
                      ) : (
                        <a 
                          href={selectedResource.video_url || selectedResource.resource_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm"
                        >
                          📎 Open resource ↗
                        </a>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  {selectedResource.content ? (
                    <div className="prose prose-sm prose-primary max-w-none">
                      <MarkdownRenderer content={selectedResource.content} />
                    </div>
                  ) : selectedResource.excerpt ? (
                    <div className="prose prose-sm prose-primary max-w-none">
                      <MarkdownRenderer content={selectedResource.excerpt} />
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">Full content will be displayed here.</p>
                  )}
                  {selectedResource.resource_url && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <a
                        href={selectedResource.resource_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium inline-flex items-center gap-1"
                      >
                        Open Resource ↗
                      </a>
                    </div>
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
