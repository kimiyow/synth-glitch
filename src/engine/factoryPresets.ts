import type { Route, RouteSettings, ScenePreset, SourceId } from "../domain/types";
import { DEFAULT_SOURCES } from "../modulation/sources";

// presets de escena de fábrica: tres puntos de partida (nostalgia, ruptura y ritmo). Todas sus
// fuentes periódicas quedan por debajo de 3 Hz a 120 BPM

const route = (id: string, layerId: string, param: "x" | "y", source: SourceId, amount: number, settings: RouteSettings, mode: Route["mode"] = "add"): Route => ({
  id,
  source,
  sourceIndex: 0,
  target: { layerId, param },
  amount,
  curve: "lin",
  mode,
  settings,
});

export const FACTORY_PRESETS: readonly ScenePreset[] = [
  {
    id: "f-cinta",
    name: "Cinta vieja",
    builtIn: true,
    sources: DEFAULT_SOURCES,
    layers: [
      { kind: "effect", id: "f-cinta-vhs", effect: "vhs", params: { x: 0.35, y: 0.45 }, visible: true },
      { kind: "effect", id: "f-cinta-scan", effect: "scanlines", params: { x: 0.4, y: 0.25 }, visible: true },
    ],
    routes: [
      // el tracking se desajusta a saltos lentos; las líneas respiran
      route("f-cinta-r1", "f-cinta-vhs", "y", "sh", 0.3, { sh: { division: 2, slew: 0.5, sync: true, rateHz: 2 } }),
      route("f-cinta-r2", "f-cinta-scan", "x", "lfo", 0.2, { lfo: { ...DEFAULT_SOURCES.lfo, shape: "sine", rateHz: 0.3 } }),
    ],
  },
  {
    id: "f-glitch",
    name: "Glitch",
    builtIn: true,
    sources: DEFAULT_SOURCES,
    layers: [
      { kind: "effect", id: "f-glitch-mosh", effect: "datamosh", params: { x: 0.35, y: 0.4 }, visible: true },
      { kind: "effect", id: "f-glitch-chroma", effect: "chromatic", params: { x: 0.3, y: 0.2 }, visible: true },
    ],
    routes: [
      // el desplazamiento sigue una secuencia rota; el color se separa al azar en cada pulso
      route(
        "f-glitch-r1",
        "f-glitch-mosh",
        "y",
        "seq",
        0.8,
        { seq: { steps: [0.9, 0.1, 0.6, 0.1, 1, 0.2, 0.4, 0], division: 1, direction: "forward" } },
        "replace",
      ),
      route("f-glitch-r2", "f-glitch-chroma", "x", "sh", 0.4, { sh: { division: 1, slew: 0.1, sync: true, rateHz: 2 } }),
    ],
  },
  {
    id: "f-pulso",
    name: "Pulso",
    builtIn: true,
    sources: DEFAULT_SOURCES,
    layers: [
      { kind: "effect", id: "f-pulso-crt", effect: "crt", params: { x: 0.25, y: 0.5 }, visible: true },
      { kind: "effect", id: "f-pulso-wave", effect: "wave", params: { x: 0.25, y: 0.3 }, visible: true },
    ],
    routes: [
      // la onda late con cada tiempo; la curvatura va y viene cada 4 tiempos
      route("f-pulso-r1", "f-pulso-wave", "x", "tempo", 0.4, {}),
      route("f-pulso-r2", "f-pulso-crt", "x", "lfo", 0.3, { lfo: { ...DEFAULT_SOURCES.lfo, shape: "triangle", sync: true, division: 4 } }),
    ],
  },
];
