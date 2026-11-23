import { drawAsImage, ImageFormat, Skia, type SkImage } from "@shopify/react-native-skia";
import { createElement, memo, useEffect, useState } from "react";
import { Image, PixelRatio, View } from "react-native";

import type { FrameInputs } from "../engine/renderGraph";
import type { Layer } from "../domain/types";
import { colors } from "../ui/tokens";
import { SceneRenderer } from "./SceneRenderer";

// cuadro fijo: las miniaturas no se animan
const STILL: FrameInputs = { time: 0.6, params: [] };
// lado largo de la copia reducida de la foto de la que parten todas las miniaturas
const SOURCE_LONG_SIDE = 256;
// miniaturas renderizadas que se conservan (fichas + filas de capas, con margen)
const CACHE_MAX = 80;
// espera tras el último cambio de parámetros antes de volver a renderizar (al arrastrar)
const DEBOUNCE_MS = 120;

// copia reducida por imagen: 10-15 miniaturas leyendo una foto de 12 MP saturaban la GPU y a veces
// una no llegaba a dibujarse
const small = new WeakMap<SkImage, SkImage>();
const ids = new WeakMap<SkImage, number>();
let nextId = 1;

function smallSource(image: SkImage): SkImage {
  const hit = small.get(image);
  if (hit) return hit;
  const w = image.width();
  const h = image.height();
  const k = Math.min(1, SOURCE_LONG_SIDE / Math.max(w, h, 1));
  const sw = Math.max(1, Math.round(w * k));
  const sh = Math.max(1, Math.round(h * k));
  let out = image;
  const surface = k < 1 ? Skia.Surface.Make(sw, sh) : null;
  if (surface) {
    surface.getCanvas().drawImageRect(image, Skia.XYWHRect(0, 0, w, h), Skia.XYWHRect(0, 0, sw, sh), Skia.Paint());
    surface.flush();
    const snap = surface.makeImageSnapshot();
    out = snap.makeNonTextureImage() ?? snap;
  }
  small.set(image, out);
  return out;
}

function imageId(image: SkImage): number {
  let id = ids.get(image);
  if (id === undefined) {
    id = nextId++;
    ids.set(image, id);
  }
  return id;
}

// caché LRU: clave → data URI del JPEG
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

function remember(key: string, uri: string) {
  cache.delete(key);
  cache.set(key, uri);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function layerKey(layer: Layer): string {
  const kind = layer.kind === "effect" ? `e:${layer.effect}:${layer.blend ?? "replace"}` : `g:${layer.generator}:${layer.blend}:${layer.seed ?? 0}`;
  return `${kind}:${layer.visible ? 1 : 0}:${layer.params.x.toFixed(3)},${layer.params.y.toFixed(3)}`;
}

function thumbKey(image: SkImage, layers: readonly Layer[], seed: number, pw: number, ph: number): string {
  return `${imageId(image)}|${layers.map(layerKey).join("+")}|${seed}|${pw}x${ph}`;
}

function renderThumb(key: string, image: SkImage, layers: readonly Layer[], seed: number, pw: number, ph: number): Promise<string | null> {
  const running = pending.get(key);
  if (running) return running;
  const job = (async () => {
    try {
      const element = createElement(SceneRenderer, { image: smallSource(image), width: pw, height: ph, layers, seed, frame: STILL });
      const rendered = await drawAsImage(element, { width: pw, height: ph });
      if (!rendered) return null;
      try {
        const b64 = rendered.encodeToBase64(ImageFormat.JPEG, 85);
        if (!b64) return null;
        const uri = `data:image/jpeg;base64,${b64}`;
        remember(key, uri);
        return uri;
      } finally {
        rendered.dispose();
      }
    } catch {
      return null;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, job);
  return job;
}

// miniatura de una ficha o de una capa: la imagen del proyecto con esa sola capa
export const EffectThumb = memo(function EffectThumb({ image, layer, seed, size }: { image: SkImage | null; layer: Layer; seed: number; size: number }) {
  return <LayersThumb image={image} layers={[layer]} layerKeyHint={layerKey(layer)} seed={seed} width={size} height={size} />;
});

// miniatura de una escena: la imagen del proyecto con todas sus capas (sin modulación: valores base)
export const SceneThumb = memo(function SceneThumb({
  image,
  layers,
  seed,
  width,
  height,
}: {
  image: SkImage | null;
  layers: readonly Layer[];
  seed: number;
  width: number;
  height: number;
}) {
  return <LayersThumb image={image} layers={layers} layerKeyHint={layers.map(layerKey).join("+")} seed={seed} width={width} height={height} />;
});

// se renderiza fuera de pantalla una vez y se muestra como imagen normal (siempre aparece; sin
// lienzo por miniatura). layerKeyHint evita volver a renderizar cuando solo cambia la identidad
// del arreglo de capas
function LayersThumb({
  image,
  layers,
  layerKeyHint,
  seed,
  width,
  height,
}: {
  image: SkImage | null;
  layers: readonly Layer[];
  layerKeyHint: string;
  seed: number;
  width: number;
  height: number;
}) {
  const ratio = Math.min(3, PixelRatio.get());
  const pw = Math.max(1, Math.round(width * ratio));
  const ph = Math.max(1, Math.round(height * ratio));
  const key = image ? thumbKey(image, layers, seed, pw, ph) : null;
  const [shown, setShown] = useState<{ key: string; uri: string } | null>(null);
  const cached = key ? cache.get(key) : undefined;

  useEffect(() => {
    if (!image || !key || cache.has(key)) return;
    let alive = true;
    // al arrastrar un parámetro la clave cambia seguido: solo se renderiza al detenerse
    const id = setTimeout(() => {
      void renderThumb(key, image, layers, seed, pw, ph).then((uri) => {
        if (alive && uri) setShown({ key, uri });
      });
    }, shown ? DEBOUNCE_MS : 0);
    return () => {
      alive = false;
      clearTimeout(id);
    };
    // las capas y la semilla ya están en la clave
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, image, layerKeyHint]);

  // mientras llega la nueva, se mantiene la anterior (no parpadea al arrastrar)
  const uri = cached ?? shown?.uri;
  if (!uri) return <View style={{ width, height, backgroundColor: colors.inkRaised }} />;
  return <Image source={{ uri }} style={{ width, height }} fadeDuration={0} />;
}
