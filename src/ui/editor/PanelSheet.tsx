import type { ReactNode } from "react";

import { Sheet } from "../kit/Sheet";
import { useLayout } from "../useLayout";

// panel del Editor; solo se cierra con su propio botón. Flota encima del lienzo (iPhone y iPad):
// nunca le quita espacio ni lo desplaza
export function PanelSheet({ children }: { children: ReactNode }) {
  const { regular } = useLayout();
  return <Sheet maxHeight={regular ? 420 : 300}>{children}</Sheet>;
}
