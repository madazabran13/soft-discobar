import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  lowStockThreshold: number;
  setLowStockThreshold: (value: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      lowStockThreshold: 10,
      setLowStockThreshold: (value) => set({ lowStockThreshold: value }),
    }),
    { name: 'app-settings' }
  )
);
