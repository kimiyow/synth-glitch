import type { ComponentType } from "react";

import { EffectsLab } from "./lab/EffectsLab";
import { EnduranceLab } from "./lab/EnduranceLab";
import { ProjectLab } from "./lab/ProjectLab";
import { StackBench } from "./lab/StackBench";
import { StageEnduranceLab } from "./lab/StageEnduranceLab";
import { Sp01Uniforms } from "./spikes/Sp01Uniforms";
import { Sp02SkiaApi } from "./spikes/Sp02SkiaApi";
import { Sp03Stamps } from "./spikes/Sp03Stamps";
import { Sp05Video } from "./spikes/Sp05Video";
import { Sp07Mic } from "./spikes/Sp07Mic";
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
    id: "nfr-10",
    title: "NFR-10 · 50 CICLOS",
    description: "Foto de 12 MP → efectos y trazo → JPG completo → salir, 50 veces; tiempo y memoria",
    Component: EnduranceLab,
  },
  {
    id: "nfr-15",
    title: "NFR-15 · 30 MIN DE ESCENARIO",
    description: "Escena de 3 capas con LFO a pantalla encendida; FPS mínimo y promedio por minuto",
    Component: StageEnduranceLab,
  },
  {
    id: "sp-07",
    title: "SP-07 · MICRÓFONO",
    description: "expo-audio con medición: lectura real cada ~50 ms, nivel en dB y destello por golpe",
    Component: Sp07Mic,
  },
  {
    id: "sp-05",
    title: "SP-05 · VIDEO CON SHADER",
    description: "useVideo de Skia con VHS encima: giro del clip, tamaño y FPS en Expo Go",
    Component: Sp05Video,
  },
  {
    id: "sp-03",
    title: "SP-03 · PINCEL DE SELLOS",
    description: "Sellos dibujados en vivo en una superficie fuera de pantalla desde el hilo de UI",
    Component: Sp03Stamps,
  },
  {
    id: "m2-projects",
    title: "M2 · PROYECTOS DE PRUEBA",
    description: "Crea proyectos con la imagen de prueba y efectos al azar para probar la Galería",
    Component: ProjectLab,
  },
  {
    id: "sp-11",
    title: "SP-11 · GUARDADO ATÓMICO",
    description: "Escritura con temporal + renombrado, recuperación tras un corte y 400 trazos ≤ 150 ms",
    Component: Sp11Storage,
  },
  {
    id: "m1-effects",
    title: "M1 · EFECTOS Y GENERADORES",
    description: "Los 7 efectos y los 3 generadores (M8); toca uno para ajustar X/Y con el dedo",
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
