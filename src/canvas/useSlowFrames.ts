import { useEffect, useState } from "react";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";

const POLL_MS = 500;
const SLOW_FRAME_MS = 18;
/** 3 lecturas de 500 ms = 1.5 s seguidos (3.4). */
const SLOW_POLLS = 3;

/**
 * Monitor de tiempo de cuadro (3.4): true si el promedio supera 18 ms durante 1.5 s.
 * Igual que el HUD: el hilo de UI solo suma números y JS los lee.
 */
export function useSlowFrames(): boolean {
  const frames = useSharedValue(0);
  const totalMs = useSharedValue(0);
  const [slow, setSlow] = useState(false);

  useFrameCallback((info) => {
    if (info.timeSincePreviousFrame == null) return;
    frames.set(frames.get() + 1);
    totalMs.set(totalMs.get() + info.timeSincePreviousFrame);
  });

  useEffect(() => {
    let lastFrames = frames.get();
    let lastMs = totalMs.get();
    let streak = 0;
    const id = setInterval(() => {
      const df = frames.get() - lastFrames;
      const avg = df > 0 ? (totalMs.get() - lastMs) / df : 0;
      lastFrames = frames.get();
      lastMs = totalMs.get();
      streak = avg > SLOW_FRAME_MS ? streak + 1 : 0;
      setSlow((prev) => (streak >= SLOW_POLLS ? true : streak === 0 ? false : prev));
    }, POLL_MS);
    return () => clearInterval(id);
  }, [frames, totalMs]);

  return slow;
}
