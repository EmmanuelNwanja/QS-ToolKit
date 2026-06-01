/**
 * Design Compliance Checklist:
 * ─────────────────────────────
 * [x] Colors  → primary-700, gray-500, badge-* (existing tokens)
 * [x] Buttons → btn-primary, btn-secondary (from globals.css)
 * [x] Cards   → card (from globals.css)
 * [x] Layout  → Uses <Layout> (same sidebar, topbar as rest of app)
 * [x] Icons   → Emoji-based (matching existing app pattern)
 * [x] Fonts   → font-display (section-title from globals.css)
 * [x] Spacing → Tailwind scale
 * [x] Breadcrumb pattern matches existing projects/[id].jsx
 * [x] Route  → Nested under /projects/:id/parametric (project context preserved)
 */

import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { projectAPI } from '../../../services/api';
import { isParametricEnabled } from '../../../components/parametric/parametricAPI';
import ParametricErrorBoundary from '../../../components/parametric/ParametricErrorBoundary';

const SmartCalculator = isParametricEnabled
  ? require('../../../components/parametric/SmartCalculator').default
  : null;

export default function ProjectParametricPage() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState(null);

  useEffect(() => {
    if (!id) return;
    projectAPI.get(id).then(r => setProject(r.data.project)).catch(() => {});
  }, [id]);

  if (!id) return null;

  return (
    <ProtectedRoute>
      <Head><title>Smart Parametric — QSToolkit</title></Head>
      <Layout title="🧠 Smart Parametric Calculator">
        <div className="max-w-5xl">
          {/* Breadcrumb — matches projects/[id] pattern */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/projects" className="hover:text-primary-700">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${id}`} className="hover:text-primary-700">
              {project?.title || 'Project'}
            </Link>
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
            <ParametricErrorBoundary>
              <div className="card">
                <SmartCalculator projectId={id} />
              </div>
            </ParametricErrorBoundary>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
