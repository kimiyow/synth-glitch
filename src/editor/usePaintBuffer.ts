import type { SkImage, SkSurface } from "@shopify/react-native-skia";
import { Skia } from "@shopify/react-native-skia";
import { useEffect } from "react";
import { runOnUI, useSharedValue } from "react-native-reanimated";

import { drawOriginal, drawStamp, paintBufferSize, replayStrokes } from "../paint/brushEngine";
import type { Stamp, Stroke } from "../state/types";

type Checkpoint = { count: number; lastId: string; image: SkImage };
const CHECKPOINT_EVERY = 10;

/**
 * Buffer de pintura en el hilo de UI (3.4, 3.6). Se sincroniza con los trazos del store:
 * un trazo recién pintado no se vuelve a dibujar; deshacer, rehacer o abrir reproducen
 * desde el punto de control más cercano (cada 10 trazos).
 */
export function usePaintBuffer(original: SkImage | null, mediaW: number, mediaH: number, strokes: readonly Stroke[]) {
  const surface = useSharedValue<SkSurface | null>(null);
  const shown = useSharedValue<SkImage | null>(null);
  const drawnIds = useSharedValue<string[]>([]);
  const checkpoints = useSharedValue<Checkpoint[]>([]);
  const preStroke = useSharedValue<SkImage | null>(null);
  /** El trazo en vivo ya está en el buffer y se está confirmando en el store. */
  const liveCommitted = useSharedValue(false);
  const size = paintBufferSize(mediaW, mediaH);

  const idsKey = strokes.map((s) => s.id).join(",");
  useEffect(() => {
    if (!original) return;
    const list = strokes.map((s) => ({ id: s.id, strokeSeed: s.strokeSeed, stamps: s.stamps }));
    runOnUI((items: Stroke[]) => {
      "worklet";
      let s = surface.get();
      if (!s) {
        s = Skia.Surface.MakeOffscreen(size.width, size.height);
        if (!s) return;
        drawOriginal(s, original);
        surface.set(s);
        drawnIds.set([]);
      }
      const ids = items.map((i) => i.id);
      const drawn = drawnIds.get();
      let k = 0;
      while (k < drawn.length && k < ids.length && drawn[k] === ids[k]) k++;

      if (liveCommitted.get() && k === drawn.length && ids.length === k + 1) {
        // El trazo recién pintado ya está dibujado.
        liveCommitted.set(false);
      } else if (k === drawn.length) {
        replayStrokes(s, original, items, k); // rehacer o trazos nuevos
      } else {
        // Deshacer o cambio en medio: desde el punto de control válido más cercano.
        const valid = checkpoints.get().filter((c) => c.count <= ids.length && c.count > 0 && ids[c.count - 1] === c.lastId);
        const best = valid.reduce<Checkpoint | null>((a, c) => (!a || c.count > a.count ? c : a), null);
        const canvas = s.getCanvas();
        if (best) canvas.drawImage(best.image, 0, 0);
        else drawOriginal(s, original);
        replayStrokes(s, original, items, best ? best.count : 0);
      }
      s.flush();
      drawnIds.set(ids);
      if (ids.length > 0 && ids.length % CHECKPOINT_EVERY === 0) {
        const lastId = ids[ids.length - 1];
        const keep = checkpoints.get().filter((c) => !(c.count === ids.length));
        checkpoints.set([...keep, { count: ids.length, lastId, image: s.makeImageSnapshot() }]);
      }
      shown.set(s.makeImageSnapshot());
    })(list);
    // `strokes` cambia de identidad en cada render; basta con los ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original, idsKey]);

  const beginStroke = () => {
    "worklet";
    const s = surface.get();
    if (s) preStroke.set(s.makeImageSnapshot());
  };

  const addStamps = (stamps: Stamp[]) => {
    "worklet";
    const s = surface.get();
    if (!s || !original || stamps.length === 0) return;
    for (const stamp of stamps) drawStamp(s, original, stamp);
    s.flush();
    shown.set(s.makeImageSnapshot());
  };

  /** Un segundo dedo cancela el trazo (EDT-02): se restaura la instantánea previa. */
  const cancelStroke = () => {
    "worklet";
    const s = surface.get();
    const before = preStroke.get();
    if (!s || !before) return;
    s.getCanvas().drawImage(before, 0, 0);
    s.flush();
    shown.set(s.makeImageSnapshot());
  };

  return { shown, beginStroke, addStamps, cancelStroke, liveCommitted, ready: original !== null };
}
