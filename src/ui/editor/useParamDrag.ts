import { useRef } from "react";

import { setLayerParams } from "../../actions/sceneEdits";
import { sceneStore } from "../../state/activeScene";

type Params = { x: number; y: number };

const currentParams = (layerId: string) =>
  sceneStore.getState().project?.scene.layers.find((l) => l.id === layerId)?.params;

// deslizador de parámetro: vista previa sin historial mientras se arrastra (cada 60 ms como mucho)
// y un solo cambio deshacible al soltar
export function useParamDrag() {
  const start = useRef<Params | null>(null);
  const pending = useRef<{ layerId: string; params: Params } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (p) setLayerParams(p.layerId, p.params, null);
  };

  const onParamStart = (layerId: string) => {
    const params = currentParams(layerId);
    start.current = params ? { ...params } : null;
  };

  const onParam = (layerId: string, axis: "x" | "y", value: number) => {
    const base = pending.current?.params ?? currentParams(layerId);
    if (!base) return;
    pending.current = { layerId, params: { ...base, [axis]: value } };
    if (!timer.current) timer.current = setTimeout(flush, 60);
  };

  const onParamEnd = (layerId: string) => {
    flush();
    const from = start.current;
    const now = currentParams(layerId);
    start.current = null;
    if (!from || !now || (from.x === now.x && from.y === now.y)) return;
    const final = { ...now };
    // se vuelve al valor inicial sin historial y se confirma el final como un solo cambio
    setLayerParams(layerId, from, null);
    setLayerParams(layerId, final, "ajustar efecto");
  };

  return { onParamStart, onParam, onParamEnd };
}
