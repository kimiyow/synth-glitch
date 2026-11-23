import type { SkImage, SkSurface } from "@shopify/react-native-skia";
import { Skia } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { runOnUI, useSharedValue } from "react-native-reanimated";

import { drawMaskStamp, drawOriginal, drawStamp, paintBufferSize, replayMask, replayStrokes } from "../paint/brushEngine";
import type { Stamp, Stroke } from "../domain/types";

let empty: SkImage | null = null;

// máscara sin sellos (1×1 transparente): el nodo de pintura nunca recibe una imagen nula
export function emptyMask(): SkImage {
  if (!empty) {
    const surface = Skia.Surface.Make(1, 1);
    if (!surface) throw new Error("NO SE PUDO CREAR LA MÁSCARA");
    surface.getCanvas().clear(Skia.Color("transparent"));
    empty = surface.makeImageSnapshot();
  }
  return empty;
}

type Checkpoint = { count: number; lastId: string; image: SkImage };
const CHECKPOINT_EVERY = 10;

// buffer de pintura en el hilo de UI. Se sincroniza con los trazos del store: un trazo recién
// pintado no se vuelve a dibujar; deshacer, rehacer o abrir reproducen desde el punto de control
// más cercano (cada 10 trazos)
export function usePaintBuffer(original: SkImage | null, mediaW: number, mediaH: number, strokes: readonly Stroke[]) {
  const surface = useSharedValue<SkSurface | null>(null);
  const shown = useSharedValue<SkImage | null>(null);
  const drawnIds = useSharedValue<string[]>([]);
  const checkpoints = useSharedValue<Checkpoint[]>([]);
  const preStroke = useSharedValue<SkImage | null>(null);
  // máscara de los sellos (para pintar sobre un generador en replace)
  const maskSurface = useSharedValue<SkSurface | null>(null);
  const mask = useSharedValue<SkImage>(emptyMask());
  const preStrokeMask = useSharedValue<SkImage | null>(null);
  // el trazo en vivo ya está en el buffer y se está confirmando en el store
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
        // el trazo recién pintado ya está dibujado
        liveCommitted.set(false);
      } else if (k === drawn.length) {
        replayStrokes(s, original, items, k); // rehacer o trazos nuevos
      } else {
        // deshacer o cambio en medio: desde el punto de control válido más cercano
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

      // la máscara solo tiene rectángulos: se rehace entera, sin puntos de control
      let m = maskSurface.get();
      if (!m) {
        m = Skia.Surface.MakeOffscreen(size.width, size.height);
        if (!m) return;
        maskSurface.set(m);
      }
      replayMask(m, items);
      mask.set(m.makeImageSnapshot());
    })(list);
    // strokes cambia de identidad en cada render; basta con los ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original, idsKey]);

  const beginStroke = () => {
    "worklet";
    const s = surface.get();
    if (s) preStroke.set(s.makeImageSnapshot());
    const m = maskSurface.get();
    if (m) preStrokeMask.set(m.makeImageSnapshot());
  };

  const addStamps = (stamps: Stamp[]) => {
    "worklet";
    const s = surface.get();
    if (!s || !original || stamps.length === 0) return;
    for (const stamp of stamps) drawStamp(s, original, stamp);
    s.flush();
    shown.set(s.makeImageSnapshot());
    const m = maskSurface.get();
    if (m) {
      for (const stamp of stamps) drawMaskStamp(m, stamp);
      m.flush();
      mask.set(m.makeImageSnapshot());
    }
  };

  // un segundo dedo cancela el trazo: se restaura la instantánea previa
  const cancelStroke = () => {
    "worklet";
    const s = surface.get();
    const before = preStroke.get();
    if (!s || !before) return;
    s.getCanvas().drawImage(before, 0, 0);
    s.flush();
    shown.set(s.makeImageSnapshot());
    const m = maskSurface.get();
    const maskBefore = preStrokeMask.get();
    if (m && maskBefore) {
      m.getCanvas().clear(Skia.Color("transparent"));
      m.getCanvas().drawImage(maskBefore, 0, 0);
      m.flush();
      mask.set(m.makeImageSnapshot());
    }
  };

  // el buffer se llena en el hilo de UI un momento después de montar; si el nodo de pintura se monta
  // antes, Skia deja la escena en negro hasta el siguiente render. Se monta cuando ya hay buffer
  // (se consulta desde JS: avisar desde el hilo de UI cerraba Expo Go)
  const [builtFor, setBuiltFor] = useState<SkImage | null>(null);
  useEffect(() => {
    if (!original) return;
    const id = setInterval(() => {
      if (shown.get() === null) return;
      clearInterval(id);
      setBuiltFor(original);
    }, 30);
    return () => clearInterval(id);
  }, [original, shown]);

  return { shown, mask, beginStroke, addStamps, cancelStroke, liveCommitted, ready: original !== null && builtFor === original };
}
