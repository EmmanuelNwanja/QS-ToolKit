import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { examAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const cardAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function UniversityPage() {
  const router = useRouter();
  const { universityId } = router.query;
  const [university, setUniversity] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modeModal, setModeModal] = useState(null);
  const [courseSearch, setCourseSearch] = useState('');

  useEffect(() => {
    if (!universityId) return;
    async function load() {
      try {
        const res = await examAPI.getUniversityCourses(universityId);
        setUniversity(res.data.university);
        setCourses(res.data.courses || []);
      } catch {
        toast.error('Failed to load university data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [universityId]);

  return (
    <ProtectedRoute>
      <Head><title>{university?.name || 'University'} — QSToolkit</title></Head>
      <Layout title={university?.name || 'Loading...'}>
        <div className="max-w-4xl space-y-6">

          <Link href="/exam-prep/students" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
            &larr; Back to Student Exams
          </Link>

          {loading ? (
            <div className="card space-y-4">
              <div className="h-8 bg-gray-100 rounded w-2/3 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !university ? (
            <div className="card text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm">University not found</p>
            </div>
          ) : (
            <>
              {/* University header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🏛️</span>
                  </div>
                  <div>
                    <h1 className="font-display text-2xl font-bold text-primary-800">{university.name}</h1>
                    <p className="text-sm text-gray-500">{university.location || 'Nigeria'} · {courses.length} available courses</p>
                  </div>
                </div>
              </motion.div>

              {/* Course search */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Search courses by name or code..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Courses list */}
              {courses.length === 0 ? (
                <div className="card text-center py-10 text-gray-400">
                  <p className="text-3xl mb-2">📚</p>
                  <p className="text-sm">No courses available yet</p>
                </div>
              ) : (() => {
                const filtered = courseSearch.trim()
                  ? courses.filter(c =>
                      c.name?.toLowerCase().includes(courseSearch.toLowerCase()) ||
                      c.code?.toLowerCase().includes(courseSearch.toLowerCase())
                    )
                  : courses;

                if (filtered.length === 0) {
                  return (
                    <div className="card text-center py-10 text-gray-400">
                      <p className="text-3xl mb-2">🔍</p>
                      <p className="text-sm">No courses match &ldquo;{courseSearch}&rdquo;</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {filtered.map((course, i) => (
                    <motion.div
                      key={course.id}
                      variants={cardAnim}
                      initial="hidden"
                      animate="show"
                      transition={{ delay: i * 0.05 }}
                      className="card hover:shadow-card-md hover:border-primary-200 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono bg-primary-50 text-primary-700 px-2 py-0.5 rounded">
                              {course.code}
                            </span>
                            <span className="badge badge-gray text-xs">{course.question_count || 0} questions</span>
                          </div>
                          <h3 className="font-semibold text-sm text-gray-900 group-hover:text-primary-700 truncate">
                            {course.title}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            Available years: {course.years?.join(', ') || 'Multiple years'}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => setModeModal(course)}
                            className="btn-primary text-xs px-3 py-1.5"
                          >
                            Start Exam
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                );
              })()}
            </>
          )}

          {/* Mode selection modal */}
          <AnimatePresence>
            {modeModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                onClick={() => setModeModal(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="font-display text-lg font-bold text-primary-800 mb-1">Select Mode</h3>
                  <p className="text-sm text-gray-500 mb-5">{modeModal.code} — {modeModal.title}</p>

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        router.push(`/exam-prep/students/${universityId}/${modeModal.id}?mode=timed`);
                        setModeModal(null);
                      }}
                      className="w-full p-4 rounded-xl border-2 border-primary-200 hover:border-primary-500 hover:bg-primary-50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">⏱️</span>
                        <div>
                          <p className="font-semibold text-sm text-primary-800 group-hover:text-primary-700">Timed Exam</p>
                          <p className="text-xs text-gray-500">Simulates real exam conditions with a countdown timer.</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        router.push(`/exam-prep/students/${universityId}/${modeModal.id}?mode=untimed`);
                        setModeModal(null);
                      }}
                      className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-primary-300 hover:bg-gray-50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📖</span>
                        <div>
                          <p className="font-semibold text-sm text-gray-800 group-hover:text-primary-700">Untimed Practice</p>
                          <p className="text-xs text-gray-500">Take your time. View explanations as you go.</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <button
                    onClick={() => setModeModal(null)}
                    className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 text-center"
                  >
                    Cancel
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
