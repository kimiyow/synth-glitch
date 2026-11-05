import type { ReactNode } from "react";

import { Sheet } from "../kit/Sheet";

/**
 * Panel del Editor; solo se cierra con su propio botón. En iPhone es una hoja sobre la
 * barra de herramientas; en iPad (`popover`) flota sobre el lienzo junto al riel (4.4).
 */
export function PanelSheet({ children, popover = false }: { children: ReactNode; popover?: boolean }) {
  return (
    <Sheet maxHeight={popover ? 480 : 300} popover={popover}>
      {children}
    </Sheet>
  );
}
