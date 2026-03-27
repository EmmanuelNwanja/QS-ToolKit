import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { projectAPI, feedbackAPI } from '../../../services/api';
import { formatNaira, formatDate, statusBadge } from '../../../utils/helpers';

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [milestoneForm, setMilestoneForm] = useState({ title: '', due_date: '', note: '' });
  const [savingMilestone, setSavingMilestone] = useState(false);

  useEffect(() => {
    if (!id) return;
    projectAPI.get(id)
      .then(r => setProject(r.data.project))
      .catch(() => toast.error('Project not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const reloadProject = async () => {
    if (!id) return;
    const { data } = await projectAPI.get(id);
    setProject(data.project);
  };

  const createFeedbackLink = async () => {
    try {
      const { data } = await feedbackAPI.createLink({
        project_id: id,
        client_name: project?.client_name,
        client_email: project?.client_email
      });
      await navigator.clipboard.writeText(data.link.feedback_url);
      toast.success('Feedback link copied to clipboard!');
    } catch { toast.error('Could not create feedback link'); }
  };

  const createMilestone = async (e) => {
    e.preventDefault();
    if (!milestoneForm.title.trim()) {
      toast.error('Milestone title is required');
      return;
    }

    setSavingMilestone(true);
    try {
      await projectAPI.createMilestone(id, {
        title: milestoneForm.title,
        due_date: milestoneForm.due_date || null,
        note: milestoneForm.note || null
      });
      setMilestoneForm({ title: '', due_date: '', note: '' });
      await reloadProject();
      toast.success('Milestone added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add milestone');
    } finally {
      setSavingMilestone(false);
    }
  };

  const updateMilestoneStatus = async (milestoneId, status) => {
    try {
      await projectAPI.updateMilestone(id, milestoneId, { status });
      await reloadProject();
      toast.success('Milestone updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update milestone');
    }
  };

  const deleteMilestone = async (milestoneId) => {
    try {
      await projectAPI.removeMilestone(id, milestoneId);
      await reloadProject();
      toast.success('Milestone removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove milestone');
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="animate-pulse space-y-4 max-w-5xl">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl" />)}
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!project) return null;

  return (
    <ProtectedRoute>
      <Head><title>{project.title} — QSToolkit</title></Head>
      <Layout title={project.title}>
        <div className="max-w-5xl space-y-6">

          {/* Header card */}
          <div className="card">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h1 className="page-title">{project.title}</h1>
                  <span className={statusBadge(project.status)}>{project.status}</span>
                  {project.is_verified && <span className="badge badge-green">✓ Verified</span>}
                </div>
                <p className="text-gray-500 text-sm">
                  {project.project_type || 'Project'} · {project.state || project.location || '—'}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={createFeedbackLink} className="btn-secondary text-sm">
                  ⭐ Feedback Link
                </button>
                <Link href={`/projects/${id}/edit`} className="btn-primary text-sm">
                  ✏️ Edit
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
              {[
                { label: 'Client', value: project.client_name || '—' },
                { label: 'Estimated Value', value: formatNaira(project.estimated_value) },
                { label: 'Final Value', value: formatNaira(project.final_value) },
                { label: 'Start Date', value: formatDate(project.start_date) }
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">{f.label}</p>
                  <p className="font-semibold text-gray-900 text-sm">{f.value}</p>
                </div>
              ))}
            </div>

            {project.description && (
              <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{project.description}</p>
            )}
          </div>

          {/* Related docs */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* BOQs */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-primary-800 text-base">📋 BOQs</h3>
                <Link href={`/boq/new?project_id=${id}`} className="text-xs text-primary-600 hover:underline">+ New</Link>
              </div>
              {project.boq_documents?.length > 0 ? (
                <div className="space-y-2">
                  {project.boq_documents.map(b => (
                    <Link key={b.id} href={`/boq/${b.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-primary-50 text-sm group">
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-primary-700">{b.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{b.status}</p>
                      </div>
                      <span className="text-xs font-semibold text-primary-700">{formatNaira(b.total_amount)}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-400 mb-2">No BOQs yet</p>
                  <Link href={`/boq/new?project_id=${id}`} className="btn-secondary text-xs w-full text-center">Create BOQ</Link>
                </div>
              )}
            </div>

            {/* Invoices */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-primary-800 text-base">🧾 Invoices</h3>
                <Link href={`/invoices/new?project_id=${id}`} className="text-xs text-primary-600 hover:underline">+ New</Link>
              </div>
              {project.invoices?.length > 0 ? (
                <div className="space-y-2">
                  {project.invoices.map(inv => (
                    <Link key={inv.id} href={`/invoices/${inv.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-primary-50 text-sm group">
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-primary-700 capitalize">{inv.invoice_type}</p>
                        <span className={`text-xs ${statusBadge(inv.status)}`}>{inv.status}</span>
                      </div>
                      <span className="text-xs font-semibold text-primary-700">{formatNaira(inv.total_amount)}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-400 mb-2">No invoices yet</p>
                  <Link href={`/invoices/new?project_id=${id}`} className="btn-secondary text-xs w-full text-center">Create Invoice</Link>
                </div>
              )}
            </div>

            {/* Feedback */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-primary-800 text-base">⭐ Feedback</h3>
              </div>
              {project.feedback_links?.length > 0 ? (
                <div className="space-y-2">
                  {project.feedback_links.map(fl => (
                    <div key={fl.id} className="p-2.5 rounded-lg bg-gray-50 text-xs flex items-center justify-between">
                      <span>Feedback link</span>
                      <span className={fl.is_active ? 'badge-green' : 'badge-gray'}>{fl.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  ))}
                  <button onClick={createFeedbackLink} className="btn-secondary text-xs w-full mt-2">+ New Link</button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-400 mb-2">Share a feedback link with your client</p>
                  <button onClick={createFeedbackLink} className="btn-secondary text-xs w-full">Create Feedback Link</button>
                </div>
              )}
            </div>
          </div>

          {/* Milestones */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-primary-800 text-base">🎯 Milestones</h3>
              <span className="text-xs text-gray-500">Track progress with notes</span>
            </div>

            <form onSubmit={createMilestone} className="grid md:grid-cols-12 gap-2 mb-4">
              <input
                className="input md:col-span-4"
                placeholder="Milestone title"
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm((m) => ({ ...m, title: e.target.value }))}
              />
              <input
                type="date"
                className="input md:col-span-2"
                value={milestoneForm.due_date}
                onChange={(e) => setMilestoneForm((m) => ({ ...m, due_date: e.target.value }))}
              />
              <input
                className="input md:col-span-4"
                placeholder="Side note (optional)"
                value={milestoneForm.note}
                onChange={(e) => setMilestoneForm((m) => ({ ...m, note: e.target.value }))}
              />
              <button type="submit" className="btn-primary md:col-span-2" disabled={savingMilestone}>
                {savingMilestone ? 'Saving...' : 'Add'}
              </button>
            </form>

            {(project.project_milestones || []).length === 0 ? (
              <p className="text-sm text-gray-500">No milestones yet. Add one to start tracking project progress.</p>
            ) : (
              <div className="space-y-2">
                {(project.project_milestones || [])
                  .slice()
                  .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                  .map((m) => (
                    <div key={m.id} className="border border-gray-100 rounded-lg p-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{m.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Due: {m.due_date ? formatDate(m.due_date) : 'Not set'}</p>
                        {m.note && <p className="text-xs text-gray-600 mt-1">📝 {m.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="input py-1.5 text-xs"
                          value={m.status}
                          onChange={(e) => updateMilestoneStatus(m.id, e.target.value)}
                        >
                          <option value="planned">Planned</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                        <button type="button" onClick={() => deleteMilestone(m.id)} className="btn-secondary text-xs">Remove</button>
                      </div>
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
