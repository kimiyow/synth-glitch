import { AccessibilityInfo, Linking } from "react-native";

import { askConfirm } from "../state/confirm";

// nuestros mensajes ya son causas cortas en español y en mayúsculas (p. ej. "PROYECTO DAÑADO ·
// JSON INVÁLIDO"); lo que no lo es viene del sistema (en inglés y técnico) y se traduce
const OWN_MESSAGE = /^[A-ZÁÉÍÓÚÜÑ0-9 ·.,:;()¿?¡!%/+\-–«»"'.]+$/;

const SYSTEM_CAUSES: readonly [RegExp, string][] = [
  [/space|ENOSPC|disk full|storage/i, "SIN ESPACIO EN EL TELÉFONO · LIBERA ESPACIO Y REINTENTA"],
  [/permission|denied|not authori[sz]ed|unauthori[sz]ed/i, "SIN PERMISO · ACTÍVALO EN AJUSTES"],
  [/memory|out of memory|allocation/i, "SIN MEMORIA SUFICIENTE · CIERRA OTRAS APPS Y REINTENTA"],
  [/not found|no such file|does ?n[o']t exist|ENOENT/i, "NO SE ENCONTRÓ EL ARCHIVO"],
  [/decode|corrupt|invalid image|unsupported/i, "ARCHIVO DAÑADO O EN UN FORMATO NO COMPATIBLE"],
  [/camera|capture/i, "LA CÁMARA NO RESPONDIÓ · REINTENTA"],
  [/network|offline|internet/i, "SIN CONEXIÓN"],
];

// causa corta y en español de un error; el detalle técnico solo va a la consola
export function errorCause(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : String(error);
  const text = raw.replace(/^ERROR · /, "").trim();
  if (text && OWN_MESSAGE.test(text)) return text;
  console.warn("[error]", raw);
  return SYSTEM_CAUSES.find(([pattern]) => pattern.test(text))?.[1] ?? "ALGO SALIÓ MAL · REINTENTA";
}

// muestra el error en la hoja común: título de qué falló, la causa y REINTENTAR cuando aplica. Si
// la causa es un permiso, ofrece abrir Ajustes en lugar de reintentar
export async function reportError(opts: { title: string; error: unknown; retry?: () => unknown }): Promise<void> {
  const cause = errorCause(opts.error);
  const needsSettings = cause.includes("AJUSTES");
  const actions = needsSettings
    ? [{ id: "settings", label: "Abrir Ajustes", icon: "gearshape" as const, variant: "primary" as const }]
    : opts.retry
      ? [{ id: "retry", label: "Reintentar", icon: "arrow.clockwise" as const, variant: "primary" as const }]
      : [];
  const id = await askConfirm({
    section: "ERROR",
    title: opts.title,
    message: sentence(cause),
    actions,
    cancelLabel: actions.length > 0 ? "Cerrar" : "Entendido",
  });
  if (id === "settings") void Linking.openSettings();
  if (id === "retry") void opts.retry?.();
}

// VoiceOver lee los cambios que no mueven el foco (guardado, exportación, escena aplicada…)
export function announce(text: string) {
  AccessibilityInfo.announceForAccessibility(sentence(text));
}

// "SIN ESPACIO · LIBERA ESPACIO" → "Sin espacio. Libera espacio." para leerlo en una hoja o en voz
function sentence(text: string): string {
  return text
    .split(" · ")
    .map((part) => {
      const lower = part.toLocaleLowerCase("es");
      return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
    })
    .join(". ")
    .concat(".")
    .replace(/\.\.$/, ".");
}
