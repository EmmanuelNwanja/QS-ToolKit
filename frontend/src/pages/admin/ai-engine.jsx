import React, { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { aiAPI } from '../../services/api';

const SUGGESTIONS = [
  'How many users signed up this week?',
  'What is our monthly revenue trend?',
  'Which subscription plan is most popular?',
  'Show me recent platform activity',
  'Draft an announcement for new features',
  'What is our churn rate?',
];

function generateSessionId() {
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AdminAIEngine() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(generateSessionId);
  const [accessDenied, setAccessDenied] = useState(false);
  const bottomRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data } = await aiAPI.adminChatHistory();
        if (data?.data?.messages?.length) {
          setMessages(data.data.messages);
        } else {
          // Welcome message
          setMessages([{
            role: 'model',
            content: 'Hello! I am Dr. Q Admin, your platform management assistant. I have access to real-time analytics, user data, and revenue insights. How can I help you today?'
          }]);
        }
      } catch (err) {
        if (err.response?.status === 403) {
          setAccessDenied(true);
        } else {
          setMessages([{
            role: 'model',
            content: 'Hello! I am Dr. Q Admin, your platform management assistant. I have access to real-time analytics, user data, and revenue insights. How can I help you today?'
          }]);
        }
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    setInput('');
    setLoading(true);

    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const { data } = await aiAPI.adminChat({ message: text, session_id: sessionId });
      setMessages((prev) => [...prev, { role: 'model', content: data.data?.reply || 'No response.' }]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Dr. Q Admin encountered an error.';
      if (err.response?.status === 403) {
        setAccessDenied(true);
      }
      toast.error(msg);
      setMessages((prev) => [...prev, { role: 'model', content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (accessDenied) {
    return (
      <ProtectedAdminRoute>
        <AdminLayout>
          <Head><title>Admin AI Engine — QSToolkit</title></Head>
          <div className="max-w-2xl mx-auto mt-20 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">Admin AI Engine access requires super admin privileges or an explicit grant from a super admin.</p>
          </div>
        </AdminLayout>
      </ProtectedAdminRoute>
    );
  }

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <Head><title>Admin AI Engine — QSToolkit</title></Head>
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-700 rounded-full flex items-center justify-center text-white text-lg font-bold">🧠</div>
              <div>
                <h1 className="font-bold text-gray-900">Dr. Q Admin</h1>
                <p className="text-xs text-gray-500">Platform management assistant with live analytics</p>
              </div>
            </div>
            <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              Session: {sessionId.slice(0, 16)}…
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-5">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] md:max-w-[65%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary-700 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
                  }`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-5 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only when no user messages yet) */}
          {messages.filter(m => m.role === 'user').length === 0 && (
            <div className="px-4 md:px-6 pb-3">
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Try asking</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="bg-white border-t border-gray-200 px-4 md:px-6 py-4">
            <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Dr. Q Admin anything about platform analytics, users, revenue..."
                className="flex-1 bg-gray-100 border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-primary-700 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
