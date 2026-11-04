import type { ComponentType } from "react";

import { EffectsLab } from "./lab/EffectsLab";
import { StackBench } from "./lab/StackBench";
import { Sp01Uniforms } from "./spikes/Sp01Uniforms";
import { Sp02SkiaApi } from "./spikes/Sp02SkiaApi";
import { Sp11Storage } from "./spikes/Sp11Storage";

/** Una prueba de testLab: spike, golden image o banco de rendimiento. */
export type LabTest = {
  id: string;
  title: string;
  description: string;
  Component: ComponentType;
};

export const LAB_TESTS: LabTest[] = [
  {
    id: "sp-11",
    title: "SP-11 · GUARDADO ATÓMICO",
    description: "Escritura con temporal + renombrado, recuperación tras un corte y 400 trazos ≤ 150 ms",
    Component: Sp11Storage,
  },
  {
    id: "m1-effects",
    title: "M1 · EFECTOS",
    description: "Los 7 efectos sobre la imagen de prueba; toca uno para ajustar X/Y con el dedo",
    Component: EffectsLab,
  },
  {
    id: "sp-04",
    title: "SP-04 · PILA DE CAPAS",
    description: "FPS con 1-8 capas reales, costo estimado y preview = exportación",
    Component: StackBench,
  },
  {
    id: "sp-01",
    title: "SP-01 · UNIFORMS Y 12 MP",
    description: "Gesto → valores compartidos → uniforms con 1-8 capas; drawAsImage a 4000×3000",
    Component: Sp01Uniforms,
  },
  {
    id: "sp-02",
    title: "SP-02 · API DE SKIA",
    description: "drawAsImage, readPixels, encodeToBytes, MakeOffscreen, makeNonTextureImage",
    Component: Sp02SkiaApi,
  },
];
