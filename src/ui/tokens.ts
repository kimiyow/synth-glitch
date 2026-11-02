import { StyleSheet } from "react-native";

export const colors = {
  ink: "#000000",
  inkSurface: "rgba(0,0,0,0.86)",
  inkText: "#FFFFFF",
  inkMute: "#A0A0A0",
  inkLine: "rgba(255,255,255,0.16)",
  inkLineStrong: "rgba(255,255,255,0.40)",
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

export const geometry = {
  compactMargin: 16,
  regularMargin: 32,
  target: 44,
  hairline: StyleSheet.hairlineWidth,
} as const;
