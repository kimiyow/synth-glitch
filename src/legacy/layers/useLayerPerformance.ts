import { useMemo, useState } from "react";
import { runOnJS, useFrameCallback, useSharedValue } from "react-native-reanimated";

const SAMPLE_WINDOW_MS = 1500;
const MINIMUM_FRAME_RATE = 45;

export function useLayerPerformance(visibleLayerCount: number) {
  const [isPerformanceLow, setIsPerformanceLow] = useState(false);
  const elapsedMs = useSharedValue(0);
  const frameCount = useSharedValue(0);
  const warningShown = useSharedValue(false);

  const frameCallback = useMemo(
    () => {
      const onPerformanceWarning = (isLow: boolean) => {
        setIsPerformanceLow(isLow);
      };

      return (frame: { timeSincePreviousFrame: number | null }) => {
        "worklet";
        const delta = frame.timeSincePreviousFrame;

        if (visibleLayerCount < 2 || delta === null) {
          elapsedMs.set(0);
          frameCount.set(0);
          if (warningShown.get()) {
            warningShown.set(false);
            runOnJS(onPerformanceWarning)(false);
          }
          return;
        }

        elapsedMs.set(elapsedMs.get() + delta);
        frameCount.set(frameCount.get() + 1);
        if (elapsedMs.get() < SAMPLE_WINDOW_MS) {
          return;
        }

        const averageFps = (frameCount.get() * 1000) / elapsedMs.get();
        if (averageFps < MINIMUM_FRAME_RATE && !warningShown.get()) {
          warningShown.set(true);
          runOnJS(onPerformanceWarning)(true);
        } else if (averageFps >= MINIMUM_FRAME_RATE && warningShown.get()) {
          warningShown.set(false);
          runOnJS(onPerformanceWarning)(false);
        }
        elapsedMs.set(0);
        frameCount.set(0);
      };
    },
    [elapsedMs, frameCount, visibleLayerCount, warningShown],
  );

  useFrameCallback(frameCallback, true);

  return visibleLayerCount > 1 && isPerformanceLow;
}
