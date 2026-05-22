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

    // Safely parse cached user — corrupted JSON must not freeze the app.
    let cachedUser = null;
    try { cachedUser = cached ? JSON.parse(cached) : null; } catch { /* ignore */ }

    // If cached subscription is expired, clear plan so UI downgrades immediately
    // while /auth/me refreshes in the background.
    const isExpired = cachedUser?.subscription_expires_at && new Date(cachedUser.subscription_expires_at) <= new Date();
    if (isExpired && cachedUser) {
      cachedUser.subscription_status = 'inactive';
      cachedUser.subscription_plans = null;
      localStorage.setItem('qst_user', JSON.stringify(cachedUser));
    }

    set({ token, user: cachedUser });

    // Add a 15-second hard timeout so a hanging /auth/me never blocks forever.
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('auth_timeout')), 15000)
    );

    try {
      const { data } = await Promise.race([authAPI.me(), timeout]);
      const user = data.user;
      localStorage.setItem('qst_user', JSON.stringify(user));
      set({ user, loading: false, initialized: true });
    } catch {
      // Only clear storage if the token hasn't been replaced by a concurrent login().
      // If login() succeeded while /auth/me was in-flight, that new token must survive.
      if (localStorage.getItem('qst_token') === token) {
        localStorage.removeItem('qst_token');
        localStorage.removeItem('qst_user');
        set({ user: null, token: null, loading: false, initialized: true });
      } else {
        set({ loading: false, initialized: true });
      }
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
        email: data?.email,
        email_delivery_failed: !!data?.email_delivery_failed
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
  _isSubExpired:   () => {
    const exp = get().user?.subscription_expires_at;
    return exp && new Date(exp) <= new Date();
  },
  isPro:           () => !get()._isSubExpired() && ['pro', 'enterprise'].includes(get().user?.subscription_plans?.name),
  isEnterprise:    () => !get()._isSubExpired() && get().user?.subscription_plans?.name === 'enterprise',
  isStudent:       () => !get()._isSubExpired() && ['basic', 'student'].includes(get().user?.subscription_plans?.name),
  planName:        () => {
    if (get()._isSubExpired()) return 'free';
    return get().user?.subscription_plans?.name || 'free';
  },
  isAdmin:         () => ['super_admin', 'admin'].includes(get().user?.org_role),
  isSuperAdmin:    () => get().user?.org_role === 'super_admin'
}));

export default useAuthStore;
