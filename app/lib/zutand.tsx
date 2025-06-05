import { create } from "zustand";

interface CounterState {
  value: any;
  fetch: (url: string) => Promise<void>;
}

export const usePersonalStore = create<CounterState>((set) => ({
  value: null,
  fetch: async (url: string) => {
    try {
      const response = await fetch(url);
      const data = await response.json();
      set({ value: data });
    } catch (error) {
      console.error("Fetch failed:", error);
      set({ value: null });
    }
  },
}));
