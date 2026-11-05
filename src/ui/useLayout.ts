import { useWindowDimensions } from "react-native";

/** Ancho máximo de paneles y hojas en iPad; más ancho, los deslizadores quedan larguísimos. */
export const PANEL_MAX_WIDTH = 640;
/** Ancho máximo de bloques de contenido centrado (editor vacío, formularios). */
export const CONTENT_MAX_WIDTH = 440;

/** 4.4: compacto (< 600 pt, iPhone) y regular (≥ 600 pt, iPad). */
export function useLayout() {
  const { width } = useWindowDimensions();
  const regular = width >= 600;

  return {
    regular,
    margin: regular ? 32 : 16,
    scale: regular ? 1.15 : 1,
    /** Ancho de un panel flotante en iPad; en iPhone los paneles ocupan todo el ancho. */
    panelWidth: regular ? Math.min(PANEL_MAX_WIDTH, width - 64) : width,
    /** Relleno lateral para centrar una fila de PANEL_MAX_WIDTH (barra de herramientas). */
    sideInset: regular ? Math.max(0, (width - PANEL_MAX_WIDTH) / 2) : 0,
  };
}

/**
 * Orientaciones para `Modal`: en iOS su valor por defecto es solo vertical, lo que obligaría
 * a girar el iPad. El iPhone ya está bloqueado en vertical desde la raíz.
 */
export const ALL_ORIENTATIONS = ["portrait", "portrait-upside-down", "landscape-left", "landscape-right"] as const;
