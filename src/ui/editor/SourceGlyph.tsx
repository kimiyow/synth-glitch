import { Canvas, Line, Path, Skia, vec } from "@shopify/react-native-skia";
import { useMemo } from "react";

import type { Route, SourceConfig } from "../../domain/types";
import { adsrValue, DEFAULT_MIC_ROUTE, hash01, lfoValue, routeLfo, routeSeq, routeSh, seqValue, shValue } from "../../modulation/sources";
import { colors } from "../tokens";

const SAMPLES = 96;

// forma de la señal de una modulación, calculada con las mismas funciones del motor. Bipolar =
// centrada (LFO, azar); el resto va de abajo (0) a arriba (1)
function samples(route: Route, scene: SourceConfig): { values: number[]; bipolar: boolean } {
  const out: number[] = [];
  const at = (n: number, f: (u: number) => number) => {
    for (let i = 0; i < n; i++) out.push(f(i / (n - 1)));
  };
  switch (route.source) {
    case "lfo": {
      // dos ciclos, sin importar la velocidad
      const lfo = { ...routeLfo(route, scene), rateHz: 1, sync: false };
      at(SAMPLES, (u) => lfoValue(lfo, 60, u * 2, 7));
      return { values: out, bipolar: true };
    }
    case "sh": {
      const sh = routeSh(route, scene);
      // 8 saltos a 60 BPM
      at(SAMPLES, (u) => shValue(sh, 60, u * 8 * sh.division, 7));
      return { values: out, bipolar: true };
    }
    case "seq": {
      const seq = routeSeq(route, scene);
      const len = seq.steps.length * seq.division;
      at(SAMPLES, (u) => seqValue(seq, 60, Math.min(u, 0.999) * len, 7));
      return { values: out, bipolar: false };
    }
    case "adsr": {
      const a = route.settings?.adsr ?? scene.adsr;
      const off = a.attack + a.decay + 0.4;
      const end = off + a.release + 0.1;
      at(SAMPLES, (u) => adsrValue(a, u * end, 0, off));
      return { values: out, bipolar: false };
    }
    case "tempo":
      at(SAMPLES, (u) => (u * 4) % 1);
      return { values: out, bipolar: false };
    case "orientation":
      // una inclinación de ida y vuelta, suave
      at(SAMPLES, (u) => Math.sin(u * Math.PI * 2) * 0.7);
      return { values: out, bipolar: true };
    case "track": {
      // recorrido horizontal del gesto grabado (plano si aún no hay)
      const s = route.settings?.gesture?.samples ?? [];
      const frames = Math.floor(s.length / 2);
      if (frames < 2) return { values: [0.5, 0.5], bipolar: false };
      at(SAMPLES, (u) => s[Math.min(frames - 1, Math.floor(u * (frames - 1))) * 2]);
      return { values: out, bipolar: false };
    }
    case "mic": {
      const m = route.settings?.mic ?? DEFAULT_MIC_ROUTE;
      if (m.mode === "hit") {
        // golpes cada 1/3 del ancho que decaen según la duración
        at(SAMPLES, (u) => Math.max(0, 1 - ((u * 3) % 1) / Math.max(0.05, m.decay)));
      } else {
        at(SAMPLES, (u) => Math.min(1, (0.25 + 0.5 * hash01(3, Math.floor(u * 24)) * Math.abs(Math.sin(u * 9))) * m.gain));
      }
      return { values: out, bipolar: false };
    }
    default:
      return { values: [0, 0], bipolar: false };
  }
}

export function SourceGlyph({ route, scene, width, height }: { route: Route; scene: SourceConfig; width: number; height: number }) {
  const path = useMemo(() => {
    const { values, bipolar } = samples(route, scene);
    const pad = 2;
    const h = height - pad * 2;
    const y = (v: number) => pad + (bipolar ? (1 - (v + 1) / 2) * h : (1 - v) * h);
    const b = Skia.PathBuilder.Make();
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * width;
      if (i === 0) b.moveTo(x, y(v));
      else b.lineTo(x, y(v));
    });
    return { p: b.detach(), mid: bipolar ? height / 2 : height - pad };
  }, [route, scene, width, height]);

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Line p1={vec(0, path.mid)} p2={vec(width, path.mid)} color={colors.inkLine} strokeWidth={1} />
      <Path path={path.p} style="stroke" strokeWidth={1.5} strokeJoin="round" color={colors.inkText} />
    </Canvas>
  );
}
