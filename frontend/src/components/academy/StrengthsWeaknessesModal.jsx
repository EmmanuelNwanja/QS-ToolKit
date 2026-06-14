import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { academyAPI } from '../../services/api';
import DrQThinkingAnimation from './DrQThinkingAnimation';

const COMPETENCIES = [
  'Measurement', 'Cost Planning', 'BOQ Preparation', 'Contract Administration',
  'Valuation', 'Claims Management', 'Project Management', 'BIM/Technology',
  'Client Advisory', 'Negotiation', 'Risk Management', 'Procurement',
  'Construction Law', 'Building Technology', 'Structural Analysis',
  'Building Services', 'Quality Control', 'Team Leadership',
];

const STEP_LABELS = ['Your Strengths', 'Your Weaknesses', 'Confirm'];

export default function StrengthsWeaknessesModal({ open, onComplete, existingProfile }) {
  const [step, setStep] = useState(0);
  const [strengths, setStrengths] = useState([]);
  const [weaknesses, setWeaknesses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [drQ, setDrQ] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Load existing profile when modal opens
  useEffect(() => {
    if (!open) return;

    // If profile data passed as prop, use it directly
    if (existingProfile?.strengths?.length || existingProfile?.weaknesses?.length) {
      setStrengths(existingProfile.strengths || []);
      setWeaknesses(existingProfile.weaknesses || []);
      return;
    }

    // Otherwise fetch from API
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        const res = await academyAPI.getStatus();
        const profile = res.data?.profile;
        if (profile) {
          setStrengths(profile.strengths || []);
          setWeaknesses(profile.weaknesses || []);
        }
      } catch {
        // Silently fail — user starts fresh
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [open, existingProfile]);

  const selected = step === 0 ? strengths : weaknesses;
  const setSelected = step === 0 ? setStrengths : setWeaknesses;
  const max = 3;

  const toggle = (comp) => {
    if (selected.includes(comp)) {
      setSelected((s) => s.filter((c) => c !== comp));
    } else if (selected.length < max) {
      setSelected((s) => [...s, comp]);
    }
  };

  const canNext = selected.length === max;

  const handleNext = () => {
    if (step < 2) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setDrQ(true);
    try {
      await academyAPI.saveProfile({ strengths, weaknesses });
      toast.success('Your profile has been saved!');
      setTimeout(() => onComplete?.(), 3000);
    } catch {
      toast.error('Failed to save. Please try again.');
      setDrQ(false);
    }
  };

  if (!open) return null;

  const hasExistingData = strengths.length > 0 || weaknesses.length > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {drQ ? (
            <div className="p-8">
              <DrQThinkingAnimation message="Analysing your strengths and weaknesses..." />
            </div>
          ) : loadingProfile ? (
            <div className="p-8 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
              <p className="text-sm text-gray-500">Loading your profile...</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl font-bold text-primary-800">
                    {step === 2 ? 'Review Your Profile' : `Step ${step + 1} of 3: ${STEP_LABELS[step]}`}
                  </h2>
                  <button onClick={() => onComplete?.()} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
                </div>
                {hasExistingData && step === 0 && (
                  <p className="text-xs text-primary-600 bg-primary-50 rounded-lg px-3 py-1.5 mb-3">
                    Your previous selections have been loaded. You can update them below.
                  </p>
                )}
                {/* Progress dots */}
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary-600' : 'bg-gray-200'}`} />
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {step < 2 ? (
                  <>
                    <p className="text-sm text-gray-500 mb-4">
                      Select exactly <span className="font-semibold text-primary-700">{max}</span> {step === 0 ? 'strengths' : 'weaknesses'}. These help Dr. Q personalise your pathway.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {COMPETENCIES.map((comp) => {
                        const isSelected = selected.includes(comp);
                        return (
                          <button
                            key={comp}
                            onClick={() => toggle(comp)}
                            className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all text-left ${
                              isSelected
                                ? step === 0
                                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                  : 'border-red-300 bg-red-50 text-red-700'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            <span className="mr-1.5">{isSelected ? '✓' : ''}</span>
                            {comp}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">{selected.length} / {max} selected</p>
                  </>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-700 mb-2">✓ Strengths</h3>
                      <div className="flex flex-wrap gap-2">
                        {strengths.map((s) => (
                          <span key={s} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium border border-emerald-200">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-red-600 mb-2">✗ Weaknesses</h3>
                      <div className="flex flex-wrap gap-2">
                        {weaknesses.map((w) => (
                          <span key={w} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-sm font-medium border border-red-200">{w}</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      Dr. Q will use this to recommend your best-fit pathway and tailor your learning experience.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={handleBack}
                  disabled={step === 0}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Back
                </button>
                {step < 2 ? (
                  <button
                    onClick={handleNext}
                    disabled={!canNext}
                    className="btn-primary px-6 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                ) : (
                  <button onClick={handleSubmit} className="btn-primary px-6 py-2 text-sm">
                    Submit & Start Assessment →
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
