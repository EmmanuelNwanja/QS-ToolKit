import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { researchAPI } from '../../services/api';
import toast from 'react-hot-toast';

const TYPES = [
  { value: '', label: 'All Types' },
  { value: 'journal', label: 'Journal' },
  { value: 'book', label: 'Book' },
  { value: 'report', label: 'Report' },
  { value: 'standard', label: 'Standard' },
  { value: 'thesis', label: 'Thesis' },
  { value: 'website', label: 'Website' },
  { value: 'niqs_bulletin', label: 'NIQS Bulletin' },
  { value: 'government_data', label: 'Government Data' }
];

export default function SourcesBrowser() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', authors: '', year: '', source_type: 'journal',
    url: '', doi: '', abstract: '', keywords: '', region: 'Nigeria'
  });
  const [saving, setSaving] = useState(false);

  const loadSources = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      const res = await researchAPI.getSources(params);
      setSources(res.data.sources || []);
    } catch {
      toast.error('Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSources(); }, [search, typeFilter]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      await researchAPI.addSource({
        ...form,
        authors: form.authors ? form.authors.split(',').map(a => a.trim()) : [],
        year: form.year ? parseInt(form.year) : null,
        keywords: form.keywords ? form.keywords.split(',').map(k => k.trim()) : []
      });
      toast.success('Source added');
      setShowAdd(false);
      setForm({ title: '', authors: '', year: '', source_type: 'journal', url: '', doi: '', abstract: '', keywords: '', region: 'Nigeria' });
      loadSources();
    } catch {
      toast.error('Failed to add source');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>Literature Sources - QS Research</title></Head>
      <Layout title="Literature Sources">
        <div className="max-w-6xl space-y-6">
          <Link href="/research" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium">
            <span>←</span> Back to Research
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl font-bold text-primary-800">Literature Sources</h1>
              <p className="text-sm text-gray-500">Browse QS research sources - journals, books, NIQS bulletins, government data.</p>
            </div>
            <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm">
              {showAdd ? 'Cancel' : '+ Add Source'}
            </button>
          </div>

          {showAdd && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card border-indigo-200">
              <h3 className="font-display font-bold text-primary-800 mb-4">Add New Source</h3>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                    <input type="text" className="input text-sm" placeholder="Source title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Authors (comma-separated)</label>
                    <input type="text" className="input text-sm" placeholder="Author 1, Author 2" value={form.authors} onChange={e => setForm(p => ({ ...p, authors: e.target.value }))} />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                    <input type="number" className="input text-sm" placeholder="2024" min="1900" max="2030" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                    <select className="input text-sm" value={form.source_type} onChange={e => setForm(p => ({ ...p, source_type: e.target.value }))}>
                      {TYPES.filter(t => t.value).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Region</label>
                    <input type="text" className="input text-sm" value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
                    <input type="url" className="input text-sm" placeholder="https://..." value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">DOI</label>
                    <input type="text" className="input text-sm" placeholder="10.xxxx/xxxxx" value={form.doi} onChange={e => setForm(p => ({ ...p, doi: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Abstract</label>
                  <textarea className="input text-sm" rows={2} placeholder="Brief abstract..." value={form.abstract} onChange={e => setForm(p => ({ ...p, abstract: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Keywords (comma-separated)</label>
                  <input type="text" className="input text-sm" placeholder="cost estimation, Nigeria, QS" value={form.keywords} onChange={e => setForm(p => ({ ...p, keywords: e.target.value }))} />
                </div>
                <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Adding...' : 'Add Source'}</button>
              </form>
            </motion.div>
          )}

          {/* Filters */}
          <div className="flex gap-3 items-center">
            <input
              type="text"
              className="input text-sm flex-1 max-w-xs"
              placeholder="Search sources..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="input text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Sources List */}
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : sources.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📖</p>
              <p className="font-medium">No sources found</p>
              <p className="text-sm mt-1">Add sources or adjust your filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map(s => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card hover:shadow-card-md transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-gray-900">{s.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {s.authors?.join(', ')} {s.year ? `(${s.year})` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="badge badge-indigo text-xs capitalize">{s.source_type?.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-gray-400">{s.region}</span>
                        {s.doi && <span className="text-xs text-blue-500">DOI: {s.doi}</span>}
                      </div>
                      {s.abstract && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{s.abstract}</p>}
                      {s.keywords?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.keywords.slice(0, 5).map((k, i) => (
                            <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{k}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
