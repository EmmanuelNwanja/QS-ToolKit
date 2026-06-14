import { useState, useEffect } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { academyAPI } from '../../services/api';

const TABS = [
  { key: 'open', label: 'Open Contests' },
  { key: 'mine', label: 'My Contests' },
  { key: 'scheduled', label: 'Scheduled' },
];

const DIFFICULTY_COLORS = {
  easy: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-gold-100 text-gold-700',
  hard: 'bg-red-100 text-red-700',
};

const TYPE_COLORS = {
  duel: 'bg-purple-100 text-purple-700',
  group: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-cyan-100 text-cyan-700',
};

export default function ArenaPage() {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('open');
  const [tokens, setTokens] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [joining, setJoining] = useState(null);
  const [form, setForm] = useState({
    topic: '',
    question_count: 5,
    time_limit: 10,
    difficulty: 'medium',
    contest_type: 'duel',
    opponent: '',
    scheduled_at: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchContests = async () => {
    try {
      const res = await academyAPI.getContests({ tab });
      setContests(res.data.contests || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    setLoading(true);
    fetchContests();
  }, [tab]);

  useEffect(() => {
    academyAPI.getTokens().then((r) => setTokens(r.data)).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.topic.trim()) return toast.error('Enter a topic');
    setCreating(true);
    try {
      await academyAPI.createContest(form);
      toast.success('Contest created!');
      setShowCreate(false);
      setForm({ topic: '', question_count: 5, time_limit: 10, difficulty: 'medium', contest_type: 'duel', opponent: '', scheduled_at: '' });
      fetchContests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create contest');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (id) => {
    setJoining(id);
    try {
      await academyAPI.joinContest(id);
      toast.success('Joined contest!');
      fetchContests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to join');
    } finally {
      setJoining(null);
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>Arena — QS Academy</title></Head>
      <Layout title="⚔️ Knowledge Arena">
        <div className="max-w-6xl space-y-6">
          {/* Header with token balance */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-primary-800">Knowledge Arena</h2>
              <p className="text-sm text-gray-500 mt-1">Challenge yourself and earn tokens.</p>
            </div>
            <div className="flex items-center gap-3">
              {tokens && (
                <div className="bg-gold-50 border border-gold-200 rounded-xl px-4 py-2 flex items-center gap-2">
                  <span className="text-lg">🪙</span>
                  <span className="font-bold text-gold-700">{tokens.balance || 0}</span>
                  <span className="text-xs text-gold-600">tokens</span>
                </div>
              )}
              <button onClick={() => setShowCreate(true)} className="btn-primary px-5 py-2.5 text-sm">
                + Create Contest
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key ? 'bg-primary-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Contest list */}
          {loading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-5 bg-gray-100 rounded w-2/3 mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                  <div className="flex gap-2">
                    <div className="h-6 bg-gray-100 rounded-full w-16" />
                    <div className="h-6 bg-gray-100 rounded-full w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : contests.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">⚔️</p>
              <p className="font-medium">No contests available</p>
              <p className="text-sm mt-1">Create one or check back later.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {contests.map((c) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{c.topic}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {c.question_count} questions · {c.time_limit} min
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0 ml-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[c.difficulty] || ''}`}>
                        {c.difficulty}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[c.contest_type] || ''}`}>
                        {c.contest_type}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400">
                      {c.participants_count || 0} participant{(c.participants_count || 0) !== 1 ? 's' : ''}
                      {c.scheduled_at && (
                        <span> · {new Date(c.scheduled_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      )}
                    </div>
                    {c.status === 'open' && !c.joined && (
                      <button
                        onClick={() => handleJoin(c.id)}
                        disabled={joining === c.id}
                        className="bg-primary-700 hover:bg-primary-800 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
                      >
                        {joining === c.id ? 'Joining...' : 'Join'}
                      </button>
                    )}
                    {c.joined && (
                      <a href={`/academy/arena/${c.id}`} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                        Enter →
                      </a>
                    )}
                    {c.status === 'completed' && (
                      <span className="text-xs text-gray-400">Completed</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Create contest modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-primary-800">Create Contest</h2>
                  <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                </div>
                <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                  {/* Topic */}
                  <div>
                    <label className="label">Topic</label>
                    <input className="input" placeholder="e.g. BOQ Measurement Standards" value={form.topic} onChange={(e) => set('topic', e.target.value)} />
                  </div>

                  {/* Question count */}
                  <div>
                    <label className="label">Questions</label>
                    <div className="flex gap-2">
                      {[5, 10, 15].map((n) => (
                        <button key={n} type="button" onClick={() => set('question_count', n)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                            form.question_count === n ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time limit */}
                  <div>
                    <label className="label">Time Limit (minutes)</label>
                    <div className="flex gap-2">
                      {[5, 10, 15].map((n) => (
                        <button key={n} type="button" onClick={() => set('time_limit', n)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                            form.time_limit === n ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}>
                          {n} min
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <label className="label">Difficulty</label>
                    <div className="flex gap-2">
                      {['easy', 'medium', 'hard'].map((d) => (
                        <button key={d} type="button" onClick={() => set('difficulty', d)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 capitalize transition-all ${
                            form.difficulty === d ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Contest type */}
                  <div>
                    <label className="label">Type</label>
                    <div className="flex gap-2">
                      {['duel', 'group', 'scheduled'].map((t) => (
                        <button key={t} type="button" onClick={() => set('contest_type', t)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 capitalize transition-all ${
                            form.contest_type === t ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duel opponent */}
                  {form.contest_type === 'duel' && (
                    <div>
                      <label className="label">Opponent (username or email)</label>
                      <input className="input" placeholder="Enter username or email" value={form.opponent} onChange={(e) => set('opponent', e.target.value)} />
                    </div>
                  )}

                  {/* Scheduled date */}
                  {form.contest_type === 'scheduled' && (
                    <div>
                      <label className="label">Scheduled Date & Time</label>
                      <input type="datetime-local" className="input" value={form.scheduled_at} onChange={(e) => set('scheduled_at', e.target.value)} />
                    </div>
                  )}

                  <button type="submit" disabled={creating} className="btn-primary w-full py-2.5 text-sm">
                    {creating ? 'Creating...' : 'Create Contest'}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Layout>
    </ProtectedRoute>
  );
}
