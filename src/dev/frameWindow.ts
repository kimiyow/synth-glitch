/**
 * Acumulador de tiempos de cuadro para el HUD. Funciones puras y marcadas como
 * worklet para usarse en el hilo de UI y en el de JS.
 */
export type FrameWindow = {
  start: number;
  frames: number;
  sumMs: number;
  maxMs: number;
};

export type FrameSummary = {
  fps: number;
  avgMs: number;
  maxMs: number;
};

export const FRAME_WINDOW_MS = 500;

export function emptyFrameWindow(start: number): FrameWindow {
  "worklet";
  return { start, frames: 0, sumMs: 0, maxMs: 0 };
}

export function addFrame(window: FrameWindow, frameMs: number): FrameWindow {
  "worklet";
  return {
    start: window.start,
    frames: window.frames + 1,
    sumMs: window.sumMs + frameMs,
    maxMs: Math.max(window.maxMs, frameMs),
  };
}

/** Devuelve el resumen si la ventana ya cubre `windowMs`; si no, `null`. */
export function summarizeIfDue(
  window: FrameWindow,
  now: number,
  windowMs: number = FRAME_WINDOW_MS,
): FrameSummary | null {
  "worklet";
  const elapsed = now - window.start;
  if (elapsed < windowMs || window.frames === 0) {
    return null;
  }
  return {
    fps: (window.frames * 1000) / elapsed,
    avgMs: window.sumMs / window.frames,
    maxMs: window.maxMs,
  };
}
