import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { feedbackAPI } from '../../services/api';

const STARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function PublicFeedbackPage() {
  const router = useRouter();
  const { token } = router.query;
  const [link, setLink]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [form, setForm] = useState({
    rating: 0, quality_score: 0, timeliness_score: 0, communication_score: 0, comment: '', client_name: ''
  });

  useEffect(() => {
    if (!token) return;
    feedbackAPI.getPublic(token)
      .then(res => {
        setLink(res.data.link);
        setAlreadyDone(res.data.already_submitted);
        if (res.data.link?.client_name) setForm(f => ({ ...f, client_name: res.data.link.client_name }));
      })
      .catch(() => setLink(null))
      .finally(() => setLoading(false));
  }, [token]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.rating || !form.quality_score || !form.timeliness_score || !form.communication_score) {
      toast.error('Please rate all categories'); return;
    }
    try {
      await feedbackAPI.submit(token, form);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed. Please try again.');
    }
  };

  const RatingRow = ({ label, field }) => (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-1.5 flex-wrap">
        {STARS.map(n => (
          <button key={n} type="button" onClick={() => set(field, n)}
            className={`w-9 h-9 rounded-lg text-sm font-bold transition-all border ${
              form[field] === n
                ? 'bg-gold-500 text-white border-gold-500'
                : form[field] >= n
                  ? 'bg-gold-100 text-gold-700 border-gold-200'
                  : 'bg-white text-gray-400 border-gray-200 hover:border-gold-300'
            }`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      <Head><title>Leave Feedback — QSToolkit</title></Head>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-lg">

          {/* Brand header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-gold-400 font-bold text-lg">QS</span>
            </div>
            <p className="text-gray-500 text-sm">Powered by QSToolkit</p>
          </div>

          {!link ? (
            <div className="card text-center py-12">
              <p className="text-4xl mb-3">🔗</p>
              <h2 className="font-display text-xl font-bold text-primary-800 mb-2">Link Not Found</h2>
              <p className="text-gray-500 text-sm">This feedback link is invalid or has expired.</p>
            </div>
          ) : alreadyDone ? (
            <div className="card text-center py-12">
              <p className="text-4xl mb-3">✅</p>
              <h2 className="font-display text-xl font-bold text-primary-800 mb-2">Already Submitted</h2>
              <p className="text-gray-500 text-sm">You&apos;ve already left feedback for this project. Thank you!</p>
            </div>
          ) : submitted ? (
            <div className="card text-center py-12">
              <p className="text-5xl mb-4">🎉</p>
              <h2 className="font-display text-2xl font-bold text-primary-800 mb-2">Thank You!</h2>
              <p className="text-gray-500">Your feedback has been submitted successfully.</p>
              <p className="text-gray-400 text-sm mt-2">Your response helps {link.surveyor_name} improve their service.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card space-y-6">
              <div className="pb-4 border-b border-gray-100">
                <h1 className="font-display text-xl font-bold text-primary-800">
                  Rate {link.company_name || link.surveyor_name}&apos;s Work
                </h1>
                <p className="text-gray-500 text-sm mt-1">Project: <strong>{link.project_title}</strong></p>
                {link.message && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800 italic">
                    &quot;{link.message}&quot;
                  </div>
                )}
              </div>

              <RatingRow label="Overall Rating (1–10)" field="rating" />
              <RatingRow label="Quality of Work (1–10)" field="quality_score" />
              <RatingRow label="Timeliness / Punctuality (1–10)" field="timeliness_score" />
              <RatingRow label="Communication (1–10)" field="communication_score" />

              <div>
                <label className="label">Your Name</label>
                <input className="input" placeholder="Optional" value={form.client_name} onChange={e => set('client_name', e.target.value)} />
              </div>

              <div>
                <label className="label">Additional Comments (optional)</label>
                <textarea className="input" rows={3} placeholder="Tell us about your experience…" value={form.comment} onChange={e => set('comment', e.target.value)} />
              </div>

              <button type="submit" className="btn-gold w-full py-3 text-base">
                Submit Feedback ✓
              </button>
            </form>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            Feedback is collected securely by QSToolkit · qstoolkit.com
          </p>
        </div>
      </div>
    </>
  );
}
