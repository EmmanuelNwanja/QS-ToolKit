import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { classroomAPI } from '../../services/classroomAPI';
import toast from 'react-hot-toast';

const SCENE_TYPES = [
  { key: 'lecture', label: 'Lecture', icon: '📖', desc: 'Concept explanations' },
  { key: 'quiz', label: 'Quiz', icon: '📝', desc: 'Test knowledge' },
  { key: 'boq', label: 'BOQ Builder', icon: '📊', desc: 'Hands-on BOQ' },
  { key: 'rate_analysis', label: 'Rate Analysis', icon: '💰', desc: 'Cost analysis' },
  { key: 'measurement', label: 'Measurement', icon: '📏', desc: 'Takeoff exercises' },
  { key: 'cost_plan', label: 'Cost Plan', icon: '🧮', desc: 'Budget planning' },
  { key: 'pbl', label: 'Problem-Based', icon: '🎯', desc: 'Real-world problems' },
  { key: 'discussion', label: 'Discussion', icon: '💬', desc: 'Multi-agent chat' },
];

const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', color: 'emerald' },
  { key: 'medium', label: 'Medium', color: 'amber' },
  { key: 'hard', label: 'Hard', color: 'orange' },
  { key: 'expert', label: 'Expert', color: 'red' },
];

export default function NewLessonPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState('');
  const [selectedTypes, setSelectedTypes] = useState(['lecture', 'quiz']);
  const [difficulty, setDifficulty] = useState('medium');
  const [sceneCount, setSceneCount] = useState(5);
  const [outline, setOutline] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (router.query.topic) setTopic(router.query.topic);
  }, [router.query.topic]);

  const toggleType = (key) => {
    setSelectedTypes(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    );
  };

  const generateOutline = async () => {
    if (!topic.trim()) { toast.error('Enter a topic'); return; }
    if (selectedTypes.length === 0) { toast.error('Select at least one scene type'); return; }
    setGenerating(true);
    try {
      const res = await classroomAPI.generateOutline({
        topic: topic.trim(),
        target_scene_types: selectedTypes,
        difficulty,
        scene_count: sceneCount,
      });
      setOutline(res.data);
      setStep(4);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate outline');
    } finally {
      setGenerating(false);
    }
  };

  const startLearning = async () => {
    setCreating(true);
    try {
      const res = await classroomAPI.acceptOutline(outline.outline_id);
      router.push(`/classroom/${res.data.lesson_id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create lesson');
      setCreating(false);
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>New Lesson — QSToolkit</title></Head>
      <Layout title="🎓 New Lesson">
        <div className="max-w-2xl space-y-6">
          <Link href="/classroom" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
            &larr; Back to Classroom
          </Link>

          {/* Steps indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= s ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{s}</div>
                {s < 4 && <div className={`w-8 h-0.5 ${step > s ? 'bg-primary-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Topic */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card space-y-4">
              <h2 className="font-display font-bold text-primary-800">What do you want to learn?</h2>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Residential building measurement and BOQ preparation"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
              />
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Scenes:</label>
                <select
                  value={sceneCount}
                  onChange={e => setSceneCount(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                >
                  {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button onClick={() => topic.trim() && setStep(2)} disabled={!topic.trim()} className="btn-primary text-sm px-6 py-2.5 disabled:opacity-40">
                Next →
              </button>
            </motion.div>
          )}

          {/* Step 2: Scene types */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card space-y-4">
              <h2 className="font-display font-bold text-primary-800">Select scene types</h2>
              <div className="grid grid-cols-2 gap-3">
                {SCENE_TYPES.map(st => (
                  <button
                    key={st.key}
                    onClick={() => toggleType(st.key)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      selectedTypes.includes(st.key)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">{st.icon}</span>
                    <p className="text-xs font-semibold text-gray-800 mt-1">{st.label}</p>
                    <p className="text-[10px] text-gray-500">{st.desc}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-secondary text-sm px-5 py-2.5">← Back</button>
                <button onClick={() => selectedTypes.length > 0 && setStep(3)} disabled={selectedTypes.length === 0} className="btn-primary text-sm px-6 py-2.5 disabled:opacity-40">Next →</button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Difficulty */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card space-y-4">
              <h2 className="font-display font-bold text-primary-800">Difficulty level</h2>
              <div className="grid grid-cols-2 gap-3">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d.key}
                    onClick={() => setDifficulty(d.key)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      difficulty === d.key ? `border-${d.color}-500 bg-${d.color}-50` : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-800">{d.label}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-secondary text-sm px-5 py-2.5">← Back</button>
                <button onClick={generateOutline} disabled={generating} className="btn-primary text-sm px-6 py-2.5 disabled:opacity-40">
                  {generating ? 'Generating…' : 'Generate Outline'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Outline preview */}
          {step === 4 && outline && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card space-y-4">
              <h2 className="font-display font-bold text-primary-800">Lesson Outline</h2>
              <p className="text-sm text-gray-600">{outline.description || topic}</p>
              <div className="space-y-2">
                {(outline.scenes || []).map((scene, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-lg">{SCENE_TYPES.find(t => t.key === scene.scene_type)?.icon || '📄'}</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-800">{scene.title}</p>
                      <p className="text-[10px] text-gray-500">{scene.scene_type?.replace(/_/g, ' ')} · {scene.estimated_time || 5}min</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="btn-secondary text-sm px-5 py-2.5">← Back</button>
                <button onClick={startLearning} disabled={creating} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                  {creating ? 'Creating…' : '🚀 Start Learning'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
