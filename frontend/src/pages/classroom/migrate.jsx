import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { classroomAPI } from '../../services/classroomAPI';
import toast from 'react-hot-toast';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

export default function MigratePage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    classroomAPI.getMigrationStatus()
      .then(res => setStatus(res.data))
      .catch(() => toast.error('Failed to load migration status'))
      .finally(() => setLoading(false));
  }, []);

  const handleBulkMigrate = async () => {
    if (!status?.unmigrated?.total) return;
    setMigrating(true);
    setResult(null);
    try {
      const res = await classroomAPI.bulkMigrate();
      setResult(res.data);
      toast.success(`Migrated ${res.data.migrated} items!`);
      // Refresh status
      const fresh = await classroomAPI.getMigrationStatus();
      setStatus(fresh.data);
    } catch {
      toast.error('Migration failed. Please try again.');
    } finally {
      setMigrating(false);
    }
  };

  const total = status?.unmigrated?.total || 0;

  return (
    <ProtectedRoute>
      <Head><title>Migrate to Classroom — QSToolkit</title></Head>
      <Layout title="📦 Migrate to Classroom">
        <div className="max-w-2xl mx-auto space-y-6">
          <Link href="/classroom" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium">
            <span>←</span> Back to Classroom
          </Link>

          <motion.div {...fadeUp} className="card">
            <h2 className="font-display text-xl font-bold text-primary-800 mb-2">Migrate Your Data</h2>
            <p className="text-sm text-gray-600 mb-6">
              Bring your exam prep attempts, academy lessons, and simulations into the new Classroom system.
              Your original data stays untouched.
            </p>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : total === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">✅</p>
                <p className="font-medium text-gray-900">All caught up!</p>
                <p className="text-sm text-gray-500 mt-1">Nothing left to migrate.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  {[
                    { key: 'exam_attempts', label: 'Exam Prep Attempts', icon: '📝' },
                    { key: 'academy_lessons', label: 'Academy Lessons', icon: '📚' },
                    { key: 'academy_simulations', label: 'Academy Simulations', icon: '🧮' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{item.icon}</span>
                        <span className="text-sm font-medium text-gray-900">{item.label}</span>
                      </div>
                      <span className="text-sm font-bold text-primary-700">
                        {status.unmigrated[item.key] || 0}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleBulkMigrate}
                  disabled={migrating}
                  className="w-full btn-primary py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {migrating ? 'Migrating...' : `Migrate All (${total} items)`}
                </button>
              </>
            )}
          </motion.div>

          {result && (
            <motion.div {...fadeUp} className="card bg-emerald-50 border border-emerald-200">
              <h3 className="font-semibold text-emerald-800 mb-2">Migration Complete</h3>
              <div className="text-sm text-emerald-700 space-y-1">
                <p>Exam attempts migrated: {result.counts?.exam_attempts || 0}</p>
                <p>Academy lessons migrated: {result.counts?.academy_lessons || 0}</p>
                <p>Academy simulations migrated: {result.counts?.academy_simulations || 0}</p>
                {result.counts?.skipped > 0 && <p>Skipped (already migrated): {result.counts.skipped}</p>}
                {result.counts?.errors > 0 && <p className="text-red-600">Errors: {result.counts.errors}</p>}
              </div>
              <Link href="/classroom" className="btn-primary text-sm mt-4 inline-flex">
                Go to Classroom →
              </Link>
            </motion.div>
          )}

          <div className="card bg-blue-50 border border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-2">What gets migrated?</h3>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>Completed exam attempts → Classroom lessons with quiz scenes</li>
              <li>Academy lessons → Lecture + quiz scenes</li>
              <li>Academy simulations → Scene matching the simulation type</li>
            </ul>
            <p className="text-xs text-blue-600 mt-3">Original data is preserved. You can still access Exam Prep and Academy.</p>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
