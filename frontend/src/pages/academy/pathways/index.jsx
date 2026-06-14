import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { academyAPI } from '../../../services/api';

const PATHWAYS = [
  { slug: 'technical-qs-practice', title: 'Technical QS Practice', focus: 'Consultancy', icon: '📐', levels: 5, color: 'border-l-blue-500' },
  { slug: 'commercial-management', title: 'Construction Commercial Management', focus: 'Commercial', icon: '💰', levels: 5, color: 'border-l-emerald-500' },
  { slug: 'project-management', title: 'Construction Project Management', focus: 'Project Delivery', icon: '🏗️', levels: 5, color: 'border-l-purple-500' },
  { slug: 'real-estate-advisory', title: 'Real Estate & Property Advisory', focus: 'Property', icon: '🏠', levels: 5, color: 'border-l-gold-500' },
  { slug: 'dispute-resolution', title: 'Construction Dispute Resolution', focus: 'Disputes', icon: '⚖️', levels: 5, color: 'border-l-red-400' },
  { slug: 'digital-construction', title: 'QS Technology & Digital Construction', focus: 'Technology', icon: '💻', levels: 5, color: 'border-l-cyan-500' },
  { slug: 'academic-research', title: 'Academic & Research Career', focus: 'Academia', icon: '🎓', levels: 5, color: 'border-l-indigo-400' },
];

const DESCRIPTIONS = {
  'technical-qs-practice': 'Master the core skills of quantity surveying consultancy — from measurement to cost planning and contract administration.',
  'commercial-management': 'Learn to manage commercial aspects of construction projects including procurement, contracts, and financial control.',
  'project-management': 'Develop expertise in planning, executing, and delivering construction projects on time and within budget.',
  'real-estate-advisory': 'Build skills in property valuation, real estate advisory, and investment analysis for the Nigerian market.',
  'dispute-resolution': 'Specialise in construction claims, arbitration, mediation, and dispute avoidance strategies.',
  'digital-construction': 'Leverage BIM, AI, and digital tools to transform traditional quantity surveying practices.',
  'academic-research': 'Pursue academic excellence in QS research, teaching, and contribution to construction knowledge.',
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function PathwaysPage() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await academyAPI.getProgress();
        setEnrollments(res.data.progress || []);
      } catch {}
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

          <div className="grid md:grid-cols-2 gap-4">
            {PATHWAYS.map((p) => {
              const enrollment = getEnrollment(p.slug);
              return (
                <motion.div key={p.slug} variants={fadeUp} initial="initial" animate="animate" transition={{ duration: 0.3 }}>
                  <Link href={`/academy/pathways/${p.slug}`} className={`card hover:shadow-md transition-all border-l-4 ${p.color} group block`}>
                    <div className="flex items-start gap-4">
                      <span className="text-3xl flex-shrink-0">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">{p.title}</h3>
                        <p className="text-xs text-primary-600 font-medium mt-0.5">{p.focus}</p>
                        <p className="text-sm text-gray-500 mt-2 leading-relaxed">{DESCRIPTIONS[p.slug]}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-gray-400">{p.levels} levels</span>
                          {enrollment ? (
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${(enrollment.current_level / p.levels) * 100}%` }} />
                              </div>
                              <span className="text-xs text-emerald-600 font-medium">Level {enrollment.current_level}</span>
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
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
