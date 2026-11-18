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
};

export function useModBus(): ModBus {
  const time = useSharedValue(0);
  const gateOn = useSharedValue<number | null>(null);
  const gateOff = useSharedValue<number | null>(null);
  const micHitAt = useSharedValue<number | null>(null);
  return { time, gateOn, gateOff, micHitAt };
}

// lo que necesita la vista en vivo además del bus: nivel del micrófono y semilla de la escena
export type LiveMod = { bus: ModBus; micLevel: SharedValue<number>; seed: number };
export const LiveModContext = createContext<LiveMod | null>(null);
export const useLiveMod = () => useContext(LiveModContext);
