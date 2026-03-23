// projects/index.jsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { projectAPI } from '../../services/api';
import { formatNaira, formatDate, statusBadge, NIGERIAN_STATES, PROJECT_TYPES } from '../../utils/helpers';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('');

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    try {
      const { data } = await projectAPI.list({ limit: 100 });
      setProjects(data.projects || []);
    } catch { toast.error('Could not load projects'); }
    finally { setLoading(false); }
  };

  const filtered = projects.filter(p =>
    !filter || p.title?.toLowerCase().includes(filter.toLowerCase()) || p.client_name?.toLowerCase().includes(filter.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await projectAPI.remove(id);
      setProjects(p => p.filter(pr => pr.id !== id));
      toast.success('Project deleted');
    } catch { toast.error('Could not delete project'); }
  };

  return (
    <ProtectedRoute>
      <Head><title>Projects — QSToolkit</title></Head>
      <Layout title="Projects">
        <div className="max-w-6xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input className="input max-w-xs" placeholder="🔍 Search projects…" value={filter} onChange={e => setFilter(e.target.value)} />
            <Link href="/projects/new" className="btn-primary">+ New Project</Link>
          </div>

          {loading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white rounded-xl border animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="card text-center py-16">
              <p className="text-4xl mb-3">📁</p>
              <p className="text-gray-500 font-medium">{filter ? 'No projects match your search' : 'No projects yet'}</p>
              <Link href="/projects/new" className="btn-primary mt-4 inline-flex">Add Your First Project</Link>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project Title</th>
                    <th>Client</th>
                    <th>Location</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/projects/${p.id}`} className="font-semibold text-primary-700 hover:underline">{p.title}</Link>
                        <p className="text-xs text-gray-400">{p.project_type || '—'}</p>
                      </td>
                      <td>{p.client_name || '—'}</td>
                      <td>{p.state || p.location || '—'}</td>
                      <td className="font-medium">{formatNaira(p.final_value || p.estimated_value)}</td>
                      <td><span className={statusBadge(p.status)}>{p.status}</span></td>
                      <td className="text-gray-400 text-xs">{formatDate(p.created_at)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link href={`/projects/${p.id}`} className="text-xs text-primary-600 hover:underline">View</Link>
                          <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
