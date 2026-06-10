import { create } from 'zustand';

export const useUIStore = create((set) => ({
  toast: null,
  showToast: (message, severity = 'success') => set({ toast: { message, severity, id: Date.now() } }),
  hideToast: () => set({ toast: null }),
}));
