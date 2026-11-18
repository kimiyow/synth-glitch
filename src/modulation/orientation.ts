// inclinación relativa a una posición neutral, a partir del vector de gravedad en coordenadas del
// teléfono (x a la derecha, y hacia arriba de la pantalla, z hacia el usuario). Funciona igual con
// el teléfono vertical, acostado o en trípode y no sufre bloqueo de cardán cerca de la vertical:
// - lateral (x): cuánto se desplaza la gravedad hacia el borde derecho (inclinar a la derecha → +)
// - frontal (y): cuánto se desplaza en el eje perpendicular a x y a la gravedad neutral (inclinar
//   la parte de arriba alejándola → +)
export type Vec3 = { x: number; y: number; z: number };

// inclinación que da el valor completo (±1): unos 30°
const FULL_SCALE = 0.5;

export function normalize(v: Vec3): Vec3 | null {
  "worklet";
  const n = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return n < 1e-6 ? null : { x: v.x / n, y: v.y / n, z: v.z / n };
}

export function relativeTilt(neutral: Vec3, g: Vec3): { x: number; y: number } {
  "worklet";
  const dx = g.x - neutral.x;
  const dy = g.y - neutral.y;
  const dz = g.z - neutral.z;
  // eje frontal = x̂ × g0 (en el teléfono vertical apunta a −z; acostado, a +y)
  let vx = 0;
  let vy = -neutral.z;
  let vz = neutral.y;
  const n = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (n > 1e-6) {
    vx /= n;
    vy /= n;
    vz /= n;
  }
  const side = dx;
  const front = dx * vx + dy * vy + dz * vz;
  return {
    x: Math.max(-1, Math.min(1, side / FULL_SCALE)),
    y: Math.max(-1, Math.min(1, front / FULL_SCALE)),
  };
}

// zona muerta (sin respuesta cerca del centro) y sensibilidad de una ruta de GIRO
export function shapeTilt(v: number, deadzone: number, sensitivity: number): number {
  "worklet";
  const a = Math.abs(v);
  const dz = Math.min(0.9, Math.max(0, deadzone));
  const out = a <= dz ? 0 : (Math.sign(v) * (a - dz)) / (1 - dz);
  return Math.max(-1, Math.min(1, out * sensitivity));
}
