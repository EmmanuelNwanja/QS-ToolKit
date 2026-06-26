import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { examAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const NIGERIAN_EXAMS = [
  { slug: 'qsrbn-registration', name: 'QSRBN Registration Prep', body: 'QSRBN', format: '50 MCQs', time: '90 min', difficulty: 'Intermediate', passMark: 60 },
  { slug: 'niqs-probation', name: 'NIQS Probation Exam', body: 'NIQS', format: '40 MCQs + 10 Short Answers', time: '120 min', difficulty: 'Intermediate', passMark: 50 },
  { slug: 'niqs-intermediate', name: 'NIQS Intermediate Exam', body: 'NIQS', format: '30 MCQs + 5 Long Questions', time: '180 min', difficulty: 'Advanced', passMark: 55 },
  { slug: 'niqs-gde', name: 'NIQS GDE - Graduateship', body: 'NIQS', format: '6 Papers', time: '120 min each', difficulty: 'Advanced', passMark: 50 },
  { slug: 'niqs-tpc', name: 'NIQS TPC - Test of Professional Competence', body: 'NIQS', format: '4 Papers', time: '180 min each', difficulty: 'Expert', passMark: 50 },
  { slug: 'niqs-pci', name: 'NIQS PCI Prep', body: 'NIQS', format: 'Mock Interview Format', time: '60 min', difficulty: 'Expert', passMark: 0 },
  { slug: 'job-interview', name: 'Job Interview Prep', body: 'General', format: '30 MCQs + 10 Scenarios', time: '90 min', difficulty: 'All Levels', passMark: 60 }
];

const INTERNATIONAL_EXAMS = [
  { slug: 'rics-apc', name: 'RICS APC - QS & Construction', body: 'RICS', format: '50 MCQs per Competency', time: '60 min each', difficulty: 'Advanced', passMark: 70 },
  { slug: 'ciob-chartered', name: 'CIOB Chartered Membership', body: 'CIOB', format: '40 MCQs + Case Studies', time: '120 min', difficulty: 'Advanced', passMark: 65 },
  { slug: 'pmp-certification', name: 'PMP Certification', body: 'PMI', format: '180 MCQs across 3 Sections', time: '230 min', difficulty: 'Expert', passMark: 60 },
  { slug: 'prince2-foundation', name: 'PRINCE2 Foundation', body: 'Axelos', format: '75 MCQs', time: '60 min', difficulty: 'Intermediate', passMark: 55 },
  { slug: 'prince2-practitioner', name: 'PRINCE2 Practitioner', body: 'Axelos', format: 'Objective Testing', time: '150 min', difficulty: 'Advanced', passMark: 55 }
];

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

  return (
    <motion.div
      variants={cardAnim}
      initial="hidden"
      animate="show"
      transition={{ delay: index * 0.05 }}
    >
      <Link
        href={canStart ? `/exam-prep/professional/${exam.slug}` : '/subscription'}
        className="card hover:shadow-card-md hover:border-primary-200 transition-all group block"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{exam.body}</p>
            <h3 className="font-display font-bold text-primary-800 group-hover:text-primary-600 text-sm leading-tight">
              {exam.name}
            </h3>
          </div>
          <span className={`badge ${DIFFICULTY_COLORS[exam.difficulty] || 'badge-gray'} flex-shrink-0`}>
            {exam.difficulty}
          </span>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-4 text-center">📝</span>
            <span>{exam.format}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-4 text-center">⏱️</span>
            <span>{exam.time}</span>
          </div>
          {exam.passMark > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-4 text-center">🎯</span>
              <span>Pass mark: {exam.passMark}%</span>
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
  // Merge DB exams with hardcoded data, preferring DB data with slugs
  const hardcodedExams = activeTab === 'nigerian' ? NIGERIAN_EXAMS : INTERNATIONAL_EXAMS;
  const exams = hardcodedExams.map(e => {
    const dbExam = dbExams.find(d => d.slug === e.slug);
    return dbExam ? { ...e, id: dbExam.id, total_questions: dbExam.total_questions } : e;
  });

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
              { id: 'nigerian', label: '🇳🇬 Nigerian Exams', count: NIGERIAN_EXAMS.length },
              { id: 'international', label: '🌍 International Exams', count: INTERNATIONAL_EXAMS.length }
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
                <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {tab.count}
                </span>
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
              {exams.map((exam, i) => (
                <ExamCard
                  key={exam.slug}
                  exam={exam}
                  index={i}
                  hasSub={hasSub}
                  hasFreeTrial={hasFreeTrial}
                />
              ))}
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
