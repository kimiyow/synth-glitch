import { createContext, useContext } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import type { Route } from "../domain/types";

// señales en vivo de la modulación que comparten el lienzo y los paneles: el reloj del preview (s),
// la compuerta del toque para el ADSR y el último golpe del micrófono. El lienzo las escribe; la
// vista en vivo de cada modulación las lee en el hilo de UI
export type ModBus = {
  time: SharedValue<number>;
  gateOn: SharedValue<number | null>;
  gateOff: SharedValue<number | null>;
  micHitAt: SharedValue<number | null>;
  // grabación de un gesto: ruta que se graba ("" = ninguna) y posición del dedo (0..1)
  recRoute: SharedValue<string>;
  recX: SharedValue<number>;
  recY: SharedValue<number>;
  // modulaciones provisionales mientras se arrastra un ajuste (null = las de la escena). El lienzo
  // las usa en el acto, sin esperar a que la escena cambie al soltar
  draftRoutes: SharedValue<Route[] | null>;
};

// entrada de grabación para evaluate(), leída en el hilo de UI
export function recInput(bus: ModBus): { routeId: string; x: number; y: number } | null {
  "worklet";
  const id = bus.recRoute.get();
  return id === "" ? null : { routeId: id, x: bus.recX.get(), y: bus.recY.get() };
}

export function useModBus(): ModBus {
  const time = useSharedValue(0);
  const gateOn = useSharedValue<number | null>(null);
  const gateOff = useSharedValue<number | null>(null);
  const micHitAt = useSharedValue<number | null>(null);
  const recRoute = useSharedValue("");
  const recX = useSharedValue(0.5);
  const recY = useSharedValue(0.5);
  const draftRoutes = useSharedValue<Route[] | null>(null);
  return { time, gateOn, gateOff, micHitAt, recRoute, recX, recY, draftRoutes };
}

// lo que necesita la vista en vivo además del bus: nivel del micrófono y semilla de la escena
export type LiveMod = { bus: ModBus; micLevel: SharedValue<number>; seed: number };
export const LiveModContext = createContext<LiveMod | null>(null);
export const useLiveMod = () => useContext(LiveModContext);
