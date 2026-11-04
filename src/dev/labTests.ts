import type { ComponentType } from "react";

/** Una prueba de testLab: spike, golden image o banco de rendimiento. */
export type LabTest = {
  id: string;
  title: string;
  description: string;
  Component: ComponentType;
};

export const LAB_TESTS: LabTest[] = [];
