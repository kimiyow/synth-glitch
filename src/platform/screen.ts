import { getBrightnessAsync, setBrightnessAsync } from "expo-brightness";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect } from "react";
import { AppState } from "react-native";

/**
 * Modo escenario (3.12, SP-12): pantalla siempre encendida y brillo al máximo. En iOS el
 * brillo que fija la app se mantiene aunque se salga de ella (hasta bloquear el teléfono),
 * así que se guarda el anterior y se restaura al salir y al pasar a segundo plano.
 */
export function useStageScreen(): void {
  useKeepAwake("synthvj-stage");

  useEffect(() => {
    let previous: number | null = null;
    let alive = true;
    const raise = () => {
      void setBrightnessAsync(1).catch(() => {});
    };
    const restore = () => {
      if (previous !== null) void setBrightnessAsync(previous).catch(() => {});
    };

    void getBrightnessAsync()
      .then((b) => {
        previous = b;
        if (alive) raise();
      })
      .catch(() => {});

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") raise();
      else restore();
    });
    return () => {
      alive = false;
      sub.remove();
      restore();
    };
  }, []);
}
