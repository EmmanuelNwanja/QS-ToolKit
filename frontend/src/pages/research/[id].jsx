import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { researchAPI } from '../../services/api';
import toast from 'react-hot-toast';

const STAGES = [
  { num: 1, name: 'Topic Definition', icon: '🎯', desc: 'Define research question, objectives, keywords' },
  { num: 2, name: 'Literature Search', icon: '📖', desc: 'Find and curate sources' },
  { num: 3, name: 'Literature Review', icon: '📝', desc: 'Synthesize sources into themes' },
  { num: 4, name: 'Methodology Design', icon: '🔬', desc: 'Choose method and approach' },
  { num: 5, name: 'Data Collection', icon: '📊', desc: 'Gather data points' },
  { num: 6, name: 'Data Analysis', icon: '📈', desc: 'Analyze findings' },
  { num: 7, name: 'Draft Writing', icon: '✍️', desc: 'Write research draft' },
  { num: 8, name: 'Peer Review', icon: '👁️', desc: 'Expert review and feedback' },
  { num: 9, name: 'Revision', icon: '🔄', desc: 'Revise based on feedback' },
  { num: 10, name: 'Final & Archive', icon: '📦', desc: 'Finalize and archive' }
];

export default function ResearchWorkspace() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(1);
  const [stageData, setStageData] = useState({});
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [advancing, setAdvancing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProject = useCallback(async () => {
    if (!id) return;
    try {
      const res = await researchAPI.getProject(id);
      const p = res.data;
      setProject(p);
      setActiveStage(p.current_stage || 1);
      setStageData(p.stage_data || {});
    } catch {
      toast.error('Failed to load project');
      router.push('/research');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const handleSaveStage = async () => {
    setSaving(true);
    try {
      await researchAPI.updateStageData(id, activeStage, stageData[`stage_${activeStage}`] || {});
      toast.success('Stage data saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      const res = await researchAPI.advanceStage(id);
      setProject(res.data);
      setActiveStage(res.data.current_stage);
      toast.success(res.message);
    } catch {
      toast.error('Failed to advance stage');
    } finally {
      setAdvancing(false);
    }
  };

  const handleAIAssist = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await researchAPI.aiAssist(id, activeStage, aiPrompt);
      setAiResult(res.data);
    } catch {
      toast.error('AI assist failed');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout title="Loading...">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500 text-sm">Loading project...</p>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!project) return null;

  const currentStageData = stageData[`stage_${activeStage}`] || {};

  return (
    <ProtectedRoute>
      <Head><title>{project.title} - QS Research</title></Head>
      <Layout title="QS Research Pipeline">
        <div className="max-w-6xl space-y-6">
          <Link href="/research" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium">
            <span>←</span> Back to Research
          </Link>

          {/* Project Header */}
          <div className="card border-indigo-200">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-primary-800">{project.title}</h2>
                {project.description && <p className="text-sm text-gray-500 mt-1">{project.description}</p>}
                <div className="flex items-center gap-3 mt-2">
                  <span className="badge badge-indigo text-xs capitalize">{project.research_type.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-gray-400">Stage {activeStage}/10 - {STAGES[activeStage - 1]?.name}</span>
                </div>
              </div>
              {project.status !== 'completed' && (
                <button onClick={handleAdvance} disabled={advancing} className="btn-primary text-sm">
                  {advancing ? 'Advancing...' : 'Advance to Next Stage →'}
                </button>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            {/* Stage Sidebar */}
            <div className="lg:col-span-1">
              <div className="card sticky top-4">
                <h3 className="font-display font-bold text-primary-800 mb-3 text-sm">Pipeline Stages</h3>
                <div className="space-y-1">
                  {STAGES.map(s => (
                    <button
                      key={s.num}
                      onClick={() => setActiveStage(s.num)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2 ${
                        activeStage === s.num
                          ? 'bg-indigo-100 text-indigo-800 font-semibold'
                          : s.num < activeStage
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{
                          backgroundColor: s.num < activeStage ? '#d1fae5' : s.num === activeStage ? '#c7d2fe' : '#f3f4f6',
                          color: s.num < activeStage ? '#059669' : s.num === activeStage ? '#4338ca' : '#9ca3af'
                        }}
                      >
                        {s.num < activeStage ? '✓' : s.num}
                      </span>
                      <span className="truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stage Workspace */}
            <div className="lg:col-span-3 space-y-5">
              {/* Stage Title */}
              <div className="flex items-center gap-3">
                <span className="text-3xl">{STAGES[activeStage - 1]?.icon}</span>
                <div>
                  <h2 className="font-display text-lg font-bold text-primary-800">Stage {activeStage}: {STAGES[activeStage - 1]?.name}</h2>
                  <p className="text-xs text-gray-500">{STAGES[activeStage - 1]?.desc}</p>
                </div>
              </div>

              {/* Stage Content Area */}
              <div className="card min-h-[300px]">
                {/* Topic Definition */}
                {activeStage === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Research Question</label>
                      <textarea
                        className="input"
                        rows={2}
                        placeholder="What specific question will this research answer?"
                        value={currentStageData.research_question || ''}
                        onChange={e => setStageData(p => ({ ...p, stage_1: { ...p.stage_1, research_question: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Objectives (one per line)</label>
                      <textarea
                        className="input"
                        rows={3}
                        placeholder="1. Identify cost factors&#10;2. Analyze regional trends&#10;3. Compare methods"
                        value={(currentStageData.objectives || []).join('\n')}
                        onChange={e => setStageData(p => ({ ...p, stage_1: { ...p.stage_1, objectives: e.target.value.split('\n').filter(Boolean) } }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma-separated)</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="quantity surveying, Nigeria, cost estimation"
                        value={(currentStageData.keywords || []).join(', ')}
                        onChange={e => setStageData(p => ({ ...p, stage_1: { ...p.stage_1, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))}
                      />
                    </div>
                  </div>
                )}

                {/* Literature Search */}
                {activeStage === 2 && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">Sources found for this research:</p>
                    {(currentStageData.sources || []).length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-3xl mb-2">📖</p>
                        <p className="text-sm">No sources added yet. Use AI Assist to suggest sources.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {currentStageData.sources.map((s, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <p className="font-medium text-sm">{s.title}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {s.authors?.join(', ')} ({s.year}) - {s.type}
                            </p>
                            {s.notes && <p className="text-xs text-gray-400 mt-1 italic">{s.notes}</p>}
                            <div className="flex items-center gap-1 mt-2">
                              {Array.from({ length: 5 }, (_, j) => (
                                <span key={j} className={`w-2 h-2 rounded-full ${j < (s.relevance_score || 0) ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                              ))}
                              <span className="text-xs text-gray-400 ml-1">relevance</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Literature Review */}
                {activeStage === 3 && (
                  <div className="space-y-4">
                    {(currentStageData.themes || []).length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-3xl mb-2">📝</p>
                        <p className="text-sm">No themes synthesized yet. Use AI Assist to group sources into themes.</p>
                      </div>
                    ) : (
                      currentStageData.themes.map((t, i) => (
                        <div key={i} className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                          <h4 className="font-semibold text-sm text-indigo-800">{t.theme}</h4>
                          <p className="text-xs text-gray-600 mt-1">{t.synthesis}</p>
                          {t.gaps && <p className="text-xs text-amber-600 mt-1">Gap: {t.gaps}</p>}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Methodology Design */}
                {activeStage === 4 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Research Method</label>
                      <select
                        className="input"
                        value={currentStageData.method || ''}
                        onChange={e => setStageData(p => ({ ...p, stage_4: { ...p.stage_4, method: e.target.value } }))}
                      >
                        <option value="">Select method</option>
                        <option value="quantitative">Quantitative</option>
                        <option value="qualitative">Qualitative</option>
                        <option value="mixed">Mixed Methods</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Approach</label>
                      <textarea
                        className="input"
                        rows={3}
                        placeholder="Describe your research approach..."
                        value={currentStageData.approach || ''}
                        onChange={e => setStageData(p => ({ ...p, stage_4: { ...p.stage_4, approach: e.target.value } }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sample Size</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="e.g., 50 QS firms"
                          value={currentStageData.sample_size || ''}
                          onChange={e => setStageData(p => ({ ...p, stage_4: { ...p.stage_4, sample_size: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tools (comma-separated)</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="e.g., SPSS, Excel"
                          value={(currentStageData.tools || []).join(', ')}
                          onChange={e => setStageData(p => ({ ...p, stage_4: { ...p.stage_4, tools: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Data Collection */}
                {activeStage === 5 && (
                  <div className="space-y-4">
                    {(currentStageData.data_points || []).length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-3xl mb-2">📊</p>
                        <p className="text-sm">No data points collected yet. Use AI Assist to suggest what to collect.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {currentStageData.data_points.map((d, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{d.source}</p>
                              <p className="text-xs text-gray-500">{d.value_type} - {d.unit}</p>
                            </div>
                            <span className="text-xs text-gray-400">{d.region}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Data Analysis */}
                {activeStage === 6 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Analysis Type</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g., Descriptive statistics, Thematic analysis"
                        value={currentStageData.analysis_type || ''}
                        onChange={e => setStageData(p => ({ ...p, stage_6: { ...p.stage_6, analysis_type: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Key Findings (one per line)</label>
                      <textarea
                        className="input"
                        rows={4}
                        placeholder="1. Finding one...&#10;2. Finding two..."
                        value={(currentStageData.findings || []).join('\n')}
                        onChange={e => setStageData(p => ({ ...p, stage_6: { ...p.stage_6, findings: e.target.value.split('\n').filter(Boolean) } }))}
                      />
                    </div>
                  </div>
                )}

                {/* Draft Writing */}
                {activeStage === 7 && (
                  <div className="space-y-4">
                    {(currentStageData.sections || []).length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-3xl mb-2">✍️</p>
                        <p className="text-sm">No draft sections yet. Use AI Assist to generate content.</p>
                      </div>
                    ) : (
                      currentStageData.sections.map((s, i) => (
                        <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <h4 className="font-semibold text-sm text-gray-800">{s.heading}</h4>
                          <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{s.content}</p>
                          <p className="text-xs text-gray-400 mt-2">{s.word_count} words</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Peer Review */}
                {activeStage === 8 && (
                  <div className="space-y-4">
                    {(currentStageData.reviewers || []).length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-3xl mb-2">👁️</p>
                        <p className="text-sm">No reviews yet. Use AI Assist to simulate peer review.</p>
                      </div>
                    ) : (
                      currentStageData.reviewers.map((r, i) => (
                        <div key={i} className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm text-amber-800">{r.name}</h4>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }, (_, j) => (
                                <span key={j} className={`w-2 h-2 rounded-full ${j < (r.score || 0) ? 'bg-amber-500' : 'bg-gray-200'}`} />
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{r.feedback}</p>
                          {r.criteria && <p className="text-xs text-amber-600 mt-1">Criteria: {r.criteria}</p>}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Revision */}
                {activeStage === 9 && (
                  <div className="space-y-4">
                    {(currentStageData.revisions || []).length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-3xl mb-2">🔄</p>
                        <p className="text-sm">No revisions yet. Use AI Assist to suggest revisions.</p>
                      </div>
                    ) : (
                      currentStageData.revisions.map((r, i) => (
                        <div key={i} className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                          <h4 className="font-semibold text-sm text-purple-800">{r.section}</h4>
                          <p className="text-xs text-gray-500 mt-1 italic">{r.reason}</p>
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div className="p-2 bg-red-50 rounded text-xs text-red-700">{r.before}</div>
                            <div className="p-2 bg-emerald-50 rounded text-xs text-emerald-700">{r.after}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Final & Archive */}
                {activeStage === 10 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Final Abstract</label>
                      <textarea
                        className="input"
                        rows={5}
                        placeholder="Write your final abstract..."
                        value={currentStageData.final_abstract || ''}
                        onChange={e => setStageData(p => ({ ...p, stage_10: { ...p.stage_10, final_abstract: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma-separated)</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="quantity surveying, Nigeria, cost analysis"
                        value={(currentStageData.keywords || []).join(', ')}
                        onChange={e => setStageData(p => ({ ...p, stage_10: { ...p.stage_10, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button onClick={handleSaveStage} disabled={saving} className="btn-outline text-sm">
                  {saving ? 'Saving...' : 'Save Progress'}
                </button>
              </div>

              {/* AI Assist Panel */}
              <div className="card border-indigo-200 bg-indigo-50/30">
                <h3 className="font-display font-bold text-primary-800 mb-3">🤖 AI Research Assistant (Dr. Q)</h3>
                <p className="text-xs text-gray-500 mb-3">Dr. Q understands this stage and can help with Nigerian QS context.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder={`Ask Dr. Q about ${STAGES[activeStage - 1]?.name || 'this stage'}...`}
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAIAssist()}
                  />
                  <button onClick={handleAIAssist} disabled={aiLoading} className="btn-primary text-sm">
                    {aiLoading ? 'Thinking...' : 'Ask Dr. Q'}
                  </button>
                </div>

                {aiResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-white rounded-lg border border-indigo-100"
                  >
                    <p className="text-xs text-indigo-600 font-semibold mb-2">Dr. Q&apos;s Response:</p>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">
                      {typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
