import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { leaderboardAPI } from '../../services/api';
import { formatNaira } from '../../utils/helpers';

export default function LeaderboardPage() {
  const [data, setData]     = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [sort, setSort]     = useState('rank_by_projects');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      leaderboardAPI.get({ sort, limit: 50 }),
      leaderboardAPI.getMe()
    ]).then(([lb, me]) => {
      if (lb.status === 'fulfilled') setData(lb.value.data.leaderboard || []);
      if (me.status === 'fulfilled') setMyRank(me.value.data.rank);
    }).finally(() => setLoading(false));
  }, [sort]);

  const SORT_OPTIONS = [
    { value: 'rank_by_projects', label: '📁 By Projects' },
    { value: 'rank_by_rating',   label: '⭐ By Rating' }
  ];

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <ProtectedRoute>
      <Head><title>Leaderboard — QSToolkit</title></Head>
      <Layout title="🏆 Leaderboard">
        <div className="max-w-5xl space-y-6">

          {/* My rank card */}
          {myRank && (
            <div className="bg-gradient-to-r from-primary-800 to-primary-700 rounded-2xl p-5 text-white flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-primary-300 text-xs uppercase tracking-wide mb-1">Your Position</p>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold font-display text-gold-400">#{sort === 'rank_by_rating' ? myRank.rank_by_rating : myRank.rank_by_projects}</span>
                  <div>
                    <p className="font-semibold">{myRank.name}</p>
                    <p className="text-primary-300 text-sm">{myRank.company_name || 'QSToolkit Professional'}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { label: 'Projects', value: myRank.total_projects },
                  { label: 'Avg Rating', value: `${myRank.avg_rating}/10` },
                  { label: 'Reviews', value: myRank.total_reviews }
                ].map(s => (
                  <div key={s.label}>
                    <p className="text-xl font-bold text-gold-400">{s.value}</p>
                    <p className="text-xs text-primary-300">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sort tabs */}
          <div className="flex items-center gap-2">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sort === opt.value
                    ? 'bg-primary-700 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-16">Rank</th>
                  <th>Name / Company</th>
                  <th>Projects</th>
                  <th>Total Value</th>
                  <th>Avg Rating</th>
                  <th>Quality</th>
                  <th>Timeliness</th>
                  <th>Reviews</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400">
                      No data yet. Complete projects and collect client feedback to appear here!
                    </td>
                  </tr>
                ) : data.map((entry) => {
                  const rank = sort === 'rank_by_rating' ? entry.rank_by_rating : entry.rank_by_projects;
                  const isMe = myRank?.user_id === entry.user_id;
                  return (
                    <tr key={entry.user_id} className={isMe ? 'bg-gold-50 font-medium' : ''}>
                      <td>
                        <span className={`font-bold text-base ${rank <= 3 ? 'text-2xl' : 'text-gray-700'}`}>
                          {getRankIcon(rank)}
                        </span>
                      </td>
                      <td>
                        <p className="font-semibold text-gray-900">{entry.name}</p>
                        <p className="text-xs text-gray-400">{entry.company_name || entry.user_type}</p>
                      </td>
                      <td className="font-medium">{entry.total_projects}</td>
                      <td className="font-medium text-primary-700">{formatNaira(entry.total_project_value)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-gold-600">{entry.avg_rating}</span>
                          <span className="text-gray-400 text-xs">/10</span>
                        </div>
                      </td>
                      <td className="text-gray-600">{entry.avg_quality}</td>
                      <td className="text-gray-600">{entry.avg_timeliness}</td>
                      <td className="text-gray-500">{entry.total_reviews}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Leaderboard refreshes daily · Only completed projects and verified feedback count
          </p>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
