import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MESSAGES = [
  'Preparing your unique growth pathway...',
  'Working on your assessment...',
  'Analysing your strengths...',
  'Consulting QS standards...',
  'Mapping your career trajectory...',
  'Optimising your learning plan...',
];

export default function DrQThinkingAnimation({ message }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (message) return;
    const timer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [message]);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative mb-8"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-primary-700 to-primary-800 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-4xl font-display font-bold text-gold-400">Q</span>
        </div>
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-gold-400/30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary-400/20"
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
      </motion.div>

      <div className="h-8 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-primary-700 font-medium text-sm text-center"
          >
            {message || MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-1.5 mt-4">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary-600"
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}
