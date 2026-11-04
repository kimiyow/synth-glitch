/**
 * Filtro One Euro (3.5): poco retraso al moverse y sin temblor en reposo.
 * Estado explícito para usarlo en worklets sin clases.
 */
export type OneEuroState = { x: number; dx: number; t: number } | null;

const alpha = (cutoff: number, dt: number) => {
  "worklet";
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export function oneEuro(
  state: OneEuroState,
  x: number,
  t: number,
  minCutoff = 1.0,
  beta = 0.02,
  dCutoff = 1.0,
): { value: number; state: OneEuroState } {
  "worklet";
  if (state === null || t <= state.t) return { value: x, state: { x, dx: 0, t } };
  const dt = t - state.t;
  const dxRaw = (x - state.x) / dt;
  const dx = state.dx + alpha(dCutoff, dt) * (dxRaw - state.dx);
  const cutoff = minCutoff + beta * Math.abs(dx);
  const value = state.x + alpha(cutoff, dt) * (x - state.x);
  return { value, state: { x: value, dx, t } };
}
