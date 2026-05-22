import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { aiAPI } from '../services/api';

const DR_Q_AVATAR = (
  <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center flex-shrink-0">
    <span className="text-gold-400 text-[10px] font-bold">Dr.Q</span>
  </div>
);

const SUGGESTIONS = [
  'How many 9-inch blocks for a 12m × 10m wall?',
  'Explain SMM7 vs NRM2',
  'What is the dry-to-wet factor for concrete?',
  'Suggest a rate for 150mm concrete slab per m²'
];
const WIDGET_TITLE = 'Dr. Q';
const WIDGET_SUBTITLE = 'Nigerian construction standards expert';

export default function AiChatWidget({ context = {} }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'model', content: 'Hello! I am Dr. Q, your Quantity Surveying assistant. Ask me anything about Nigerian construction standards, calculations, or BOQs.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `qst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const bottomRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      setOpen(true);
      setTimeout(() => send(e.detail), 300);
    };
    window.addEventListener('qst-ai-ask', handler);
    return () => window.removeEventListener('qst-ai-ask', handler);
  }, []);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const { data } = await aiAPI.chat({
        message: text,
        session_id: sessionId,
        context
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

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary-800 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        aria-label="Open AI Chat"
      >
        {open ? (
          <span className="text-xl">✕</span>
        ) : (
          <div className="flex flex-col items-center leading-none">
            <span className="text-gold-400 font-bold text-sm">QS</span>
            <span className="text-[9px]">AI</span>
          </div>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-primary-800 text-white px-4 py-3 flex items-center gap-3">
              {DR_Q_AVATAR}
              <div>
                <p className="text-sm font-semibold">{WIDGET_TITLE}</p>
                <p className="text-[10px] text-primary-200">{WIDGET_SUBTITLE}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {m.role === 'model' && DR_Q_AVATAR}
                  <div
                    className={`max-w-[80%] text-sm px-3 py-2 rounded-xl ${
                      m.role === 'user'
                        ? 'bg-primary-700 text-white rounded-br-none'
                        : m.error
                        ? 'bg-red-50 text-red-700 border border-red-100 rounded-bl-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2">
                  {DR_Q_AVATAR}
                  <div className="bg-gray-100 rounded-xl rounded-bl-none px-3 py-2">
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

            {/* Suggestions (only show when few messages) */}
            {messages.length <= 2 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs bg-gold-50 text-gold-800 border border-gold-200 px-2.5 py-1 rounded-full hover:bg-gold-100 transition-colors"
                  >
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
                  placeholder={`Ask ${WIDGET_TITLE} anything...`}
                  className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={() => send(input)}
                  disabled={loading || !input.trim()}
                  className="px-3 py-2 bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-800 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
