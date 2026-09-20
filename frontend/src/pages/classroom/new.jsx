import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { classroomAPI } from '../../services/classroomAPI';
import toast from 'react-hot-toast';

export default function NewLessonPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error('Enter a topic'); return; }
    setGenerating(true);
    try {
      const res = await classroomAPI.generateCustomLesson({
        topic: topic.trim(),
        difficulty: 'medium',
      });
      router.push(`/classroom/${res.data.lesson_id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate lesson');
      setGenerating(false);
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>New Lesson - QSToolkit</title></Head>
      <Layout title="🎓 New Lesson">
        <div className="max-w-lg space-y-6">
          <Link href="/classroom" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
            &larr; Back to Classroom
          </Link>

          <div className="card space-y-4">
            <h2 className="font-display font-bold text-primary-800">What do you want to learn?</h2>
            <p className="text-sm text-gray-500">Describe the topic and we&apos;ll generate a lesson with a mix of lectures, quizzes, and practical exercises.</p>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
              placeholder="e.g. Residential building measurement and BOQ preparation"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={3}
            />
            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || generating}
              className="w-full btn-primary text-sm py-2.5 disabled:opacity-40"
            >
              {generating ? 'Generating…' : 'Generate Lesson'}
            </button>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
