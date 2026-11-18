import { createContext, useContext } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

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
  // GIRO: inclinación filtrada (-1..1), contador para recalibrar la neutral y si hay sensor (1/0)
  oriX: SharedValue<number>;
  oriY: SharedValue<number>;
  oriCalibrate: SharedValue<number>;
  oriAvailable: SharedValue<number>;
};

export function oriInput(bus: ModBus): { x: number; y: number } {
  "worklet";
  return { x: bus.oriX.get(), y: bus.oriY.get() };
}

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
  const oriX = useSharedValue(0);
  const oriY = useSharedValue(0);
  const oriCalibrate = useSharedValue(0);
  const oriAvailable = useSharedValue(1);
  return { time, gateOn, gateOff, micHitAt, recRoute, recX, recY, oriX, oriY, oriCalibrate, oriAvailable };
}

// lo que necesita la vista en vivo además del bus: nivel del micrófono y semilla de la escena
export type LiveMod = { bus: ModBus; micLevel: SharedValue<number>; seed: number };
export const LiveModContext = createContext<LiveMod | null>(null);
export const useLiveMod = () => useContext(LiveModContext);
