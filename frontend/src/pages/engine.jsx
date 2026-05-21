import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import DrawingUploader from '../components/DrawingUploader';
import { aiAPI, revisionAPI, integrityAPI } from '../services/api';
import { formatNaira, formatDate } from '../utils/helpers';

const TOOLS = [
  { id: 'chat', label: 'Chat', icon: '💬', description: 'Ask Dr. Q anything' },
  { id: 'drawings', label: 'Auto-BOQ', icon: '🏗️', description: 'Upload drawings → draft BOQ' },
  { id: 'forecast', label: 'Cost Forecast', icon: '🔮', description: 'Predict project overruns' },
  { id: 'variance', label: 'Variance', icon: '📊', description: 'Compare BOQ revisions' },
  { id: 'rates', label: 'Smart Rates', icon: '💡', description: 'Get rate suggestions' }
];

const SUGGESTIONS = {
  chat: [
    'How many 9-inch blocks for a 12m × 10m wall?',
    'Explain SMM7 vs NRM2',
    'What is the dry-to-wet factor for concrete?',
    'Suggest a rate for 150mm concrete slab per m²',
    'Calculate steel weight for 10mm bars at 50m total length'
  ],
  forecast: [],
  variance: [],
  rates: [],
  drawings: []
};

export default function EnginePage() {
  const router = useRouter();
  const [activeTool, setActiveTool] = useState(() => {
    const t = router.query.tool;
    return TOOLS.some((tool) => tool.id === t) ? t : 'chat';
  });

  useEffect(() => {
    if (router.query.tool && TOOLS.some((t) => t.id === router.query.tool)) {
      setActiveTool(router.query.tool);
    }
  }, [router.query.tool]);
  const [messages, setMessages] = useState([
    { role: 'model', content: 'Hello! I am Dr. Q, your Quantity Surveying assistant. Select a tool from the sidebar or ask me anything below.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `eng-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const bottomRef = useRef(null);

  // Forecast state
  const [forecastProjectId, setForecastProjectId] = useState('');
  const [forecastResult, setForecastResult] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Variance state
  const [varianceBoqId, setVarianceBoqId] = useState('');
  const [revisions, setRevisions] = useState([]);
  const [varianceResult, setVarianceResult] = useState(null);
  const [varianceLoading, setVarianceLoading] = useState(false);

  // Rates state
  const [rateDesc, setRateDesc] = useState('');
  const [rateUnit, setRateUnit] = useState('m2');
  const [rateResult, setRateResult] = useState(null);
  const [rateLoading, setRateLoading] = useState(false);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTool]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const { data } = await aiAPI.chat({
        message: text,
        session_id: sessionId,
        context: { type: 'general' }
      });
      setMessages((prev) => [...prev, { role: 'model', content: data.reply }]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Dr. Q is temporarily unavailable.';
      toast.error(msg);
      setMessages((prev) => [...prev, { role: 'model', content: msg, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const runForecast = async () => {
    if (!forecastProjectId.trim()) { toast.error('Enter a project ID'); return; }
    setForecastLoading(true);
    try {
      const { data } = await aiAPI.forecast(forecastProjectId);
      setForecastResult(data.forecast);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Forecast failed');
    } finally {
      setForecastLoading(false);
    }
  };

  const loadRevisions = async () => {
    if (!varianceBoqId.trim()) { toast.error('Enter a BOQ ID'); return; }
    try {
      const { data } = await revisionAPI.list(varianceBoqId);
      setRevisions(data.revisions || []);
      if ((data.revisions || []).length < 2) toast('Need at least 2 revisions to compare');
    } catch (err) {
      toast.error('Could not load revisions');
    }
  };

  const compareVariance = async (revA, revB) => {
    setVarianceLoading(true);
    try {
      const { data } = await revisionAPI.variance(varianceBoqId, revA, revB);
      setVarianceResult(data);
    } catch (err) {
      toast.error('Could not compare revisions');
    } finally {
      setVarianceLoading(false);
    }
  };

  const getRateSuggestion = async () => {
    if (!rateDesc.trim()) { toast.error('Enter a description'); return; }
    setRateLoading(true);
    try {
      const { data } = await aiAPI.suggestRate({ description: rateDesc, unit: rateUnit });
      setRateResult(data.suggestion);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rate suggestion failed');
    } finally {
      setRateLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>AI Engine — Dr. Q — QSToolkit</title></Head>
      <Layout title="AI Engine">
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)] min-h-[500px]">

          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0 bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <Link href="/dashboard" className="text-xs text-gray-500 hover:text-primary-700 flex items-center gap-1 mb-2">
                ← Back to Dashboard
              </Link>
              <h2 className="font-display font-bold text-primary-800 text-lg">🤖 Dr. Q Engine</h2>
              <p className="text-xs text-gray-500">Select a capability</p>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-1">
              {TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => { setActiveTool(tool.id); setMessages((prev) => prev); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    activeTool === tool.id
                      ? 'bg-primary-700 text-white'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-lg">{tool.icon}</span>
                  <div>
                    <p className={`text-sm font-medium ${activeTool === tool.id ? 'text-white' : 'text-gray-900'}`}>{tool.label}</p>
                    <p className={`text-[10px] ${activeTool === tool.id ? 'text-primary-200' : 'text-gray-500'}`}>{tool.description}</p>
                  </div>
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">

            {/* ─── CHAT TOOL ─── */}
            <AnimatePresence mode="wait">
              {activeTool === 'chat' && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col h-full"
                >
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((m, i) => (
                      <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        {m.role === 'model' && (
                          <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-gold-400 text-[10px] font-bold">Dr.Q</span>
                          </div>
                        )}
                        <div className={`max-w-[80%] text-sm px-4 py-2.5 rounded-2xl ${
                          m.role === 'user'
                            ? 'bg-primary-700 text-white rounded-br-md'
                            : m.error
                            ? 'bg-red-50 text-red-700 border border-red-100 rounded-bl-md'
                            : 'bg-gray-100 text-gray-800 rounded-bl-md'
                        }`}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-gold-400 text-[10px] font-bold">Dr.Q</span>
                        </div>
                        <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Suggestions */}
                  {messages.length <= 2 && (
                    <div className="px-4 pb-2 flex flex-wrap gap-2">
                      {SUGGESTIONS.chat.map((s) => (
                        <button key={s} onClick={() => send(s)} className="text-xs bg-gold-50 text-gold-800 border border-gold-200 px-3 py-1.5 rounded-full hover:bg-gold-100 transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input */}
                  <div className="p-3 border-t border-gray-100">
                    <div className="flex gap-2">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && send(input)}
                        placeholder="Ask Dr. Q anything..."
                        className="flex-1 text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button onClick={() => send(input)} disabled={loading || !input.trim()} className="px-5 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-primary-800 transition-colors">
                        Send
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── DRAWINGS TOOL ─── */}
              {activeTool === 'drawings' && (
                <motion.div key="drawings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full overflow-y-auto p-6">
                  <h3 className="font-display font-bold text-primary-800 text-lg mb-1">🏗️ Auto-BOQ from Drawings</h3>
                  <p className="text-sm text-gray-500 mb-5">Upload an architectural drawing and Dr. Q will extract rooms, dimensions, and materials to generate a draft BOQ.</p>
                  <DrawingUploader />
                </motion.div>
              )}

              {/* ─── FORECAST TOOL ─── */}
              {activeTool === 'forecast' && (
                <motion.div key="forecast" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full overflow-y-auto p-6">
                  <h3 className="font-display font-bold text-primary-800 text-lg mb-1">🔮 Cost Forecasting</h3>
                  <p className="text-sm text-gray-500 mb-5">Predict your project's final cost based on your historical overrun patterns.</p>

                  <div className="max-w-lg space-y-4">
                    <div className="flex gap-2">
                      <input
                        value={forecastProjectId}
                        onChange={(e) => setForecastProjectId(e.target.value)}
                        placeholder="Enter project ID (from URL /projects/xxx)"
                        className="flex-1 input"
                      />
                      <button onClick={runForecast} disabled={forecastLoading} className="btn-primary">
                        {forecastLoading ? 'Analyzing...' : 'Forecast'}
                      </button>
                    </div>

                    {forecastResult && (
                      <div className={`p-4 rounded-xl border-l-4 ${
                        forecastResult.risk_level === 'low' ? 'bg-emerald-50 border-emerald-400' :
                        forecastResult.risk_level === 'medium' ? 'bg-amber-50 border-amber-400' :
                        forecastResult.risk_level === 'high' ? 'bg-orange-50 border-orange-400' :
                        'bg-red-50 border-red-400'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold uppercase text-gray-500">Predicted Final Cost</span>
                          <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-white border">{forecastResult.risk_level} risk</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatNaira(forecastResult.predicted_final_value)}</p>
                        <p className="text-xs text-gray-500 mt-1">Confidence: {forecastResult.confidence_score}% · Based on {forecastResult.historical_sample_size} completed projects</p>
                        <p className="text-sm text-gray-700 mt-3">{forecastResult.recommendation}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ─── VARIANCE TOOL ─── */}
              {activeTool === 'variance' && (
                <motion.div key="variance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full overflow-y-auto p-6">
                  <h3 className="font-display font-bold text-primary-800 text-lg mb-1">📊 Variance Detection</h3>
                  <p className="text-sm text-gray-500 mb-5">Compare two versions of a BOQ to see exactly what changed.</p>

                  <div className="max-w-lg space-y-4">
                    <div className="flex gap-2">
                      <input value={varianceBoqId} onChange={(e) => setVarianceBoqId(e.target.value)} placeholder="Enter BOQ ID" className="flex-1 input" />
                      <button onClick={loadRevisions} className="btn-secondary">Load Revisions</button>
                    </div>

                    {revisions.length >= 2 && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-gray-700">Select two revisions to compare:</p>
                        <div className="flex gap-2">
                          <select id="rev-a" className="input flex-1">
                            <option value="">Older revision...</option>
                            {revisions.slice(0, -1).map((r) => (
                              <option key={r.id} value={r.id}>Rev {r.revision_number} — {formatDate(r.created_at)}</option>
                            ))}
                          </select>
                          <select id="rev-b" className="input flex-1">
                            <option value="">Newer revision...</option>
                            {revisions.slice(1).map((r) => (
                              <option key={r.id} value={r.id}>Rev {r.revision_number} — {formatDate(r.created_at)}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const a = document.getElementById('rev-a').value;
                              const b = document.getElementById('rev-b').value;
                              if (a && b) compareVariance(a, b);
                            }}
                            disabled={varianceLoading}
                            className="btn-primary"
                          >
                            {varianceLoading ? '...' : 'Compare'}
                          </button>
                        </div>
                      </div>
                    )}

                    {varianceResult && varianceResult.diff && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div className="p-3 bg-emerald-50 rounded-lg text-center">
                            <p className="text-emerald-700 font-bold text-lg">+{varianceResult.diff.summary?.items_added || 0}</p>
                            <p className="text-emerald-600 text-xs">Added</p>
                          </div>
                          <div className="p-3 bg-red-50 rounded-lg text-center">
                            <p className="text-red-700 font-bold text-lg">-{varianceResult.diff.summary?.items_removed || 0}</p>
                            <p className="text-red-600 text-xs">Removed</p>
                          </div>
                          <div className="p-3 bg-amber-50 rounded-lg text-center">
                            <p className="text-amber-700 font-bold text-lg">~{varianceResult.diff.summary?.items_modified || 0}</p>
                            <p className="text-amber-600 text-xs">Modified</p>
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="text-gray-500">Old total: <strong className="text-gray-900">{formatNaira(varianceResult.diff.summary?.old_total)}</strong></span>
                          <span className="text-gray-500">New total: <strong className="text-gray-900">{formatNaira(varianceResult.diff.summary?.new_total)}</strong></span>
                          <span className="text-gray-500">Difference: <strong className={varianceResult.diff.summary?.total_difference >= 0 ? 'text-red-600' : 'text-emerald-600'}>{formatNaira(varianceResult.diff.summary?.total_difference)}</strong></span>
                        </div>
                        {varianceResult.ai_summary?.summary && (
                          <div className="p-3 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-800">
                            <span className="font-semibold">Dr. Q Summary:</span> {varianceResult.ai_summary.summary}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ─── RATES TOOL ─── */}
              {activeTool === 'rates' && (
                <motion.div key="rates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full overflow-y-auto p-6">
                  <h3 className="font-display font-bold text-primary-800 text-lg mb-1">💡 Smart Rate Suggestions</h3>
                  <p className="text-sm text-gray-500 mb-5">Dr. Q suggests fair rates based on your historical BOQ data and Nigerian market conditions.</p>

                  <div className="max-w-lg space-y-4">
                    <div>
                      <label className="label">Item Description</label>
                      <input value={rateDesc} onChange={(e) => setRateDesc(e.target.value)} placeholder="e.g. 150mm reinforced concrete slab" className="input" />
                    </div>
                    <div>
                      <label className="label">Unit</label>
                      <select value={rateUnit} onChange={(e) => setRateUnit(e.target.value)} className="input">
                        <option value="m2">m²</option>
                        <option value="m3">m³</option>
                        <option value="m">m</option>
                        <option value="nr">nr</option>
                        <option value="item">item</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                    <button onClick={getRateSuggestion} disabled={rateLoading} className="btn-primary">
                      {rateLoading ? 'Thinking...' : 'Get Suggestion'}
                    </button>

                    {rateResult && rateResult.found && (
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Suggested Rate</p>
                        <p className="text-2xl font-bold text-primary-800">{formatNaira(rateResult.suggestedRate)} <span className="text-sm text-gray-500 font-normal">/ {rateUnit}</span></p>
                        <div className="flex gap-3 mt-2 text-xs text-gray-600">
                          <span>Low: {formatNaira(rateResult.rateLow)}</span>
                          <span>High: {formatNaira(rateResult.rateHigh)}</span>
                          <span>Based on {rateResult.sampleSize} items</span>
                        </div>
                      </div>
                    )}
                    {rateResult && !rateResult.found && (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-sm text-amber-800">
                        No historical data found for this item. Dr. Q needs more BOQ history to suggest rates.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
