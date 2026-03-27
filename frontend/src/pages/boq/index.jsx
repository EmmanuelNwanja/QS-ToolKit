import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { boqAPI } from '../../services/api';
import { formatNaira, formatDate, statusBadge } from '../../utils/helpers';

export default function BoqListPage() {
  const [boqs, setBoqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    boqAPI.list()
      .then((r) => setBoqs(r.data.boqs || []))
      .catch(() => toast.error('Could not load BOQs'))
      .finally(() => setLoading(false));
  }, []);

  const STATUS_FILTERS = ['all', 'draft', 'final', 'approved'];

  const filtered = filter === 'all'
    ? boqs
    : boqs.filter((b) => b.status === filter);

  return (
    <ProtectedRoute>
      <Head><title>Bill of Quantities — QSToolkit</title></Head>
      <Layout title="📋 Bill of Quantities">
        <div className="max-w-5xl space-y-5">

          {/* Actions bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                    filter === s
                      ? 'bg-primary-700 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {s === 'all' ? `All (${boqs.length})` : s}
                </button>
              ))}
            </div>
            <Link href="/boq/new" className="btn-primary text-sm">
              + New BOQ
            </Link>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card h-20 animate-pulse bg-gray-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card text-center py-14">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-500 text-sm mb-4">
                {filter === 'all' ? 'No BOQs yet. Create your first one.' : `No ${filter} BOQs.`}
              </p>
              {filter === 'all' && (
                <Link href="/boq/new" className="btn-primary text-sm">
                  Create First BOQ
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((boq) => (
                <Link
                  key={boq.id}
                  href={`/boq/${boq.id}`}
                  className="card flex items-start justify-between gap-4 hover:border-primary-200 hover:shadow-md transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 truncate">
                        {boq.title}
                      </h3>
                      <span className={statusBadge(boq.status)}>{boq.status}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {boq.projects?.title
                        ? `Project: ${boq.projects.title} · `
                        : ''}
                      Created {formatDate(boq.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary-700 text-sm">
                      {formatNaira(boq.total_amount)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {boq.boq_sections?.length ?? 0} section{boq.boq_sections?.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            BOQs support both priced and unpriced items · Leave rate blank for unpriced lines
          </p>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
