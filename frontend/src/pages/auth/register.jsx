import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import useAuthStore from '../../context/authStore';

const USER_TYPES = [
  { value: 'student',      emoji: '🎓', label: 'Student',              desc: 'University QS student' },
  { value: 'professional', emoji: '👷', label: 'Professional Surveyor', desc: 'Registered QS practitioner' },
  { value: 'company',      emoji: '🏢', label: 'Company / Enterprise',  desc: 'QS firm or consultancy' }
];

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [step, setStep]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm]   = useState({
    user_type: '', name: '', email: '', phone: '', password: '', confirmPassword: '',
    university_name: '', company_name: '', qs_cert_no: '', company_address: '', business_reg_no: ''
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const next = () => {
    if (step === 0 && !form.user_type) { toast.error('Please select an account type'); return; }
    if (step === 1) {
      if (!form.name || !form.email || !form.password) { toast.error('Please fill all required fields'); return; }
      if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
      if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      const user = await register(payload);
      toast.success(`Welcome to QSToolkit, ${user.name}!`);
      router.push('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Create Account — QSToolkit</title></Head>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-primary-700 rounded-xl flex items-center justify-center">
                <span className="text-gold-400 font-bold">QS</span>
              </div>
              <span className="font-display text-2xl font-bold text-primary-800">QSToolkit</span>
            </Link>
            <h1 className="font-display text-2xl font-bold text-primary-800">Create Your Account</h1>
            <p className="text-gray-500 text-sm mt-1">Join Nigeria's QS professional community</p>
          </div>

          {/* Step pills */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {['Type', 'Details', 'Professional'].map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i < step ? 'bg-emerald-500 text-white' :
                  i === step ? 'bg-primary-700 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step ? 'text-primary-700 font-semibold' : 'text-gray-400'}`}>{s}</span>
                {i < 2 && <div className="w-6 h-px bg-gray-200 mx-1" />}
              </div>
            ))}
          </div>

          <div className="card">
            {step === 0 && (
              <div>
                <h2 className="font-display text-lg font-bold text-primary-800 mb-4">I am a...</h2>
                <div className="space-y-3">
                  {USER_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => set('user_type', t.value)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                        form.user_type === t.value ? 'border-primary-700 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <span className="text-2xl">{t.emoji}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{t.label}</p>
                        <p className="text-xs text-gray-500">{t.desc}</p>
                      </div>
                      {form.user_type === t.value && <span className="text-primary-700 font-bold">✓</span>}
                    </button>
                  ))}
                </div>
                <button onClick={next} className="btn-primary w-full mt-6">Continue →</button>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-display text-lg font-bold text-primary-800 mb-2">Your Details</h2>
                {[
                  { label: 'Full Name', key: 'name', type: 'text', ph: 'e.g. Chukwuemeka Obi', req: true },
                  { label: 'Email Address', key: 'email', type: 'email', ph: 'your@email.com', req: true },
                  { label: 'Phone Number', key: 'phone', type: 'tel', ph: '08012345678', req: false },
                  { label: 'Password', key: 'password', type: 'password', ph: 'Min. 8 characters', req: true },
                  { label: 'Confirm Password', key: 'confirmPassword', type: 'password', ph: 'Repeat password', req: true }
                ].map(f => (
                  <div key={f.key}>
                    <label className="label">{f.label}{f.req && <span className="text-red-500"> *</span>}</label>
                    <input type={f.type} className="input" placeholder={f.ph}
                      value={form[f.key]} onChange={e => set(f.key, e.target.value)} required={f.req} />
                  </div>
                ))}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setStep(0)} className="btn-secondary flex-1">← Back</button>
                  <button onClick={next} className="btn-primary flex-1">Continue →</button>
                </div>
              </div>
            )}

            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="font-display text-lg font-bold text-primary-800 mb-2">Professional Info</h2>
                {form.user_type === 'student' && (
                  <div>
                    <label className="label">University Name</label>
                    <input className="input" placeholder="e.g. University of Lagos" value={form.university_name} onChange={e => set('university_name', e.target.value)} />
                  </div>
                )}
                {(form.user_type === 'professional' || form.user_type === 'company') && (
                  <>
                    <div>
                      <label className="label">Company / Practice Name</label>
                      <input className="input" placeholder="e.g. Obi QS Consult Ltd" value={form.company_name} onChange={e => set('company_name', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">NIQS / QS Reg. No.</label>
                      <input className="input" placeholder="e.g. NIQS/2024/xxxx" value={form.qs_cert_no} onChange={e => set('qs_cert_no', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Company Address</label>
                      <textarea className="input" rows={2} placeholder="Full address" value={form.company_address} onChange={e => set('company_address', e.target.value)} />
                    </div>
                    {form.user_type === 'company' && (
                      <div>
                        <label className="label">CAC / Business Reg. No.</label>
                        <input className="input" placeholder="RC 000000" value={form.business_reg_no} onChange={e => set('business_reg_no', e.target.value)} />
                      </div>
                    )}
                  </>
                )}
                <p className="text-xs text-gray-400 pt-1">By creating an account you agree to our Terms of Service.</p>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
                  <button type="submit" className="btn-gold flex-1" disabled={loading}>
                    {loading ? 'Creating…' : 'Create Account 🎉'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-primary-700 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </>
  );
}
