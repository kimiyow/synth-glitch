import { StyleSheet } from "react-native";

/**
 * Identidad (4.4): blanco y negro, sin color de acento (S4). Lo activo se resalta
 * invirtiendo: pastilla blanca con texto negro.
 */
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
} as const;

export const type = {
  family: "Helvetica Neue",
  display: 34,
  title: 20,
  body: 15,
  label: 11,
  micro: 9,
  data: 11,
} as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const geometry = {
  compactMargin: 16,
  regularMargin: 32,
  target: 44,
  hairline: StyleSheet.hairlineWidth,
} as const;
