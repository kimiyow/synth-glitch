import * as Haptics from "expo-haptics";

/** Vibración ligera de interfaz; nunca debe romper la app si no está disponible. */
export function tapFeedback() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function selectFeedback() {
  Haptics.selectionAsync().catch(() => {});
}
