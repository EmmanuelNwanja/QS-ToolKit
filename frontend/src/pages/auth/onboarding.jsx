import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import useAuthStore from '../../context/authStore';
import { authAPI } from '../../services/api';

export default function OnboardingPage() {
  const router  = useRouter();
  const { user, refreshUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    company_name:    user?.company_name    || '',
    company_address: user?.company_address || '',
    qs_cert_no:      user?.qs_cert_no      || '',
    phone:           user?.phone           || ''
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.completeOnboarding(form);
      await refreshUser();
      toast.success('All set! Welcome to QSToolkit 🎉');
      router.push('/dashboard');
    } catch (err) {
      toast.error('Could not save details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Complete Your Profile — QSToolkit</title></Head>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-9 h-9 bg-primary-700 rounded-lg flex items-center justify-center">
              <span className="text-gold-400 font-bold">QS</span>
            </div>
            <span className="font-display text-2xl font-bold text-primary-800">QSToolkit</span>
          </div>
          <div className="card">
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">👋</div>
              <h1 className="font-display text-2xl font-bold text-primary-800">Complete Your Profile</h1>
              <p className="text-sm text-gray-500 mt-2">Just a few more details to personalise your workspace</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              {user?.user_type !== 'student' && (
                <div>
                  <label className="label">Company / Firm Name</label>
                  <input className="input" placeholder="Emeka QS Associates" value={form.company_name} onChange={e => set('company_name', e.target.value)} />
                </div>
              )}
              <div>
                <label className="label">Phone Number</label>
                <input className="input" placeholder="080xxxxxxxx" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              {user?.user_type !== 'student' && (
                <>
                  <div>
                    <label className="label">NIQS / QS Cert. No.</label>
                    <input className="input" placeholder="NIQS/2024/00001" value={form.qs_cert_no} onChange={e => set('qs_cert_no', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Office Address</label>
                    <input className="input" placeholder="No. 5, Marina Road, Lagos" value={form.company_address} onChange={e => set('company_address', e.target.value)} />
                  </div>
                </>
              )}
              <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                {loading ? 'Saving…' : 'Go to My Dashboard →'}
              </button>
              <button type="button" className="w-full text-center text-sm text-gray-400 hover:text-gray-600" onClick={() => router.push('/dashboard')}>
                Skip for now
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
