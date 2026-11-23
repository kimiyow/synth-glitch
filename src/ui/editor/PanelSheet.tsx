import type { ReactNode } from "react";

import { Sheet } from "../kit/Sheet";
import { useLayout } from "../useLayout";

// panel del Editor; solo se cierra con su propio botón. Flota encima del lienzo: nunca le quita
// espacio ni lo desplaza. iPhone e iPad vertical: abajo, hasta ~40 % del alto; iPad horizontal:
// tarjeta a la derecha (las fotos verticales dejan libres los lados)
// back: abierto encima de otro panel; «‹ <back>» vuelve a él en lugar de cerrar con ✕
export function PanelSheet({ title, children, onClose, back }: { title: string; children: ReactNode; onClose: () => void; back?: string | null }) {
  const nav = back ? { onBack: onClose, backLabel: back } : {};
  const { regular, landscape, height } = useLayout();
  if (landscape)
    return (
      <Sheet side title={title} onClose={onClose} {...nav}>
        {children}
      </Sheet>
    );
  return (
    <Sheet title={title} maxHeight={regular ? Math.min(460, Math.round(height * 0.4)) : 300} onClose={onClose} {...nav}>
      {children}
    </Sheet>
  );
}
