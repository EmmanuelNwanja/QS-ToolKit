import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { examAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const cardAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function StudentExamsPage() {
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await examAPI.getUniversities();
        setUniversities(res.data.universities || []);
      } catch {
        toast.error('Failed to load universities');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) {
      const res = await examAPI.getUniversities();
      setUniversities(res.data.universities || []);
      return;
    }
    setSearching(true);
    try {
      const res = await examAPI.getUniversities({ search: search.trim() });
      setUniversities(res.data.universities || []);
      // Log search for analytics
      examAPI.logSearch({ query: search.trim(), type: 'universities', results_count: (res.data.universities || []).length }).catch(() => {});
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>Student Exams — QSToolkit</title></Head>
      <Layout title="🎓 Student Exams">
        <div className="max-w-5xl space-y-8">

          <Link href="/exam-prep" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
            &larr; Back to Exam Prep
          </Link>

          {/* University Past Questions */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="section-title">University Past Questions</h2>
              <div className="h-px flex-1 bg-gray-100" />
              <span className="text-xs text-gray-400">{universities.length} universities</span>
            </div>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="mb-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search universities by name..."
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="btn-primary px-4 py-2.5 text-sm"
                >
                  {searching ? '...' : 'Search'}
                </button>
                {search && (
                  <button
                    type="button"
                    onClick={async () => { setSearch(''); const res = await examAPI.getUniversities(); setUniversities(res.data.universities || []); }}
                    className="btn-secondary px-4 py-2.5 text-sm"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>

            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="card animate-pulse">
                    <div className="h-6 bg-gray-100 rounded w-3/4 mb-3" />
                    <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : universities.length === 0 ? (
              <div className="card text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">🎓</p>
                <p className="text-sm">No university data available yet</p>
                <p className="text-xs mt-1">Past questions are being added regularly.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {universities.map((uni, i) => (
                  <motion.div
                    key={uni.id}
                    variants={cardAnim}
                    initial="hidden"
                    animate="show"
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      href={`/exam-prep/students/${uni.id}`}
                      className="card hover:shadow-card-md hover:border-primary-200 transition-all group block"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">🏛️</span>
                        </div>
                        <span className="badge badge-blue text-xs">{uni.course_count || 0} courses</span>
                      </div>
                      <h3 className="font-display font-bold text-primary-800 group-hover:text-primary-600 text-sm leading-tight mb-1">
                        {uni.name}
                      </h3>
                      <p className="text-xs text-gray-500">{uni.location || 'Nigeria'}</p>
                      <div className="mt-3 text-xs font-semibold text-primary-600 group-hover:text-primary-700 flex items-center gap-1">
                        Browse Courses <span>&rarr;</span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Mock Exams */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="section-title">Mock Exams</h2>
              <div className="h-px flex-1 bg-gray-100" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <motion.div variants={cardAnim} initial="hidden" animate="show" transition={{ delay: 0.1 }}>
                <Link href="/exam-prep/professional" className="card hover:shadow-card-md hover:border-primary-200 transition-all group block">
                  <div className="text-2xl mb-3">🇳🇬</div>
                  <h3 className="font-display font-bold text-primary-800 group-hover:text-primary-600 text-sm mb-1">
                    Nigerian Professional Exam Mocks
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Practice with mock versions of NIQS and QSRBN exams. Simulated exam conditions with timed sections.
                  </p>
                  <div className="mt-3 text-xs font-semibold text-primary-600 group-hover:text-primary-700 flex items-center gap-1">
                    View Mocks <span>&rarr;</span>
                  </div>
                </Link>
              </motion.div>

              <motion.div variants={cardAnim} initial="hidden" animate="show" transition={{ delay: 0.2 }}>
                <Link href="/exam-prep/professional" className="card hover:shadow-card-md hover:border-primary-200 transition-all group block">
                  <div className="text-2xl mb-3">🌍</div>
                  <h3 className="font-display font-bold text-primary-800 group-hover:text-primary-600 text-sm mb-1">
                    International Exam Mocks
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Prepare for RICS APC, CIOB, PMP, and PRINCE2 with realistic mock exams and practice questions.
                  </p>
                  <div className="mt-3 text-xs font-semibold text-primary-600 group-hover:text-primary-700 flex items-center gap-1">
                    View Mocks <span>&rarr;</span>
                  </div>
                </Link>
              </motion.div>
            </div>
          </div>

          {/* Info */}
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
            <strong>📚 Note:</strong> Past questions are sourced from publicly available university exam archives. Always verify with your institution&apos;s official materials.
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
