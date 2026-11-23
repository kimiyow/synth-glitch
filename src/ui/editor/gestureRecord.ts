import { createContext, useContext } from "react";

// el editor graba gestos sobre el lienzo; los paneles solo piden empezar
export type GestureRecord = {
  // empieza a grabar la modulación GESTO dada (el panel se oculta mientras tanto)
  start: (routeId: string) => void;
  notice: (text: string) => void;
  // abre el panel Gesto encima del panel actual (su ✕ vuelve al anterior). Es el único lugar donde
  // se graba, transforma y guarda un gesto
  open: () => void;
};

export const GestureRecordContext = createContext<GestureRecord | null>(null);
export const useGestureRecord = () => useContext(GestureRecordContext);
