import { StyleSheet } from "react-native";

// identidad: blanco y negro, sin color de acento. Lo activo se resalta invirtiendo: pastilla blanca
// con texto negro
export const colors = {
  ink: "#000000",
  inkSurface: "#121212",
  inkRaised: "#1E1E1E",
  inkText: "#FFFFFF",
  inkMute: "#9A9A9A",
  inkLine: "rgba(255,255,255,0.12)",
  inkLineStrong: "rgba(255,255,255,0.32)",
  paper: "#FFFFFF",
  paperText: "#000000",
  paperMute: "#5C5C5C",
  paperLine: "rgba(0,0,0,0.16)",
  // velos sobre la imagen: fuerte (cápsulas y avisos sobre el lienzo) y suave (selector de la cámara)
  scrim: "rgba(0,0,0,0.6)",
  scrimSoft: "rgba(0,0,0,0.35)",
  // fondo de las hojas: con 0.9, el peor caso (blanco detrás) queda ≈ #2A2A2A y el gris de texto
  // sigue en ≈ 5:1
  sheet: "rgba(18,18,18,0.9)",
} as const;

export const type = {
  family: "Helvetica Neue",
  display: 34,
  title: 20,
  body: 15,
  // 12 y 11 pt: label para controles y estados; micro (el mínimo de iOS, Caption 2) para
  // etiquetas de sección y notas
  label: 12,
  micro: 11,
  data: 11,
} as const;

// los controles compactos crecen con el texto del sistema solo hasta aquí; más allá se cortarían
export const COMPACT_FONT_SCALE = 1.3;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const geometry = {
  compactMargin: 16,
  regularMargin: 32,
  target: 44,
  hairline: StyleSheet.hairlineWidth,
} as const;
