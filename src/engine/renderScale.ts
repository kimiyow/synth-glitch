/**
 * Resolución dinámica (STG-02, 3.4): `renderScale` de 0.5 a 1 según el tiempo de cuadro.
 * Baja un paso si el promedio supera el presupuesto durante 1.5 s; sube un paso si va
 * holgado durante 5 s (la histéresis evita que oscile). Pura: la llama un sondeo en JS.
 */
export const RENDER_SCALE_STEPS = [0.5, 0.75, 1] as const;
export const SLOW_FRAME_MS = 18;
export const FAST_FRAME_MS = 14;
export const SLOW_FOR_MS = 1500;
export const FAST_FOR_MS = 5000;

export type RenderScaleState = { scale: number; slowMs: number; fastMs: number };
export const FULL_SCALE: RenderScaleState = { scale: 1, slowMs: 0, fastMs: 0 };

function stepIndex(scale: number): number {
  const i = RENDER_SCALE_STEPS.findIndex((s) => s >= scale - 1e-6);
  return i < 0 ? RENDER_SCALE_STEPS.length - 1 : i;
}

export function stepRenderScale(prev: RenderScaleState, avgFrameMs: number, dtMs: number): RenderScaleState {
  const i = stepIndex(prev.scale);
  if (avgFrameMs > SLOW_FRAME_MS) {
    const slowMs = prev.slowMs + dtMs;
    if (slowMs >= SLOW_FOR_MS && i > 0) return { scale: RENDER_SCALE_STEPS[i - 1], slowMs: 0, fastMs: 0 };
    return { scale: prev.scale, slowMs, fastMs: 0 };
  }
  if (avgFrameMs < FAST_FRAME_MS) {
    const fastMs = prev.fastMs + dtMs;
    if (fastMs >= FAST_FOR_MS && i < RENDER_SCALE_STEPS.length - 1) return { scale: RENDER_SCALE_STEPS[i + 1], slowMs: 0, fastMs: 0 };
    return { scale: prev.scale, slowMs: 0, fastMs };
  }
  return { scale: prev.scale, slowMs: 0, fastMs: 0 };
}
