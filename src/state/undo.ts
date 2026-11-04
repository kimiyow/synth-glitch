import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from "immer";

enablePatches();

/** ADR-10: deshacer por parches de Immer, solo en memoria. */
export const MAX_UNDO = 100;

export type UndoEntry = { label: string; patches: Patch[]; inverse: Patch[] };
export type UndoHistory = { past: UndoEntry[]; future: UndoEntry[] };

export const EMPTY_HISTORY: UndoHistory = { past: [], future: [] };

/** Aplica un cambio confirmado. Sin diferencias no hay entrada. Un cambio nuevo vacía rehacer. */
export function change<T>(
  base: T,
  history: UndoHistory,
  label: string,
  recipe: (draft: Draft<T>) => void,
): { value: T; history: UndoHistory } {
  const [value, patches, inverse] = produceWithPatches(base, recipe);
  if (patches.length === 0) return { value: base, history };
  return {
    value: value as T,
    history: { past: [...history.past, { label, patches, inverse }].slice(-MAX_UNDO), future: [] },
  };
}

export function undo<T>(value: T, history: UndoHistory): { value: T; history: UndoHistory; label: string } | null {
  const entry = history.past.at(-1);
  if (!entry) return null;
  return {
    value: applyPatches(value as object, entry.inverse) as T,
    history: { past: history.past.slice(0, -1), future: [entry, ...history.future] },
    label: entry.label,
  };
}

export function redo<T>(value: T, history: UndoHistory): { value: T; history: UndoHistory; label: string } | null {
  const entry = history.future[0];
  if (!entry) return null;
  return {
    value: applyPatches(value as object, entry.patches) as T,
    history: { past: [...history.past, entry].slice(-MAX_UNDO), future: history.future.slice(1) },
    label: entry.label,
  };
}
