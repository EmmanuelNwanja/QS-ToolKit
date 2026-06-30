import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { academyAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const PATHWAY_META = {
  'technical-qs-practice': { icon: '📐', color: 'border-l-blue-500' },
  'commercial-management': { icon: '💰', color: 'border-l-emerald-500' },
  'project-management': { icon: '🏗️', color: 'border-l-purple-500' },
  'real-estate-advisory': { icon: '🏠', color: 'border-l-gold-500' },
  'dispute-resolution': { icon: '⚖️', color: 'border-l-red-400' },
  'digital-construction': { icon: '💻', color: 'border-l-cyan-500' },
  'academic-research': { icon: '🎓', color: 'border-l-indigo-400' },
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function PathwaysPage() {
  const [pathways, setPathways] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [pathRes, progRes] = await Promise.allSettled([
          academyAPI.getPathways(),
          academyAPI.getProgress(),
        ]);
        if (pathRes.status === 'fulfilled') {
          setPathways(pathRes.value.data.pathways || pathRes.value.data || []);
        }
        if (progRes.status === 'fulfilled') {
          setEnrollments(progRes.value.data.progress || []);
        }
      } catch {
        toast.error('Failed to load pathways');
      }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const getEnrollment = (slug) => enrollments.find((e) => e.pathway?.slug === slug);

  return (
    <ProtectedRoute>
      <Head><title>Pathways — QS Academy</title></Head>
      <Layout title="🛤️ Pathways">
        <div className="max-w-6xl space-y-6">
          <Link href="/academy" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium">
            <span>←</span> Back to Academy
          </Link>
          <div>
            <h2 className="font-display text-2xl font-bold text-primary-800">Career Pathways</h2>
            <p className="text-sm text-gray-500 mt-1">Choose your QS specialisation. Each pathway has 5 levels of progressive mastery.</p>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="card animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-2/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {pathways.map((p) => {
                const meta = PATHWAY_META[p.slug] || { icon: '📚', color: 'border-l-gray-400' };
                const enrollment = getEnrollment(p.slug);
                const levelsCount = p.levels?.length || 5;
                return (
                  <motion.div key={p.slug} variants={fadeUp} initial="initial" animate="animate" transition={{ duration: 0.3 }}>
                    <Link href={`/academy/pathways/${p.slug}`} className={`card hover:shadow-md transition-all border-l-4 ${meta.color} group block`}>
                      <div className="flex items-start gap-4">
                        <span className="text-3xl flex-shrink-0">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">{p.title}</h3>
                          <p className="text-xs text-primary-600 font-medium mt-0.5">{p.focus_area}</p>
                          <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-2">{p.description}</p>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-gray-400">{levelsCount} levels · {p.module_count || 0} modules</span>
                            {enrollment ? (
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-gray-100 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${enrollment.progress_percent || 0}%` }} />
                                </div>
                                <span className="text-xs text-emerald-600 font-medium">{enrollment.progress_percent || 0}%</span>
                              </div>
                            ) : (
                              <span className="text-xs text-primary-600 font-semibold group-hover:underline">Enroll →</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
