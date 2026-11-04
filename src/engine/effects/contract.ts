/**
 * Cabecera común de los efectos globales (SDD 6.2). Todos declaran el contrato
 * completo aunque no usen cada uniform, para que el render graph los trate igual.
 */
export const EFFECT_HEADER = `
uniform shader image;
uniform float2 resolution;
uniform float2 param;
uniform float time;
uniform float seed;
`;

export const UNIFORM_NAMES = ["resolution", "param", "time", "seed"] as const;
