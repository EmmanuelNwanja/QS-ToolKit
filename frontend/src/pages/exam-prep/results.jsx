import { useEffect, useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { examAPI } from '../../services/api';
import ExamResults from '../../components/exam-prep/ExamResults';
import toast from 'react-hot-toast';
import { formatDate } from '../../utils/helpers';

const FILTERS = [
  { id: 'all', label: 'All Exams' },
  { id: 'nigerian', label: '🇳🇬 Nigerian Professional' },
  { id: 'international', label: '🌍 International' },
  { id: 'university', label: '🎓 University' }
];

export default function ResultsPage() {
  const router = useRouter();
  const { attempt: attemptQuery } = router.query;
  const [attempts, setAttempts] = useState([]);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await examAPI.getAttempts();
        setAttempts(res.data.attempts || []);
      } catch {
        toast.error('Failed to load results');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (attemptQuery) {
      loadAttempt(attemptQuery);
    }
  }, [attemptQuery]);

  const loadAttempt = async (id) => {
    setDetailLoading(true);
    try {
      const res = await examAPI.getAttempt(id);
      setSelectedAttempt(res.data.attempt || res.data);
    } catch {
      toast.error('Failed to load attempt details');
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return attempts;
    return attempts.filter(a => {
      if (filter === 'nigerian') return a.category === 'nigerian' || a.exam_type === 'professional_nigerian';
      if (filter === 'international') return a.category === 'international' || a.exam_type === 'professional_international';
      if (filter === 'university') return a.category === 'university' || a.exam_type === 'university';
      return true;
    });
  }, [attempts, filter]);

  // Score trend data
  const trendData = useMemo(() => {
    return [...attempts]
      .sort((a, b) => new Date(a.completed_at || a.created_at) - new Date(b.completed_at || b.created_at))
      .slice(-10)
      .map((a, i) => ({
        name: `#${i + 1}`,
        score: a.score || 0,
        pass: a.passed ? 1 : 0
      }));
  }, [attempts]);

  // Weakness areas
  const weaknessAreas = useMemo(() => {
    const topicScores = {};
    attempts.forEach(a => {
      (a.weak_topics || []).forEach(t => {
        if (!topicScores[t]) topicScores[t] = { topic: t, count: 0 };
        topicScores[t].count++;
      });
    });
    return Object.values(topicScores)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [attempts]);

  // Detailed view
  if (selectedAttempt || detailLoading) {
    return (
      <ProtectedRoute>
        <Head><title>Exam Results — QSToolkit</title></Head>
        <Layout title="📊 Exam Results">
          <div className="max-w-4xl space-y-6">
            <button
              onClick={() => { setSelectedAttempt(null); router.replace('/exam-prep/results'); }}
              className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1"
            >
              &larr; Back to Results
            </button>
            {detailLoading ? (
              <div className="card space-y-4">
                <div className="h-8 bg-gray-100 rounded w-1/2 animate-pulse" />
                <div className="h-40 bg-gray-100 rounded animate-pulse" />
              </div>
            ) : (
              <ExamResults attempt={selectedAttempt} onBack={() => { setSelectedAttempt(null); router.replace('/exam-prep/results'); }} />
            )}
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Head><title>My Results — QSToolkit</title></Head>
      <Layout title="📊 My Results">
        <div className="max-w-5xl space-y-6">

          <Link href="/exam-prep" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
            &larr; Back to Exam Prep
          </Link>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === f.id
                    ? 'bg-primary-700 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Charts row */}
          {attempts.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Score trend */}
              <div className="card">
                <h3 className="font-display font-bold text-primary-800 text-sm mb-4">Score Trend</h3>
                {trendData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="#1a3c5e" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-8">Complete more exams to see your trend</p>
                )}
              </div>

              {/* Weakness areas */}
              <div className="card">
                <h3 className="font-display font-bold text-primary-800 text-sm mb-4">Weakness Areas</h3>
                {weaknessAreas.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weaknessAreas} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="topic" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#dc2626" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-8">No weakness data yet</p>
                )}
              </div>
            </div>
          )}

          {/* Results table */}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam Name</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Time Taken</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400">
                      <p className="text-3xl mb-2">📝</p>
                      <p className="text-sm">No results found</p>
                      <Link href="/exam-prep/professional" className="btn-primary text-sm mt-3 inline-flex">Take an Exam</Link>
                    </td>
                  </tr>
                ) : filtered.map(a => (
                  <tr key={a.id} className="cursor-pointer" onClick={() => loadAttempt(a.id)}>
                    <td>
                      <p className="font-medium text-gray-900">{a.exam_name || 'Exam'}</p>
                      <p className="text-xs text-gray-500">{a.exam_body || ''}</p>
                    </td>
                    <td className="text-gray-500">{formatDate(a.completed_at || a.created_at)}</td>
                    <td>
                      <span className={`font-bold ${a.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                        {a.score}%
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${a.passed ? 'badge-green' : 'badge-red'}`}>
                        {a.passed ? 'Pass' : 'Fail'}
                      </span>
                    </td>
                    <td className="text-gray-500">{a.time_taken ? `${a.time_taken} min` : '—'}</td>
                    <td>
                      <button className="text-xs text-primary-600 hover:underline">View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {attempts.length > 0 && (
            <p className="text-xs text-gray-400 text-center">
              Showing {filtered.length} of {attempts.length} total attempts
            </p>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
