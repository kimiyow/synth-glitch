import { useStore } from "zustand";

import { settingsFile } from "../platform/settingsFile";
import { createSettingsStore, type SettingsState } from "./settings";

export const settingsStore = createSettingsStore(settingsFile);

export function useSettings<T>(selector: (state: SettingsState) => T): T {
  return useStore(settingsStore, selector);
}
