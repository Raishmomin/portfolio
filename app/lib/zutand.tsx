"use client";

import { useEffect } from "react";
import { create } from "zustand";

interface PersonalState {
  value: any;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
}

export const usePersonalStore = create<PersonalState>((set, get) => ({
  value: null,
  loaded: false,
  loading: false,
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const response = await fetch("/api/skils", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      set({ value: data, loaded: true, loading: false });
    } catch (error) {
      console.error("Fetch failed:", error);
      set({ value: null, loaded: true, loading: false });
    }
  },
}));

export function usePersonalDataLoader() {
  const load = usePersonalStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);
}
