"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { aiAPI } from "../../services/api";
import MarkdownRenderer from "../MarkdownRenderer";
import AIConversation from "./ai-conversation";
import AIMessage from "./ai-message";

/* ══ Dr. Q Chat Widget ════════════════════════════════════
   Replaces AiChatWidget.jsx using the new AIConversation +
   AIMessage component system. Same functionality, better UX:
   - Scroll-to-bottom pill when reading history
   - Copy/retry/vote actions on assistant messages
   - Proper message bubbles with avatars
   - Suggestions shown when few messages exist

   QSToolkit: the primary Dr. Q interface for chat. */

const DR_Q_AVATAR = (
  <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center flex-shrink-0">
    <span className="text-gold-400 text-[10px] font-bold">Dr.Q</span>
  </div>
);

const USER_AVATAR = (
  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
    <span className="text-gray-600 text-[10px] font-bold">You</span>
  </div>
);

const SUGGESTIONS = [
  "How many 9-inch blocks for a 12m × 10m wall?",
  "Explain SMM7 vs NRM2",
  "What is the dry-to-wet factor for concrete?",
  "Suggest a rate for 150mm concrete slab per m²",
];

const WIDGET_TITLE = "Dr. Q";
const WIDGET_SUBTITLE = "Nigerian construction standards expert";

export default function AiChatWidget({ context = {} }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "model",
      content:
        "Hello! I am Dr. Q, your Quantity Surveying assistant. Ask me anything about Nigerian construction standards, calculations, or BOQs.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(
    () => `qst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      setOpen(true);
      setTimeout(() => send(e.detail), 300);
    };
    window.addEventListener("qst-ai-ask", handler);
    return () => window.removeEventListener("qst-ai-ask", handler);
  }, []);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    setInput("");
    const userMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data } = await aiAPI.chat({
        message: text,
        session_id: sessionId,
        context,
      });
      setMessages((prev) => [
        ...prev,
        { id: `m-${Date.now()}`, role: "model", content: data.reply },
      ]);
    } catch (err) {
      const msg =
        err.response?.data?.message || "Dr. Q is temporarily unavailable.";
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: "model", content: msg, error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const retry = (idx) => {
    const lastUser = [...messages]
      .slice(0, idx)
      .reverse()
      .find((m) => m.role === "user");
    if (lastUser) {
      setMessages((prev) => prev.slice(0, idx));
      send(lastUser.content);
    }
  };

  const vote = (idx, dir) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, vote: dir } : m))
    );
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary-800 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        aria-label="Open AI Chat"
        data-tour="chat-bot"
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
                <p className="text-[10px] text-primary-200">
                  {WIDGET_SUBTITLE}
                </p>
              </div>
            </div>

            {/* Messages via AIConversation */}
            <AIConversation className="flex-1" contentKey={messages.length}>
              <div className="p-4 space-y-4">
                {messages.map((m, i) => (
                  <AIMessage
                    key={m.id}
                    from={m.role === "user" ? "user" : "assistant"}
                    avatar={m.role === "user" ? USER_AVATAR : DR_Q_AVATAR}
                    bubble={!m.error}
                    copyText={
                      m.role === "model" && !m.error ? m.content : undefined
                    }
                    onRetry={
                      m.role === "model" && !m.error && i === messages.length - 1
                        ? () => retry(i)
                        : undefined
                    }
                    onVote={
                      m.role === "model" && !m.error
                        ? (dir) => vote(i, dir)
                        : undefined
                    }
                  >
                    {m.role === "user" ? (
                      m.content
                    ) : m.error ? (
                      <span className="text-red-600">{m.content}</span>
                    ) : (
                      <MarkdownRenderer content={m.content} />
                    )}
                  </AIMessage>
                ))}

                {loading && (
                  <AIMessage from="assistant" avatar={DR_Q_AVATAR} bubble>
                    <div className="flex gap-1 py-1">
                      <span
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </AIMessage>
                )}
              </div>
            </AIConversation>

            {/* Suggestions */}
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
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(input)}
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
