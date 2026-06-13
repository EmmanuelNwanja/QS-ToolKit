import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import QSFlowModal from '../components/QSFlowModal';

const STORAGE_KEY = 'qst_qs_flow_progress';

function getSavedProgress() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.project?.id || !data?.savedAt) return null;
    // Expire after 7 days
    if (Date.now() - data.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export default function QSFlowPage() {
  const [open, setOpen] = useState(false);
  const [savedProgress, setSavedProgress] = useState(null);

  useEffect(() => {
    setSavedProgress(getSavedProgress());
  }, []);

  const handleResume = () => {
    setOpen(true);
  };

  const handleStartFresh = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedProgress(null);
    setOpen(true);
  };

  const handleModalClose = () => {
    setOpen(false);
    setSavedProgress(getSavedProgress());
  };

  return (
    <ProtectedRoute>
      <Head><title>QS Flow — QSToolkit</title></Head>
      <Layout title="QS Flow">
        <div className="max-w-4xl mx-auto space-y-8 py-8">
          {/* Hero */}
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <span className="text-4xl">🚀</span>
            </div>
            <h1 className="page-title">QS Flow</h1>
            <p className="text-gray-500 max-w-lg mx-auto">
              Execute the complete quantity surveying process from start to finish.
              Select a project, complete all substructure and superstructure measurements,
              and generate a BOQ — all in one guided flow.
            </p>
          </div>

          {/* Saved Progress Banner */}
          {savedProgress && (
            <div className="bg-gold-50 border border-gold-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-12 h-12 bg-gold-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⏱️</span>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-semibold text-gold-800">You have saved progress</p>
                <p className="text-sm text-gold-600">
                  Project: <strong>{savedProgress.project?.title}</strong>
                  {savedProgress.step === 1 && ' · In Substructure'}
                  {savedProgress.step === 2 && ' · In Superstructure'}
                  {savedProgress.step === 3 && ' · Ready to create BOQ'}
                </p>
                <p className="text-xs text-gold-500 mt-0.5">
                  Saved {new Date(savedProgress.savedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleResume} className="btn-gold text-sm">
                  Resume →
                </button>
                <button onClick={handleStartFresh} className="btn-secondary text-sm">
                  Start Fresh
                </button>
              </div>
            </div>
          )}

          {/* Start Button */}
          {!savedProgress && (
            <div className="text-center">
              <button
                onClick={() => setOpen(true)}
                className="btn-gold text-base px-10 py-3.5 shadow-lg shadow-gold-500/25"
              >
                Start QS Flow
              </button>
            </div>
          )}

          {/* How It Works */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { icon: '📁', title: 'Select Project', desc: 'Choose or create a project to work on' },
              { icon: '🏗️', title: 'Substructure', desc: 'Complete 27 substructure measurements' },
              { icon: '🏢', title: 'Superstructure', desc: 'Complete 43 superstructure measurements' },
              { icon: '📋', title: 'Create BOQ', desc: 'Auto-generate a Bill of Quantities' },
            ].map((step, i) => (
              <div key={i} className="card text-center py-6 space-y-3">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mx-auto">
                  <span className="text-2xl">{step.icon}</span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-primary-800">{step.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <QSFlowModal isOpen={open} onClose={handleModalClose} />
      </Layout>
    </ProtectedRoute>
  );
}
