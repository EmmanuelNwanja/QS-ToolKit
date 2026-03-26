import { create } from 'zustand';
import { authAPI } from '../services/api';

const useAuthStore = create((set, get) => ({
  user:        null,
  token:       null,
  loading:     true,
  initialized: false,

  // ── Initialize from localStorage ─────────────────────────
  init: async () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('qst_token');
    const cached = localStorage.getItem('qst_user');

    if (!token) {
      set({ loading: false, initialized: true });
      return;
    }

    set({ token, user: cached ? JSON.parse(cached) : null });

    try {
      const { data } = await authAPI.me();
      const user = data.user;
      localStorage.setItem('qst_user', JSON.stringify(user));
      set({ user, loading: false, initialized: true });
    } catch {
      localStorage.removeItem('qst_token');
      localStorage.removeItem('qst_user');
      set({ user: null, token: null, loading: false, initialized: true });
    }
  },

  // ── Login ─────────────────────────────────────────────────
  login: async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    const { token, user } = data;
    localStorage.setItem('qst_token', token);
    localStorage.setItem('qst_user', JSON.stringify(user));
    set({ user, token });
    return user;
  },

  // ── Register ──────────────────────────────────────────────
  register: async (payload) => {
    const { data } = await authAPI.register(payload);

    // Verification-first flow: no JWT is issued until email is verified.
    if (!data?.token || !data?.user) {
      return {
        requires_verification: data?.requires_verification,
        email: data?.email
      };
    }

    const { token, user } = data;
    localStorage.setItem('qst_token', token);
    localStorage.setItem('qst_user', JSON.stringify(user));
    set({ user, token });
    return user;
  },

  // ── Google Login ──────────────────────────────────────────
  googleLogin: async (accessToken) => {
    const { data } = await authAPI.googleLogin(accessToken);
    const { token, user, needs_onboarding } = data;
    localStorage.setItem('qst_token', token);
    localStorage.setItem('qst_user', JSON.stringify(user));
    set({ user, token });
    return { user, needs_onboarding };
  },

  // ── Refresh user ──────────────────────────────────────────
  refreshUser: async () => {
    try {
      const { data } = await authAPI.me();
      localStorage.setItem('qst_user', JSON.stringify(data.user));
      set({ user: data.user });
    } catch {}
  },

  // ── Logout ────────────────────────────────────────────────
  logout: () => {
    localStorage.removeItem('qst_token');
    localStorage.removeItem('qst_user');
    set({ user: null, token: null });
    window.location.href = '/auth/login';
  },

  // ── Computed helpers ──────────────────────────────────────
  isAuthenticated: () => !!get().token,
  isPro:           () => ['pro', 'enterprise'].includes(get().user?.subscription_plans?.name),
  isEnterprise:    () => get().user?.subscription_plans?.name === 'enterprise',
  isStudent:       () => get().user?.subscription_plans?.name === 'student',
  planName:        () => get().user?.subscription_plans?.name || 'free',
  isAdmin:         () => ['super_admin', 'admin'].includes(get().user?.org_role),
  isSuperAdmin:    () => get().user?.org_role === 'super_admin'
}));

export default useAuthStore;
