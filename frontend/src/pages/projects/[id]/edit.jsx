import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { projectAPI } from '../../../services/api';
import { NIGERIAN_STATES, PROJECT_TYPES } from '../../../utils/helpers';

export default function EditProjectPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [form, setForm] = useState({
    title: '', client_name: '', client_email: '', project_type: '',
    location: '', state: '', description: '',
    start_date: '', end_date: '', estimated_value: '', status: 'active'
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!id) return;

    projectAPI.get(id)
      .then(({ data }) => {
        const p = data.project;
        setForm({
          title: p.title || '',
          client_name: p.client_name || '',
          client_email: p.client_email || '',
          project_type: p.project_type || '',
          location: p.location || '',
          state: p.state || '',
          description: p.description || '',
          start_date: p.start_date ? String(p.start_date).slice(0, 10) : '',
          end_date: p.end_date ? String(p.end_date).slice(0, 10) : '',
          estimated_value: p.estimated_value ?? '',
          status: p.status || 'active'
        });
      })
      .catch(() => {
        toast.error('Project not found');
        router.push('/projects');
      })
      .finally(() => setBooting(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await projectAPI.update(id, form);
      toast.success('Project updated');
      router.push(`/projects/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update project');
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <ProtectedRoute>
        <Layout title="Edit Project">
          <div className="max-w-2xl animate-pulse">
            <div className="h-40 rounded-xl bg-gray-100" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Head><title>Edit Project - QSToolkit</title></Head>
      <Layout title="Edit Project">
        <div className="max-w-2xl">
          <form onSubmit={handleSubmit} className="card space-y-5">
            <h2 className="section-title">Update Project Details</h2>

            <div>
              <label className="label">Project Title <span className="text-red-500">*</span></label>
              <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} required />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Client Name</label>
                <input className="input" value={form.client_name} onChange={(e) => set('client_name', e.target.value)} />
              </div>
              <div>
                <label className="label">Client Email</label>
                <input type="email" className="input" value={form.client_email} onChange={(e) => set('client_email', e.target.value)} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Project Type</label>
                <select className="input" value={form.project_type} onChange={(e) => set('project_type', e.target.value)}>
                  <option value="">Select type...</option>
                  {PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">State</label>
                <select className="input" value={form.state} onChange={(e) => set('state', e.target.value)}>
                  <option value="">Select state...</option>
                  {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Site Location / Address</label>
              <input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} />
            </div>

            <div>
              <label className="label">Project Description</label>
              <textarea className="input" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input type="date" className="input" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" className="input" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
              </div>
              <div>
                <label className="label">Estimated Value (NGN)</label>
                <input type="number" className="input" value={form.estimated_value} onChange={(e) => set('estimated_value', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => router.push(`/projects/${id}`)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
