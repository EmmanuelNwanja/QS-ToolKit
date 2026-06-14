import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { examAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const EXAM_DATA = {
  'qsrbn-registration': {
    name: 'QSRBN Registration Prep', body: 'QSRBN', format: '50 MCQs', time: 90, passMark: 60, difficulty: 'Intermediate',
    description: 'Prepare for the Quantity Surveyors Registration Board of Nigeria (QSRBN) registration examination. Covers Nigerian construction law, measurement standards, and professional practice.',
    topics: ['Construction Law & Regulations', 'Standard Method of Measurement (SMM7)', 'BOQ Preparation', 'Professional Ethics', 'Nigerian Building Code', 'Contract Administration']
  },
  'niqs-probation': {
    name: 'NIQS Probation Exam', body: 'NIQS', format: '40 MCQs + 10 Short Answers', time: 120, passMark: 50, difficulty: 'Intermediate',
    description: 'The NIQS probation examination tests foundational knowledge required for Nigerian Quantity Surveyors. Covers measurement, estimation, and professional practice.',
    topics: ['Elementary Measurement', 'BOQ Production', 'Cost Estimation', 'Building Technology', 'Construction Materials', 'Professional Practice']
  },
  'niqs-intermediate': {
    name: 'NIQS Intermediate Exam', body: 'NIQS', format: '30 MCQs + 5 Long Questions', time: 180, passMark: 55, difficulty: 'Advanced',
    description: 'Intermediate-level examination covering advanced measurement techniques, cost planning, and project management principles for aspiring NIQS members.',
    topics: ['Advanced Measurement', 'Cost Planning & Control', 'Value Engineering', 'Project Management', 'Construction Economics', 'Contractual Procedures']
  },
  'niqs-gde': {
    name: 'NIQS GDE - Graduateship', body: 'NIQS', format: '6 Papers', time: 120, passMark: 50, difficulty: 'Advanced',
    description: 'The NIQS Graduateship Diploma Examination consists of 6 papers covering the full breadth of Quantity Surveying knowledge.',
    topics: ['Measurement & Quantification', 'Construction Technology', 'Professional Practice', 'Construction Economics', 'Contract Administration', 'Project Management']
  },
  'niqs-tpc': {
    name: 'NIQS TPC - Test of Professional Competence', body: 'NIQS', format: '4 Papers', time: 180, passMark: 50, difficulty: 'Expert',
    description: 'The Test of Professional Competence is the final examination for NIQS Fellowship. Covers real-world case studies and professional scenarios.',
    topics: ['Case Study Analysis', 'Professional Ethics', 'Dispute Resolution', 'Construction Management', 'Cost consultancy', 'Client Advisory']
  },
  'niqs-pci': {
    name: 'NIQS PCI Prep', body: 'NIQS', format: 'Mock Interview Format', time: 60, passMark: 0, difficulty: 'Expert',
    description: 'Practice for the NIQS Professional Competence Interview with mock scenarios, role-plays, and professional judgment questions.',
    topics: ['Professional Interview Technique', 'Case Study Presentation', 'Ethical Scenarios', 'Client Communication', 'Team Leadership']
  },
  'job-interview': {
    name: 'Job Interview Prep', body: 'General', format: '30 MCQs + 10 Scenarios', time: 90, passMark: 60, difficulty: 'All Levels',
    description: 'Prepare for Quantity Surveying job interviews with scenario-based questions, technical MCQs, and situational judgment tests.',
    topics: ['Technical Knowledge', 'Situational Judgment', 'CV & Portfolio', 'Salary Negotiation', 'Industry Knowledge', 'Soft Skills']
  },
  'rics-apc': {
    name: 'RICS APC - QS & Construction', body: 'RICS', format: '50 MCQs per Competency', time: 60, passMark: 70, difficulty: 'Advanced',
    description: 'Royal Institution of Chartered Surveyors Assessment of Professional Competence. Covers all competency areas for QS pathway candidates.',
    topics: ['Client Care', 'People & Communication', 'Construction Technology', 'Contract Practice', 'Financial Control', 'Professional Judgment']
  },
  'ciob-chartered': {
    name: 'CIOB Chartered Membership', body: 'CIOB', format: '40 MCQs + Case Studies', time: 120, passMark: 65, difficulty: 'Advanced',
    description: 'Chartered Institute of Building membership examination covering construction management, building technology, and professional practice.',
    topics: ['Construction Management', 'Building Technology', 'Health & Safety', 'Sustainability', 'Leadership', 'Contract Administration']
  },
  'pmp-certification': {
    name: 'PMP Certification', body: 'PMI', format: '180 MCQs across 3 Sections', time: 230, passMark: 60, difficulty: 'Expert',
    description: 'Project Management Professional certification exam covering predictive, agile, and hybrid project management approaches.',
    topics: ['People', 'Process', 'Business Environment', 'Agile Methodologies', 'Risk Management', 'Stakeholder Engagement']
  },
  'prince2-foundation': {
    name: 'PRINCE2 Foundation', body: 'Axelos', format: '75 MCQs', time: 60, passMark: 55, difficulty: 'Intermediate',
    description: 'PRINCE2 Foundation certification covering the principles, themes, and processes of the PRINCE2 project management methodology.',
    topics: ['Principles', 'Themes', 'Processes', 'Project Environment', 'Tailoring', 'Roles & Responsibilities']
  },
  'prince2-practitioner': {
    name: 'PRINCE2 Practitioner', body: 'Axelos', format: 'Objective Testing', time: 150, passMark: 55, difficulty: 'Advanced',
    description: 'PRINCE2 Practitioner certification demonstrating ability to apply and tailor the PRINCE2 methodology to real-world projects.',
    topics: ['Application of Principles', 'Tailoring Themes', 'Adapting Processes', 'Project Scenarios', 'Lesson Application', 'Commercial Management']
  }
};

export default function ExamDetailPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [starting, setStarting] = useState(false);

  const examInfo = EXAM_DATA[slug] || null;

  useEffect(() => {
    async function load() {
      try {
        const res = await examAPI.getStatus();
        setStatus(res.data);
      } catch {} finally {
        setLoading(false);
      }
    }
    if (slug) load();
  }, [slug]);

  const hasSub = status?.subscription_status === 'active';
  const hasFreeTrial = status?.free_trial_available === true;
  const canStart = hasSub || hasFreeTrial;

  const handleStart = async () => {
    if (!canStart) {
      router.push('/subscription');
      return;
    }
    setShowConfirm(true);
  };

  const confirmStart = async () => {
    setStarting(true);
    try {
      const res = await examAPI.startExam(slug);
      const examId = res.data.exam_id || res.data.id;
      router.push(`/exam-prep/professional/${slug}?examId=${examId}&active=1`);
      setShowConfirm(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start exam');
    } finally {
      setStarting(false);
    }
  };

  if (!examInfo && !loading) {
    return (
      <ProtectedRoute>
        <Head><title>Exam Not Found — QSToolkit</title></Head>
        <Layout title="Exam Not Found">
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-gray-500 mb-4">Exam not found</p>
            <Link href="/exam-prep/professional" className="btn-primary text-sm">Browse Exams</Link>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Head><title>{examInfo?.name || 'Exam'} — QSToolkit</title></Head>
      <Layout title={examInfo?.name || 'Loading...'}>
        <div className="max-w-3xl space-y-6">

          <Link href="/exam-prep/professional" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
            &larr; Back to Professional Exams
          </Link>

          {loading ? (
            <div className="card space-y-4">
              <div className="h-8 bg-gray-100 rounded w-2/3 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
            </div>
          ) : examInfo && (
            <>
              {/* Exam header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{examInfo.body}</p>
                    <h1 className="font-display text-2xl font-bold text-primary-800">{examInfo.name}</h1>
                  </div>
                  <span className={`badge ${
                    examInfo.difficulty === 'Expert' ? 'badge-red' :
                    examInfo.difficulty === 'Advanced' ? 'badge-amber' :
                    examInfo.difficulty === 'Intermediate' ? 'badge-blue' : 'badge-gray'
                  }`}>
                    {examInfo.difficulty}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">{examInfo.description}</p>

                {/* Format details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Format', value: examInfo.format, icon: '📝' },
                    { label: 'Duration', value: `${examInfo.time} min`, icon: '⏱️' },
                    { label: 'Pass Mark', value: examInfo.passMark > 0 ? `${examInfo.passMark}%` : '—', icon: '🎯' },
                    { label: 'Body', value: examInfo.body, icon: '🏛️' }
                  ].map(d => (
                    <div key={d.label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <span className="text-lg">{d.icon}</span>
                      <p className="text-xs text-gray-500 mt-1">{d.label}</p>
                      <p className="text-sm font-semibold text-primary-800">{d.value}</p>
                    </div>
                  ))}
                </div>

                {/* Topics */}
                <div className="mb-6">
                  <h3 className="font-display font-bold text-primary-800 text-sm mb-3">Topics Covered</h3>
                  <div className="flex flex-wrap gap-2">
                    {examInfo.topics.map(t => (
                      <span key={t} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Start button */}
                <div className="flex items-center gap-4">
                  <button onClick={handleStart} className="btn-primary text-base px-8 py-3">
                    {hasSub ? 'Start Exam' : hasFreeTrial ? 'Start Free Trial Exam' : 'Subscribe to Start'}
                  </button>
                  {!hasSub && !hasFreeTrial && (
                    <Link href="/subscription" className="text-sm text-primary-600 hover:underline">
                      View plans &rarr;
                    </Link>
                  )}
                </div>
              </motion.div>

              {/* Subscription note */}
              {!hasSub && hasFreeTrial && (
                <div className="p-4 bg-gold-50 border border-gold-200 rounded-xl text-sm text-gold-800">
                  <strong>🎁 Free Trial:</strong> This will use your 1 free exam attempt. No subscription required.
                </div>
              )}
              {!hasSub && !hasFreeTrial && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
                  An active Exam Prep subscription is required to access this exam.
                </div>
              )}
            </>
          )}

          {/* Confirmation modal */}
          <AnimatePresence>
            {showConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                onClick={() => !starting && setShowConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="font-display text-xl font-bold text-primary-800 mb-2">Start Exam?</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    {hasSub
                      ? `You are about to start the ${examInfo?.name}. Your timer will begin immediately.`
                      : `This will use your 1 free exam attempt for the ${examInfo?.name}. You have no more free trials remaining after this.`
                    }
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={starting}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmStart}
                      disabled={starting}
                      className="btn-primary text-sm"
                    >
                      {starting ? 'Starting...' : 'Yes, Start Exam'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
