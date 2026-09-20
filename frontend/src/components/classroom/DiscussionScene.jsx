import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { classroomAPI } from '../../services/classroomAPI';
import toast from 'react-hot-toast';

// ponytail: safeId() unavailable on Safari < 15.4
const safeId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);

const AGENT_AVATARS = {
  dr_q: '🎓',
  practitioner: '👷',
  student: '📚',
  system: '🤖',
};

const AGENT_NAMES = {
  dr_q: 'Dr. Q',
  practitioner: 'Practitioner',
  student: 'Student',
  system: 'System',
};

export default function DiscussionScene({ scene, onComplete }) {
  const content = scene?.content || {};
  const [messages, setMessages] = useState(() => {
    if (content.initial_messages?.length) {
      return content.initial_messages.map(m => ({ ...m, id: safeId() }));
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [discussionId, setDiscussionId] = useState(null);
  const [ended, setEnded] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const startDiscussion = async () => {
    try {
      const res = await classroomAPI.startDiscussion(scene.id);
      const data = res.data;
      setDiscussionId(data.session_id);
      if (data.initial_messages?.length) {
        setMessages(data.initial_messages.map(m => ({ ...m, id: safeId() })));
      }
    } catch {
      toast.error('Failed to start discussion');
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');

    const userMsg = { id: safeId(), role: 'user', agent: 'student', text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    try {
      if (!discussionId) {
        await startDiscussion();
      }
      const res = await classroomAPI.continueDiscussion(scene.id, discussionId, { message: text });
      const data = res.data;
      if (data.messages?.length) {
        setMessages(prev => [...prev, ...data.messages.map(m => ({ ...m, id: safeId() }))]);
      }
    } catch {
      toast.error('Failed to get response');
    } finally {
      setSending(false);
    }
  };

  const handleEnd = () => {
    setEnded(true);
    onComplete?.({ messages });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-primary-800">
            💬 {content.topic || scene.title || 'Discussion'}
          </h2>
          {!ended && (
            <button onClick={handleEnd} className="btn-secondary text-xs px-3 py-1.5">
              End Discussion
            </button>
          )}
          {ended && (
            <span className="text-xs text-emerald-600 font-semibold">✓ Discussion ended</span>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="card h-[400px] overflow-y-auto flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Start the discussion below.
          </div>
        )}
        <AnimatePresence>
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const avatar = isUser ? '🧑‍🎓' : (AGENT_AVATARS[msg.agent] || '🤖');
            const name = isUser ? 'You' : (AGENT_NAMES[msg.agent] || msg.agent);
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
              >
                <span className="text-2xl flex-shrink-0">{avatar}</span>
                <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                  isUser ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="text-[10px] font-semibold mb-1 opacity-60">{name}</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {sending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <span className="text-2xl">🤖</span>
            <div className="bg-gray-100 rounded-xl px-4 py-3 flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="w-2 h-2 bg-gray-400 rounded-full"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      {!ended && (
        <div className="card flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask a question or share your thoughts…"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="btn-primary text-sm px-5 py-2.5 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
