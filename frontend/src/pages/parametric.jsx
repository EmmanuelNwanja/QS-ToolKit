/**
 * Design Compliance Checklist:
 * ─────────────────────────────
 * [x] Colors  → primary-700, gray-500 (existing tokens)
 * [x] Buttons → btn-primary (from globals.css)
 * [x] Cards   → card (from globals.css)
 * [x] Layout  → Uses <Layout> + <ProtectedRoute>
 * [x] Icons   → Emoji-based
 * [x] Spacing → Tailwind scale
 * [x] Breadcrumb: Calculators > Smart Parametric
 */

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { projectAPI } from '../services/api';
import { isParametricEnabled } from '../components/parametric/parametricAPI';

export default function ParametricIndexPage() {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (!isParametricEnabled) return;
    projectAPI.list({ limit: 20 }).then(r => setProjects(r.data?.projects || [])).catch(() => {});
  }, []);

  return (
    <ProtectedRoute>
      <Head><title>Smart Parametric — QSToolkit</title></Head>
      <Layout title="🧠 Smart Parametric Calculator">
        <div className="max-w-4xl space-y-5">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/calculators" className="hover:text-primary-700">Calculators</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">Smart Parametric</span>
          </div>

          {!isParametricEnabled ? (
            <div className="card text-center py-12">
              <p className="text-4xl mb-4">🧠</p>
              <h2 className="section-title mb-2">Parametric Engine Disabled</h2>
              <p className="text-sm text-gray-500">
                Set <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">NEXT_PUBLIC_PARAMETRIC_ENGINE_ENABLED=true</code> to enable.
              </p>
            </div>
          ) : (
            <>
              <div className="card">
                <h2 className="section-title mb-2">Smart Parametric Estimator</h2>
                <p className="text-sm text-gray-500 mb-4">
                  AI-powered parametric beam, column, slab, and structural element design.
                  Select a project to start a calculation.
                </p>
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <span>💡</span>
                  <span>Calculations are tied to a project for BOQ injection.</span>
                </div>
              </div>

              <div className="card">
                <h3 className="section-title text-base mb-3">Your Projects</h3>
                {projects.length === 0 ? (
                  <p className="text-sm text-gray-400">No projects found. Create one first.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {projects.map(p => (
                      <Link key={p.id} href={`/projects/${p.id}/parametric`}
                        className="block p-4 rounded-xl border border-gray-100 hover:border-primary-300 hover:bg-primary-50/40 transition-all group">
                        <p className="font-semibold text-sm text-gray-800 group-hover:text-primary-700">{p.title}</p>
                        <p className="text-xs text-gray-400 mt-1">{p.client_name || 'No client'}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
