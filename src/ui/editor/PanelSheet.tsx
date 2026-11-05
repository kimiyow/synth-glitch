import type { ReactNode } from "react";

import { Sheet } from "../kit/Sheet";

/**
 * Panel del Editor; solo se cierra con su propio botón. En iPhone es una hoja sobre la
 * barra de herramientas; en iPad (`side`) es un panel lateral a la derecha del lienzo.
 */
export function PanelSheet({ children, side = false }: { children: ReactNode; side?: boolean }) {
  return (
    <Sheet maxHeight={300} side={side}>
      {children}
    </Sheet>
  );
}
