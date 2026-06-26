import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { examAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const DIFFICULTY_COLORS = {
  'All Levels': 'badge-gray',
  'Intermediate': 'badge-blue',
  'Advanced': 'badge-amber',
  'Expert': 'badge-red'
};

const cardAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

function ExamCard({ exam, index, hasSub, hasFreeTrial }) {
  const canStart = hasSub || hasFreeTrial;
  const slug = exam.slug || exam.exam_name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <motion.div
      variants={cardAnim}
      initial="hidden"
      animate="show"
      transition={{ delay: index * 0.05 }}
    >
      <Link
        href={canStart ? `/exam-prep/professional/${slug}` : '/subscription'}
        className="card hover:shadow-card-md hover:border-primary-200 transition-all group block"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{exam.body || exam.category}</p>
            <h3 className="font-display font-bold text-primary-800 group-hover:text-primary-600 text-sm leading-tight">
              {exam.exam_name}
            </h3>
          </div>
          <span className={`badge ${DIFFICULTY_COLORS[exam.difficulty] || 'badge-gray'} flex-shrink-0`}>
            {exam.difficulty || 'Intermediate'}
          </span>
        </div>

        <div className="space-y-2 mb-4">
          {exam.format && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-4 text-center">📝</span>
              <span>{exam.format}</span>
            </div>
          )}
          {exam.time_limit_minutes && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-4 text-center">⏱️</span>
              <span>{exam.time_limit_minutes} min</span>
            </div>
          )}
          {exam.passing_score > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-4 text-center">🎯</span>
              <span>Pass mark: {exam.passing_score}%</span>
            </div>
          )}
          {exam.total_questions > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-4 text-center">❓</span>
              <span>{exam.total_questions} questions</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          {hasSub ? (
            <span className="btn-primary text-xs px-3 py-1.5">Start Exam</span>
          ) : hasFreeTrial ? (
            <span className="btn-gold text-xs px-3 py-1.5">Start Free Trial</span>
          ) : (
            <Link href="/subscription" className="btn-secondary text-xs px-3 py-1.5">Subscribe to Access</Link>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export default function ProfessionalExamsPage() {
  const [activeTab, setActiveTab] = useState('nigerian');
  const [status, setStatus] = useState(null);
  const [dbExams, setDbExams] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [statusRes, examsRes] = await Promise.allSettled([
          examAPI.getStatus(),
          examAPI.getExams({ category: activeTab === 'nigerian' ? 'nigerian_professional' : 'international' })
        ]);
        if (statusRes.status === 'fulfilled') setStatus(statusRes.value.data);
        if (examsRes.status === 'fulfilled') setDbExams(examsRes.value.data?.exams || []);
      } catch {
        toast.error('Failed to load exam status');
      }
    }
    load();
  }, [activeTab]);

  const hasSub = status?.active === true || status?.subscription_status === 'active';
  const hasFreeTrial = status?.free_trial_available === true;

  return (
    <ProtectedRoute>
      <Head><title>Professional Exams — QSToolkit</title></Head>
      <Layout title="🏗️ Professional Exams">
        <div className="max-w-5xl space-y-6">

          {/* Back link */}
          <Link href="/exam-prep" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
            &larr; Back to Exam Prep
          </Link>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 pb-px">
            {[
              { id: 'nigerian', label: '🇳🇬 Nigerian Exams' },
              { id: 'international', label: '🌍 International Exams' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 rounded-t-lg text-sm font-medium transition-all border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'bg-white text-primary-700 border-primary-700'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Exam grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: activeTab === 'nigerian' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {dbExams.length === 0 ? (
                <div className="col-span-full text-center py-10 text-gray-400">
                  <p className="text-3xl mb-2">📋</p>
                  <p className="text-sm">No exams available yet</p>
                </div>
              ) : (
                dbExams.map((exam, i) => (
                  <ExamCard
                    key={exam.id || exam.slug}
                    exam={exam}
                    index={i}
                    hasSub={hasSub}
                    hasFreeTrial={hasFreeTrial}
                  />
                ))
              )}
            </motion.div>
          </AnimatePresence>

          {/* Info box */}
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
            <strong>💡 Tip:</strong> Each exam includes AI-powered explanations for every answer. After completing an exam, review wrong answers with Dr. Q to strengthen your understanding.
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
