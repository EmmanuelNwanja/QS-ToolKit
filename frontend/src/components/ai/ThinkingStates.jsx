/**
 * ThinkingStates.jsx
 * Animated thinking state indicator for AI responses.
 * Shows which cognitive step Dr. Q is currently performing.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const THINKING_STATES = {
  analyzing: { icon: '🔍', label: 'Analyzing your request...' },
  searching: { icon: '🔍', label: 'Searching standards and project data...' },
  calculating: { icon: '🧮', label: 'Running calculations...' },
  reasoning: { icon: '🤔', label: 'Reasoning through approaches...' },
  critiquing: { icon: '✅', label: 'Verifying accuracy...' },
  finalizing: { icon: '✨', label: 'Finalizing response...' }
};

export default function ThinkingStates({ currentState = 'analyzing', className = '' }) {
  const state = THINKING_STATES[currentState] || THINKING_STATES.analyzing;
  const states = Object.keys(THINKING_STATES);
  const currentIndex = states.indexOf(currentState);

  return (
    <div className={`flex items-center gap-3 p-3 bg-blue-50 rounded-lg ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"
      />
      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentState}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-sm text-blue-700 font-medium"
          >
            {state.icon} {state.label}
          </motion.p>
        </AnimatePresence>
        <div className="flex gap-1 mt-1.5">
          {states.map((s, i) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                i < currentIndex
                  ? 'w-4 bg-green-400'
                  : i === currentIndex
                  ? 'w-6 bg-blue-500'
                  : 'w-4 bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
