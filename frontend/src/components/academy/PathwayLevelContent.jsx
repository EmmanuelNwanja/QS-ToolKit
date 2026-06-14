import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import MarkdownRenderer from '../MarkdownRenderer';

/**
 * Interactive Pathway Level Content Component
 * Handles: learning content, quizzes, assessments, and project submissions
 */
export default function PathwayLevelContent({ 
  level, 
  modules = [], 
  onCompleteModule, 
  onSubmitProject,
  userProgress = {} 
}) {
  const [expandedModule, setExpandedModule] = useState(null);
  const [quizState, setQuizState] = useState({});
  const [projectSubmission, setProjectSubmission] = useState(null);
  const [activeTab, setActiveTab] = useState('learn');

  const levelModules = modules.filter(m => m.level === level.level_number);
  const completedCount = levelModules.filter(m => m.completed).length;
  const progress = levelModules.length > 0 ? Math.round((completedCount / levelModules.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Level Progress Bar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{completedCount}/{levelModules.length} modules completed</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {progress === 100 && (
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
            ✓ Level Complete
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {[
          { key: 'learn', label: '📖 Learning', icon: '📖' },
          { key: 'practice', label: '📝 Practice', icon: '📝' },
          { key: 'project', label: '🎯 Project', icon: '🎯' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key 
                ? 'bg-primary-100 text-primary-700 border border-primary-200' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Learning Tab */}
      {activeTab === 'learn' && (
        <div className="space-y-3">
          {levelModules.filter(m => m.module_type !== 'quiz' && m.module_type !== 'project').map((mod, idx) => (
            <ModuleCard 
              key={mod.id} 
              module={mod} 
              index={idx}
              isExpanded={expandedModule === mod.id}
              onToggle={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
              onComplete={() => onCompleteModule?.(mod.id)}
              userProgress={userProgress}
            />
          ))}
          {levelModules.filter(m => m.module_type !== 'quiz' && m.module_type !== 'project').length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📚</p>
              <p className="text-sm">Learning content coming soon for this level.</p>
            </div>
          )}
        </div>
      )}

      {/* Practice Tab */}
      {activeTab === 'practice' && (
        <div className="space-y-4">
          {levelModules.filter(m => m.module_type === 'quiz').map((quiz, idx) => (
            <QuizModule 
              key={quiz.id} 
              quiz={quiz} 
              index={idx}
              onComplete={() => onCompleteModule?.(quiz.id)}
            />
          ))}
          {levelModules.filter(m => m.module_type === 'quiz').length === 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 text-center">
              <p className="text-3xl mb-2">🧠</p>
              <p className="font-semibold text-gray-800 mb-1">Pop Quiz Coming Soon</p>
              <p className="text-sm text-gray-600">
                Test your knowledge with quick assessments after completing the learning modules.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Project Tab */}
      {activeTab === 'project' && (
        <div className="space-y-4">
          <LevelProject 
            level={level}
            onSubmit={onSubmitProject}
            userProgress={userProgress}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Individual Module Card with expandable content
 */
function ModuleCard({ module: mod, index, isExpanded, onToggle, onComplete, userProgress }) {
  const [loading, setLoading] = useState(false);
  const typeIcons = {
    article: '📄', video: '🎬', exercise: '💪', case_study: '📋', worksheet: '📄', reading: '📚'
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await onComplete?.();
      toast.success(`Completed "${mod.title}" +${mod.points || 10} points! 🎉`);
    } catch {
      toast.error('Failed to mark as complete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`border rounded-xl overflow-hidden transition-all ${
        mod.completed ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 hover:border-primary-200'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50/50 transition-colors"
      >
        <span className="text-xl">{typeIcons[mod.module_type] || '📄'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-medium text-sm ${mod.completed ? 'text-emerald-700' : 'text-gray-900'}`}>
              {mod.title}
            </p>
            {mod.completed && <span className="text-emerald-500 text-xs">✓</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {mod.module_type?.replace('_', ' ')} · {mod.duration_minutes || 5} min · +{mod.points || 10} pts
          </p>
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 border-t border-gray-100">
              {/* Content area */}
              <div className="py-4">
                {mod.content ? (
                  <div className="prose prose-sm prose-primary max-w-none">
                    <MarkdownRenderer content={mod.content} />
                  </div>
                ) : mod.resource_url ? (
                  <div className="space-y-3">
                    {mod.resource_url.includes('youtube.com') || mod.resource_url.includes('youtu.be') ? (
                      <div className="aspect-video rounded-lg overflow-hidden">
                        <iframe
                          src={mod.resource_url.replace('watch?v=', 'embed/')}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={mod.title}
                        />
                      </div>
                    ) : (
                      <a 
                        href={mod.resource_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm"
                      >
                        📎 Open resource ↗
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
                    <p>Content for this module is being prepared.</p>
                    <p className="text-xs mt-1">Check back soon!</p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {mod.duration_minutes && (
                    <span className="text-xs text-gray-400">⏱️ {mod.duration_minutes} min read</span>
                  )}
                </div>
                {!mod.completed ? (
                  <button
                    onClick={handleComplete}
                    disabled={loading}
                    className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Completing...' : '✓ Mark as Complete'}
                  </button>
                ) : (
                  <span className="text-emerald-600 text-sm font-medium">✓ Completed</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Quiz Module with instant feedback
 */
function QuizModule({ quiz, index, onComplete }) {
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  // Sample quiz questions - in real implementation, these would come from the database
  const questions = quiz.questions || [
    {
      question: "What is the standard number of 9-inch sandcrete blocks per square metre?",
      options: ["8 blocks/m²", "10 blocks/m²", "12 blocks/m²", "14 blocks/m²"],
      correct: 1
    },
    {
      question: "What is the dry-to-wet volume conversion factor for concrete?",
      options: ["1.35", "1.50", "1.54", "1.60"],
      correct: 2
    },
    {
      question: "Which document governs building measurement in Nigeria?",
      options: ["NRM2", "SMM7", "CESMM4", "POMI"],
      correct: 1
    }
  ];

  const handleAnswer = (qIdx, optIdx) => {
    setAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleSubmit = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct) correct++;
    });
    const finalScore = Math.round((correct / questions.length) * 100);
    setScore(finalScore);
    setShowResults(true);
    if (finalScore >= 70) {
      onComplete?.();
      toast.success(`Quiz passed! Score: ${finalScore}% 🎉`);
    }
  };

  if (!started) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-100"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <span className="text-2xl">📝</span>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">{quiz.title || 'Pop Quiz'}</h4>
            <p className="text-sm text-gray-500">{questions.length} questions · ~3 minutes</p>
          </div>
          <button
            onClick={() => setStarted(true)}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
          >
            Start Quiz
          </button>
        </div>
      </motion.div>
    );
  }

  if (showResults) {
    return (
      <div className={`rounded-xl p-6 text-center ${score >= 70 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
        <p className="text-4xl mb-2">{score >= 70 ? '🎉' : '📚'}</p>
        <h4 className="font-bold text-lg text-gray-900 mb-1">
          {score >= 70 ? 'Quiz Passed!' : 'Keep Practicing!'}
        </h4>
        <p className="text-3xl font-bold text-primary-700 mb-2">{score}%</p>
        <p className="text-sm text-gray-600 mb-4">
          You got {Object.keys(answers).filter(k => answers[k] === questions[k]?.correct).length} out of {questions.length} correct
        </p>
        <button
          onClick={() => { setStarted(false); setShowResults(false); setAnswers({}); setCurrentQ(0); }}
          className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
        >
          {score >= 70 ? 'Continue' : 'Try Again'}
        </button>
      </div>
    );
  }

  const q = questions[currentQ];
  if (!q) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-400">Question {currentQ + 1} of {questions.length}</span>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i === currentQ ? 'bg-primary-500' : answers[i] !== undefined ? 'bg-emerald-400' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>
      
      <p className="font-medium text-gray-900 mb-4">{q.question}</p>
      
      <div className="space-y-2 mb-4">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(currentQ, i)}
            className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all ${
              answers[currentQ] === i 
                ? 'border-primary-500 bg-primary-50 text-primary-800' 
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
            }`}
          >
            <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
            {opt}
          </button>
        ))}
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-40"
        >
          ← Previous
        </button>
        {currentQ < questions.length - 1 ? (
          <button
            onClick={() => setCurrentQ(currentQ + 1)}
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < questions.length}
            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            Submit Quiz
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Level Final Project Component
 */
function LevelProject({ level, onSubmit, userProgress }) {
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [projectFile, setProjectFile] = useState(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(userProgress?.project_submitted || false);
  const [score, setScore] = useState(userProgress?.project_score || null);

  const projectRequirements = {
    1: {
      title: "Measurement Takeoff Exercise",
      description: "Complete a measurement takeoff for a simple residential building based on provided drawings.",
      deliverables: ["Measurement sheet in SMM7 format", "Completed BOQ draft", "Brief methodology notes"],
      rubric: "Accuracy of measurements, adherence to SMM7, completeness"
    },
    2: {
      title: "Cost Estimation Report",
      description: "Prepare a detailed cost estimate for a commercial building project.",
      deliverables: ["Cost plan document", "Rate analysis for key items", "Contingency breakdown"],
      rubric: "Accuracy of rates, completeness of items, realistic contingencies"
    },
    3: {
      title: "Bill of Quantities Preparation",
      description: "Prepare a complete BOQ for a given project scope.",
      deliverables: ["Full BOQ document", "Pricing document", "Summary sheet"],
      rubric: "SMM7 compliance, proper formatting, accurate quantities"
    },
    4: {
      title: "Contract Administration Case Study",
      description: "Analyze a construction dispute and prepare a contract administration report.",
      deliverables: ["Contract analysis report", "Claims assessment", "Recommendation memo"],
      rubric: "Legal understanding, practical recommendations, thoroughness"
    },
    5: {
      title: "Professional Practice Portfolio",
      description: "Compile a portfolio demonstrating mastery across all pathway competencies.",
      deliverables: ["Portfolio document", "Case study compilation", "Professional development plan"],
      rubric: "Comprehensiveness, professional quality, reflective practice"
    }
  };

  const project = projectRequirements[level.level_number] || projectRequirements[1];

  const handleSubmit = async () => {
    if (!projectFile && !description.trim()) {
      toast.error('Please upload a file or add a description');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit?.({
        level: level.level_number,
        file: projectFile,
        description,
        project_title: project.title
      });
      setSubmitted(true);
      toast.success('Project submitted for review! AI will score it within minutes. 🎯');
      setShowSubmitForm(false);
    } catch {
      toast.error('Failed to submit project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Project Card */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🎯</span>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-900 mb-1">{project.title}</h4>
            <p className="text-sm text-gray-600 mb-3">{project.description}</p>
            
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">Deliverables:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {project.deliverables.map((d, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-amber-500">•</span> {d}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3 p-2 bg-white/50 rounded-lg">
              <p className="text-xs text-gray-500"><strong>Assessment Rubric:</strong> {project.rubric}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Submission Status */}
      {submitted ? (
        <div className={`rounded-xl p-4 ${score !== null ? 'bg-emerald-50 border border-emerald-200' : 'bg-blue-50 border border-blue-200'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{score !== null ? '✅' : '⏳'}</span>
            <div>
              <p className="font-medium text-gray-900">
                {score !== null ? 'Project Reviewed' : 'Project Under Review'}
              </p>
              {score !== null ? (
                <p className="text-sm text-gray-600">Score: <span className="font-bold text-emerald-700">{score}/100</span></p>
              ) : (
                <p className="text-sm text-gray-600">AI is reviewing your submission. Check back in a few minutes.</p>
              )}
            </div>
          </div>
        </div>
      ) : !showSubmitForm ? (
        <button
          onClick={() => setShowSubmitForm(true)}
          className="w-full py-3 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors"
        >
          📤 Submit Project for Assessment
        </button>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h4 className="font-semibold text-gray-900">Submit Your Project</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your approach, methodology, and key findings..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload File (PDF, DOCX, or ZIP)</label>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.zip"
              onChange={(e) => setProjectFile(e.target.files[0])}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowSubmitForm(false)}
              className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </div>
      )}

      {/* Gamification Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Points Earned', value: userProgress?.points || 0, icon: '⭐' },
          { label: 'Badges', value: userProgress?.badges?.length || 0, icon: '🏆' },
          { label: 'Streak', value: `${userProgress?.streak || 0} days`, icon: '🔥' }
        ].map((stat, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
            <span className="text-lg">{stat.icon}</span>
            <p className="font-bold text-gray-900 text-sm">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
