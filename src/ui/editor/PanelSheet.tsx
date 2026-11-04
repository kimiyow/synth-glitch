import type { ReactNode } from "react";

import { Sheet } from "../kit/Sheet";

/** Panel del Editor sobre la barra de herramientas; solo se cierra con su propio botón. */
export function PanelSheet({ children }: { children: ReactNode }) {
  return <Sheet maxHeight={300}>{children}</Sheet>;
}
