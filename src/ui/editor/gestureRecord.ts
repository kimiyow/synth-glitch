import { createContext, useContext } from "react";

// el editor graba gestos sobre el lienzo; los paneles solo piden empezar
export type GestureRecord = {
  // empieza a grabar la modulación GESTO dada (el panel se oculta mientras tanto)
  start: (routeId: string) => void;
  notice: (text: string) => void;
};

export const GestureRecordContext = createContext<GestureRecord | null>(null);
export const useGestureRecord = () => useContext(GestureRecordContext);
