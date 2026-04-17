import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { boqAPI, projectAPI } from '../../services/api';

export default function NewBoqPage() {
  const router = useRouter();
  const { project_id } = router.query;

  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    title: '',
    project_id: '',
    notes: '',
    status: 'draft',
    measurement_standard: ''
  });

  useEffect(() => {
    projectAPI.list({ limit: 100 })
      .then(({ data }) => setProjects(data.projects || []))
      .catch(() => toast.error('Could not load projects'));
  }, []);

  useEffect(() => {
    if (!project_id) return;
    setForm((f) => ({ ...f, project_id: String(project_id) }));
  }, [project_id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await boqAPI.create(form);
      toast.success('BOQ created successfully');
      if (form.project_id) {
        router.push(`/projects/${form.project_id}`);
      } else {
        router.push('/projects');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create BOQ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>New BOQ - QSToolkit</title></Head>
      <Layout title="New BOQ">
        <div className="max-w-2xl">
          <form onSubmit={handleSubmit} className="card space-y-5">
            <h2 className="section-title">Create Bill of Quantities</h2>

            <div>
              <label className="label">BOQ Title <span className="text-red-500">*</span></label>
              <input
                className="input"
                placeholder="e.g. Structural Works BOQ"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Project <span className="text-red-500">*</span></label>
              <select
                className="input"
                value={form.project_id}
                onChange={(e) => set('project_id', e.target.value)}
                required
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                rows={3}
                className="input"
                placeholder="Optional summary of this BOQ"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </div>

            <div>
              <label className="label">Measurement Standard <span className="text-red-500">*</span></label>
              <select
                className="input"
                value={form.measurement_standard}
                onChange={(e) => set('measurement_standard', e.target.value)}
                required
              >
                <option value="">Select standard...</option>
                <option value="SMM7">SMM7</option>
                <option value="NRM2">NRM2</option>
              </select>
            </div>

            <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="final">Final</option>
                  <option value="submitted">Submitted</option>
                </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? 'Creating...' : 'Create BOQ'}
              </button>
            </div>
          </form>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
