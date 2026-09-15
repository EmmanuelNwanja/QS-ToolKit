import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_STYLE = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: 'Pending' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'In Progress' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Completed' },
};

export default function PBLScene({ scene, onComplete }) {
  const content = scene?.content || {};

  const [milestones, setMilestones] = useState(() => {
    if (content.milestones?.length) return content.milestones.map(m => ({
      ...m,
      deliverables: m.deliverables || [],
      status: m.status || 'pending',
      expanded: false,
    }));
    return [];
  });
  const [submitted, setSubmitted] = useState(false);

  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  const toggleMilestone = (idx) => {
    setMilestones(prev => prev.map((m, i) => i === idx ? { ...m, expanded: !m.expanded } : m));
  };

  const cycleStatus = (idx) => {
    setMilestones(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      const next = m.status === 'pending' ? 'in_progress' : m.status === 'in_progress' ? 'completed' : 'pending';
      return { ...m, status: next };
    }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
    const score = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;
    onComplete?.({ score, milestones: milestones.map(m => ({ title: m.title, status: m.status })) });
  };

  return (
    <div className="space-y-6">
      {/* Project header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-primary-800">{content.title || 'Project-Based Learning'}</h2>
          <span className="text-sm font-bold text-primary-600">{progress}%</span>
        </div>
        {content.description && <p className="text-sm text-gray-600 mb-3">{content.description}</p>}
        {content.objectives?.length > 0 && (
          <div className="bg-primary-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-primary-700 mb-1">Learning Objectives</p>
            <ul className="space-y-1">
              {content.objectives.map((obj, i) => (
                <li key={i} className="text-xs text-primary-800 flex items-start gap-1"><span>•</span> {obj}</li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>

      <div className="flex gap-6">
        {/* Timeline */}
        <div className="w-10 shrink-0 flex flex-col items-center pt-6">
          {milestones.map((m, i) => {
            const s = STATUS_STYLE[m.status];
            return (
              <div key={i} className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${s.dot} border-2 border-white shadow`} />
                {i < milestones.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-[40px] ${m.status === 'completed' ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Milestones */}
        <div className="flex-1 space-y-3">
          {milestones.map((m, i) => {
            const s = STATUS_STYLE[m.status];
            return (
              <motion.div key={i} layout className={`card border-l-4 ${m.status === 'completed' ? 'border-emerald-400' : m.status === 'in_progress' ? 'border-amber-400' : 'border-gray-200'}`}>
                <button onClick={() => toggleMilestone(i)} className="w-full text-left flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${s.bg} ${s.text}`}>{i + 1}</span>
                    <span className="text-sm font-semibold text-gray-800">{m.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${s.bg} ${s.text}`}>{s.label}</span>
                    <span className="text-gray-400 text-xs">{m.expanded ? '▾' : '▸'}</span>
                  </div>
                </button>

                <AnimatePresence>
                  {m.expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        {m.description && <p className="text-xs text-gray-600 mb-3">{m.description}</p>}
                        {m.deliverables?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-500 mb-1">Deliverables</p>
                            <ul className="space-y-1">
                              {m.deliverables.map((d, j) => (
                                <li key={j} className="text-xs text-gray-700 flex items-start gap-1.5">
                                  <span className={m.status === 'completed' ? 'text-emerald-500' : 'text-gray-300'}>☐</span> {d}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <button onClick={() => cycleStatus(i)} className="text-xs text-primary-600 hover:text-primary-800 underline">
                          Mark as {s.label === 'Pending' ? 'In Progress' : s.label === 'In Progress' ? 'Completed' : 'Pending'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Rubric */}
      {content.rubric?.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <p className="text-xs font-semibold text-blue-700 mb-2">Grading Rubric</p>
          <div className="space-y-2">
            {content.rubric.map((r, i) => (
              <div key={i} className="text-xs">
                <p className="font-medium text-blue-800">{r.criteria}</p>
                <p className="text-blue-600">{r.description} — <span className="font-mono">{r.points} pts</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={submitted} className="btn-primary text-sm px-6 py-2">
          {submitted ? 'Submitted' : 'Submit Project'}
        </button>
      </div>

      {submitted && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card bg-emerald-50 border-emerald-200">
          <p className="text-sm font-semibold text-emerald-800">✓ Project Submitted</p>
          <p className="text-xs text-emerald-700 mt-1">{completedCount}/{milestones.length} milestones completed ({progress}%)</p>
        </motion.div>
      )}
    </div>
  );
}
