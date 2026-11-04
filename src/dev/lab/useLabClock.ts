import { useFrameCallback, useSharedValue } from "react-native-reanimated";

/** Reloj en segundos en el hilo de UI. */
export function useLabClock() {
  const time = useSharedValue(0);
  useFrameCallback((info) => {
    time.set(info.timeSinceFirstFrame / 1000);
  });
  return time;
}
