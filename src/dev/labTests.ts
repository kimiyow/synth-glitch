import type { ComponentType } from "react";

import { Sp01Uniforms } from "./spikes/Sp01Uniforms";
import { Sp02SkiaApi } from "./spikes/Sp02SkiaApi";

/** Una prueba de testLab: spike, golden image o banco de rendimiento. */
export type LabTest = {
  id: string;
  title: string;
  description: string;
  Component: ComponentType;
};

export const LAB_TESTS: LabTest[] = [
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
