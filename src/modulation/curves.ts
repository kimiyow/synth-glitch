import type { RouteCurve } from "../state/types";

/** Curva sobre 0..1 (3.5). */
export function curve01(c: RouteCurve, u: number): number {
  "worklet";
  const x = Math.min(1, Math.max(0, u));
  if (c === "exp") return (Math.exp(3 * x) - 1) / (Math.exp(3) - 1);
  if (c === "log") return Math.log(1 + 19 * x) / Math.log(20);
  if (c === "scurve") return x * x * (3 - 2 * x);
  return x;
}

/** Curva para fuentes bipolares (-1..1): se aplica a la magnitud y conserva el signo. */
export function curveSigned(c: RouteCurve, v: number): number {
  "worklet";
  return Math.sign(v) * curve01(c, Math.abs(v));
}
