import { useEffect, useState } from 'react';
import Head from 'next/head';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { feedbackAPI, projectAPI } from '../../services/api';
import { formatDate } from '../../utils/helpers';

export default function FeedbackPage() {
  const [links, setLinks]       = useState([]);
  const [responses, setResponses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ project_id: '', client_name: '', client_email: '', message: '' });

  useEffect(() => {
    Promise.allSettled([
      feedbackAPI.myLinks(),
      feedbackAPI.myFeedback(),
      projectAPI.list({ limit: 100 })
    ]).then(([l, r, p]) => {
      if (l.status === 'fulfilled') setLinks(l.value.data.links || []);
      if (r.status === 'fulfilled') setResponses(r.value.data.responses || []);
      if (p.status === 'fulfilled') setProjects(p.value.data.projects || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const { data } = await feedbackAPI.createLink(createForm);
      setLinks(l => [data.link, ...l]);
      setShowCreate(false);
      await navigator.clipboard.writeText(data.link.feedback_url);
      toast.success('Feedback link created and copied to clipboard!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create link');
    }
  };

  const deactivate = async (id) => {
    try {
      await feedbackAPI.deactivate(id);
      setLinks(l => l.map(lk => lk.id === id ? { ...lk, is_active: false } : lk));
      toast.success('Link deactivated');
    } catch { toast.error('Could not deactivate link'); }
  };

  const copyLink = async (url) => {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  const avgRating = responses.length
    ? (responses.reduce((s, r) => s + r.rating, 0) / responses.length).toFixed(1)
    : '—';

  return (
    <ProtectedRoute>
      <Head><title>Client Feedback — QSToolkit</title></Head>
      <Layout title="⭐ Client Feedback">
        <div className="max-w-5xl space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Reviews', value: responses.length, icon: '⭐' },
              { label: 'Average Rating', value: `${avgRating}/10`, icon: '📊' },
              { label: 'Active Links', value: links.filter(l => l.is_active).length, icon: '🔗' }
            ].map(s => (
              <div key={s.label} className="stat-card">
                <span className="text-2xl">{s.icon}</span>
                <p className="stat-value">{loading ? '—' : s.value}</p>
                <p className="stat-label">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Create link */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">🔗 Feedback Links</h2>
              <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm">
                + Create Link
              </button>
            </div>

            {showCreate && (
              <form onSubmit={handleCreate} className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm">New Feedback Link</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Project <span className="text-red-500">*</span></label>
                    <select className="input text-sm" value={createForm.project_id} onChange={e => setCreateForm(f => ({ ...f, project_id: e.target.value }))} required>
                      <option value="">Select project…</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Client Name</label>
                    <input className="input text-sm" placeholder="Auto-filled from project" value={createForm.client_name} onChange={e => setCreateForm(f => ({ ...f, client_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Client Email (optional)</label>
                    <input type="email" className="input text-sm" placeholder="Send link automatically" value={createForm.client_email} onChange={e => setCreateForm(f => ({ ...f, client_email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Personal Message</label>
                    <input className="input text-sm" placeholder="Thank you for working with us…" value={createForm.message} onChange={e => setCreateForm(f => ({ ...f, message: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm flex-1">Cancel</button>
                  <button type="submit" className="btn-primary text-sm flex-1">Create & Copy Link</button>
                </div>
              </form>
            )}

            {links.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No feedback links yet. Create one to start collecting client reviews.</p>
            ) : (
              <div className="space-y-2">
                {links.map(link => {
                  const feedbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/feedback/${link.token}`;
                  return (
                    <div key={link.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{link.projects?.title}</p>
                        <p className="text-xs text-gray-400">
                          {link.client_name || 'Client'} · Created {formatDate(link.created_at)}
                          {link.feedback_responses?.length > 0 && ` · ${link.feedback_responses.length} response(s)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <span className={link.is_active ? 'badge-green' : 'badge-gray'}>
                          {link.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {link.is_active && (
                          <>
                            <button onClick={() => copyLink(feedbackUrl)} className="text-xs text-primary-600 hover:underline">Copy</button>
                            <button onClick={() => deactivate(link.id)} className="text-xs text-red-400 hover:text-red-600">Deactivate</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Received feedback */}
          <div className="card">
            <h2 className="section-title mb-4">💬 Received Reviews</h2>
            {responses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No reviews yet. Share your feedback links with clients to start collecting ratings.</p>
            ) : (
              <div className="space-y-3">
                {responses.map(r => (
                  <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{r.client_name || 'Anonymous Client'}</p>
                        <p className="text-xs text-gray-400">{r.projects?.title} · {formatDate(r.submitted_at)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-2xl font-bold text-gold-500">{r.rating}</span>
                        <span className="text-xs text-gray-400">/10</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {[
                        { label: 'Quality', val: r.quality_score },
                        { label: 'Timeliness', val: r.timeliness_score },
                        { label: 'Communication', val: r.communication_score }
                      ].map(s => (
                        <div key={s.label} className="text-center bg-gray-50 rounded-lg py-2">
                          <p className="text-sm font-bold text-primary-700">{s.val}/10</p>
                          <p className="text-xs text-gray-400">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    {r.comment && (
                      <p className="mt-3 text-sm text-gray-600 italic border-l-2 border-gold-300 pl-3">&quot;{r.comment}&quot;</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </Layout>
    </ProtectedRoute>
  );
}
