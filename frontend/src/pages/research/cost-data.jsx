import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { researchAPI } from '../../services/api';
import toast from 'react-hot-toast';

const REGIONS = ['Lagos', 'Abuja', 'Rivers', 'Kano', 'Oyo', 'Enugu', 'Edo', 'Kaduna', 'Ogun', 'Anambra'];

export default function CostDataExplorer() {
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [aggItem, setAggItem] = useState('');
  const [aggregate, setAggregate] = useState(null);
  const [aggLoading, setAggLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    item_description: '', unit: '', rate_ngn: '', region: 'Lagos',
    state: '', source: '', project_type: '', tags: ''
  });
  const [saving, setSaving] = useState(false);

  const loadCosts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.item = search;
      if (regionFilter) params.region = regionFilter;
      const res = await researchAPI.getCostData(params);
      setCosts(res.data.costs || []);
    } catch {
      toast.error('Failed to load cost data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCosts(); }, [search, regionFilter]);

  const handleAgg = async () => {
    if (!aggItem.trim()) return toast.error('Enter an item to search');
    setAggLoading(true);
    setAggregate(null);
    try {
      const res = await researchAPI.getCostAggregate(aggItem);
      setAggregate(res.data);
    } catch {
      toast.error('Failed to fetch aggregate');
    } finally {
      setAggLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.item_description || !form.unit || !form.rate_ngn) {
      return toast.error('Item, unit, and rate are required');
    }
    setSaving(true);
    try {
      await researchAPI.addCostData({
        ...form,
        rate_ngn: parseFloat(form.rate_ngn),
        tags: form.tags ? form.tags.split(',').map(t => t.trim()) : []
      });
      toast.success('Cost data added');
      setShowAdd(false);
      setForm({ item_description: '', unit: '', rate_ngn: '', region: 'Lagos', state: '', source: '', project_type: '', tags: '' });
      loadCosts();
    } catch {
      toast.error('Failed to add cost data');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>Cost Data Explorer — QS Research</title></Head>
      <Layout title="Cost Data Explorer">
        <div className="max-w-6xl space-y-6">
          <Link href="/research" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium">
            <span>←</span> Back to Research
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl font-bold text-primary-800">Cost Data Explorer</h1>
              <p className="text-sm text-gray-500">Market rates, regional aggregates, and trend analysis for Nigerian QS.</p>
            </div>
            <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm">
              {showAdd ? 'Cancel' : '+ Add Data'}
            </button>
          </div>

          {showAdd && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card border-purple-200">
              <h3 className="font-display font-bold text-primary-800 mb-4">Add Cost Data</h3>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Item *</label>
                    <input type="text" className="input text-sm" placeholder="e.g., Cement 50kg" value={form.item_description} onChange={e => setForm(p => ({ ...p, item_description: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Unit *</label>
                    <input type="text" className="input text-sm" placeholder="e.g., bag, m², m³" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Rate (₦) *</label>
                    <input type="number" className="input text-sm" placeholder="5500" min="0" step="0.01" value={form.rate_ngn} onChange={e => setForm(p => ({ ...p, rate_ngn: e.target.value }))} />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Region *</label>
                    <select className="input text-sm" value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))}>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                    <input type="text" className="input text-sm" placeholder="Optional" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Source</label>
                    <input type="text" className="input text-sm" placeholder="e.g., BOQ, Market survey" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                  <input type="text" className="input text-sm" placeholder="material, rates, 2024" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
                </div>
                <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Adding...' : 'Add Data Point'}</button>
              </form>
            </motion.div>
          )}

          {/* Aggregate Search */}
          <div className="card border-indigo-200">
            <h3 className="font-display font-bold text-primary-800 mb-3">📊 Regional Aggregate</h3>
            <div className="flex gap-2">
              <input
                type="text"
                className="input text-sm flex-1"
                placeholder="Search item to aggregate (e.g., Cement 50kg)"
                value={aggItem}
                onChange={e => setAggItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAgg()}
              />
              <button onClick={handleAgg} disabled={aggLoading} className="btn-primary text-sm">
                {aggLoading ? 'Searching...' : 'Get Aggregate'}
              </button>
            </div>
            {aggregate && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                <p className="text-xs text-gray-500 mb-3">Showing aggregate for: <strong>{aggregate.item}</strong></p>
                {aggregate.regions?.length === 0 ? (
                  <p className="text-xs text-gray-400">No data found for this item.</p>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {aggregate.regions.map(r => (
                      <div key={r.region} className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <p className="font-semibold text-sm text-indigo-800">{r.region}</p>
                        <p className="text-lg font-bold text-primary-700 mt-1">₦{r.avg_rate?.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          Range: ₦{r.min_rate?.toLocaleString()} — ₦{r.max_rate?.toLocaleString()} ({r.count} data points)
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-3 items-center">
            <input
              type="text"
              className="input text-sm flex-1 max-w-xs"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="input text-sm" value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>
              <option value="">All Regions</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Data List */}
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : costs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">💰</p>
              <p className="font-medium">No cost data found</p>
              <p className="text-sm mt-1">Add data points or adjust your search.</p>
            </div>
          ) : (
            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-xs font-semibold text-gray-600">Item</th>
                      <th className="text-left py-2 text-xs font-semibold text-gray-600">Unit</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-600">Rate (₦)</th>
                      <th className="text-left py-2 text-xs font-semibold text-gray-600">Region</th>
                      <th className="text-left py-2 text-xs font-semibold text-gray-600">Source</th>
                      <th className="text-left py-2 text-xs font-semibold text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.map(c => (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 font-medium">{c.item_description}</td>
                        <td className="py-2 text-gray-500">{c.unit}</td>
                        <td className="py-2 text-right font-semibold text-primary-700">₦{parseFloat(c.rate_ngn).toLocaleString()}</td>
                        <td className="py-2 text-gray-500">{c.region}</td>
                        <td className="py-2 text-gray-400 text-xs">{c.source || '—'}</td>
                        <td className="py-2 text-gray-400 text-xs">{c.date_collected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
