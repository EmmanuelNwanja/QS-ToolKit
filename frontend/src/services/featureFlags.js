import { create } from 'zustand';
import api from './api';

const useFeatureFlags = create((set, get) => ({
  flags: {},
  loaded: false,

  fetchFlags: async () => {
    try {
      const { data } = await api.get('/feature-flags/enabled');
      set({ flags: data?.data?.flags || {}, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  isEnabled: (key) => {
    const { flags } = get();
    return flags[key] === true;
  },

  setFlags: (flags) => set({ flags, loaded: true }),
}));

export default useFeatureFlags;
