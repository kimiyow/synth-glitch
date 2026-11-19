import type { SFSymbol } from "expo-symbols";
import { createStore } from "zustand/vanilla";

// hoja de confirmación común de la app: borrar, quitar, salir sin guardar y menús cortos usan la
// misma pieza (ConfirmHost) en lugar de las alertas grises del sistema
export type ConfirmAction = {
  id: string;
  label: string;
  icon?: SFSymbol;
  // primary = la acción que se confirma (blanca); secondary = alternativa (gris)
  variant?: "primary" | "secondary";
};

export type ConfirmRequest = {
  // etiqueta de sección en versalitas (CAPA, MODULACIÓN, PROYECTO…)
  section: string;
  title: string;
  message?: string;
  actions: readonly ConfirmAction[];
  cancelLabel?: string;
};

type Pending = ConfirmRequest & { resolve: (id: string | null) => void };

export const confirmStore = createStore<{ request: Pending | null }>(() => ({ request: null }));

// muestra la hoja y devuelve el id de la acción elegida, o null si se cancela
export function askConfirm(request: ConfirmRequest): Promise<string | null> {
  return new Promise((resolve) => {
    confirmStore.getState().request?.resolve(null);
    confirmStore.setState({ request: { ...request, resolve } });
  });
}

export function answerConfirm(id: string | null) {
  const pending = confirmStore.getState().request;
  if (!pending) return;
  confirmStore.setState({ request: null });
  pending.resolve(id);
}

// confirmación de borrado: una sola acción con papelera. True = borrar
export async function confirmDelete(opts: { section: string; title: string; message: string; label: string }): Promise<boolean> {
  const id = await askConfirm({
    section: opts.section,
    title: opts.title,
    message: opts.message,
    actions: [{ id: "delete", label: opts.label, icon: "trash", variant: "primary" }],
  });
  return id === "delete";
}
