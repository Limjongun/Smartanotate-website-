import { create } from "zustand";

interface ProjectStore {
  activeProjectId: string | null;
  setActiveProject: (id: string | null) => void;
  isAutoAnnotating: boolean;
  setAutoAnnotating: (val: boolean) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  activeProjectId: null,
  setActiveProject: (id) => set({ activeProjectId: id }),
  isAutoAnnotating: false,
  setAutoAnnotating: (val) => set({ isAutoAnnotating: val }),
}));
