import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import useAuthStore from '../../context/authStore';
import { userAPI } from '../../services/api';

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const { user, token, initialized, refreshUser } = useAuthStore();
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initialized) return;

    if (!token || !user) {
      router.replace('/auth/login');
      return;
    }

    if (!user.force_password_change) {
      if (user.is_admin) {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [initialized, token, user, router]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (form.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      await userAPI.forceChangePassword({
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword
      });
      await refreshUser();
      toast.success('Password updated successfully.');

      const cachedUser = JSON.parse(localStorage.getItem('qst_user') || '{}');
      if (cachedUser?.is_admin) {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Change Password - QSToolkit</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-sm p-6">
          <h1 className="text-2xl font-bold text-primary-800">Change Password Required</h1>
          <p className="text-sm text-gray-600 mt-2">
            You signed in with a one-time password. Set a new password to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                className="input"
                placeholder="At least 8 characters"
                value={form.newPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="label">Confirm New Password</label>
              <input
                type="password"
                className="input"
                placeholder="Repeat your new password"
                value={form.confirmPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                required
                minLength={8}
              />
            </div>

            <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
              {submitting ? 'Updating password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
