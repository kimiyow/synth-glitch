import { create } from "zustand";

export type ActiveMedia = {
  uri: string;
  type: "photo";
  width: number;
  height: number;
};

type EditorState = {
  activeMedia: ActiveMedia | null;
  setActiveMedia: (media: ActiveMedia) => void;
  clearActiveMedia: () => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  activeMedia: null,
  setActiveMedia: (activeMedia) => set({ activeMedia }),
  clearActiveMedia: () => set({ activeMedia: null }),
}));
