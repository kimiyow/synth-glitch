import type { Project } from "../state/types";

/** `pending` y `saving` se muestran como "Guardando cambios…" (PRJ-02). */
export type SaveStatus =
  | { state: "saved" }
  | { state: "pending" }
  | { state: "saving" }
  | { state: "error"; error: string };

export const AUTOSAVE_DELAY_MS = 1000;

export type Autosave = {
  /** Un cambio confirmado: guarda `delayMs` después del último. */
  schedule(project: Project): void;
  /** Guarda ya lo pendiente (al cambiar de proyecto, pasar a segundo plano o reintentar). */
  flush(): void;
  /** Descarta lo pendiente sin guardar (p. ej. al eliminar el proyecto). */
  cancel(): void;
  hasPending(): boolean;
};

export function createAutosave(opts: {
  write: (project: Project) => void;
  onStatus: (status: SaveStatus) => void;
  delayMs?: number;
}): Autosave {
  const delayMs = opts.delayMs ?? AUTOSAVE_DELAY_MS;
  let pending: Project | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const flush = () => {
    clear();
    if (!pending) return;
    const project = pending;
    opts.onStatus({ state: "saving" });
    try {
      opts.write(project);
      // Si llegó otro cambio mientras se escribía, se conserva.
      if (pending === project) pending = null;
      opts.onStatus(pending ? { state: "pending" } : { state: "saved" });
    } catch (error) {
      opts.onStatus({ state: "error", error: error instanceof Error ? error.message : String(error) });
    }
  };

  return {
    schedule(project) {
      pending = project;
      clear();
      timer = setTimeout(flush, delayMs);
      opts.onStatus({ state: "pending" });
    },
    flush,
    cancel() {
      clear();
      pending = null;
      opts.onStatus({ state: "saved" });
    },
    hasPending: () => pending !== null,
  };
}
