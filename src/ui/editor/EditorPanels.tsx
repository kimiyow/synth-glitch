import type { SkImage } from "@shopify/react-native-skia";
import type { ComponentProps } from "react";

import { applyGesturePreset, ensureGestureRoute, removeGesturePreset, saveGesturePreset } from "../../actions/gestureLibrary";
import { setSources, setTempo } from "../../actions/sceneEdits";
import type { Layer, Project } from "../../domain/types";
import { hasFastLuminanceRoute } from "../../modulation/safety";
import { MAX_STROKES } from "../../paint/strokeInterpolate";
import { EffectThumb } from "../../render/EffectThumb";
import { sceneStore, useScene } from "../../state/activeScene";
import { BrushPanel } from "./BrushPanel";
import { EffectsPanel, THUMB_SIZE, type TileRef } from "./EffectsPanel";
import { ExportPanel } from "./ExportPanel";
import { useGestureRecord } from "./gestureRecord";
import { GesturePanel } from "./GesturePanel";
import { LayerInspector, layerDef } from "./LayerInspector";
import { LayersPanel } from "./LayersPanel";
import { PanelSheet } from "./PanelSheet";
import type { PanelId } from "./panels";
import { PresetsPanel } from "./PresetsPanel";
import type { MicView } from "./SourceEditor";
import { useParamDrag } from "./useParamDrag";
import type { useExportJob } from "./useExportJob";

type Props = {
  panel: PanelId;
  project: Project;
  image: SkImage | null;
  selected: Layer | null;
  brush: Omit<ComponentProps<typeof BrushPanel>, "strokes" | "maxStrokes">;
  mic: MicView;
  onMicVisible: (visible: boolean) => void;
  onTile: (tile: TileRef) => void;
  onSelect: (layerId: string) => void;
  onRemove: (layerId: string) => void;
  onOpenEffects: () => void;
  onNotice: (text: string) => void;
  // cierra el panel (✕)
  onClose: () => void;
  exports: ReturnType<typeof useExportJob>;
  onImportRecipe: () => void;
};

// el panel abierto del editor dentro de su hoja flotante. Efectos y Capas comparten el inspector de
// capa (parámetros y modulaciones)
export function EditorPanels(props: Props) {
  const { panel, project, selected, exports } = props;
  const readOnly = useScene((s) => s.readOnly);
  const saveStatus = useScene((s) => s.saveStatus);
  const draft = useScene((s) => s.draft);
  const paramDrag = useParamDrag();
  const { layers, routes, sources, seed } = project.scene;
  const rec = useGestureRecord();
  // gesto grabado de la capa seleccionada (para "Guardar preset gestual" en Exportar)
  const selectedGesture = selected
    ? routes.find((r) => r.target.layerId === selected.id && r.source === "track" && (r.settings?.gesture?.samples.length ?? 0) >= 4)?.settings?.gesture
    : undefined;
  const warning = hasFastLuminanceRoute(layers, routes, sources) ? "AVISO · DESTELLOS RÁPIDOS (> 3 HZ) SOBRE UNA ZONA AMPLIA" : null;
  const renderInspector = (layer: Layer, onBack: () => void) => (
    <LayerInspector
      key={layer.id}
      layer={layer}
      routes={routes}
      scene={sources}
      mic={props.mic}
      warning={warning}
      onBack={onBack}
      onRemove={props.onRemove}
      onNotice={props.onNotice}
      {...paramDrag}
    />
  );

  return (
    <PanelSheet key={panel} onClose={props.onClose}>
      {panel === "brush" ? (
        <BrushPanel {...props.brush} strokes={project.scene.paint.strokes.length} maxStrokes={MAX_STROKES} />
      ) : panel === "effects" ? (
        <EffectsPanel
          layers={layers}
          selectedLayerId={selected?.id ?? null}
          modulatedIds={new Set(routes.map((r) => r.target.layerId))}
          warning={warning}
          renderThumb={(layer) => <EffectThumb image={props.image} layer={layer} seed={seed} size={THUMB_SIZE} />}
          renderInspector={renderInspector}
          onTile={props.onTile}
        />
      ) : panel === "layers" ? (
        <LayersPanel
          layers={layers}
          routes={routes}
          selectedLayerId={selected?.id ?? null}
          onSelect={props.onSelect}
          renderThumb={(layer, size) => <EffectThumb image={props.image} layer={layer} seed={seed} size={size} />}
          renderInspector={renderInspector}
          onOpenEffects={props.onOpenEffects}
          sources={sources}
          onSources={setSources}
          onTempo={setTempo}
          mic={props.mic}
          onMicVisible={props.onMicVisible}
        />
      ) : panel === "export" ? (
        <ExportPanel
          name={project.name}
          readOnly={readOnly}
          status={saveStatus}
          draft={draft}
          onRename={(name) => sceneStore.getState().rename(name)}
          unavailable={{
            gif: project.scene.media.kind === "clip" ? "SOLO FOTOS" : undefined,
            project: readOnly ? "SOLO LECTURA" : undefined,
            share: exports.lastExport ? undefined : "EXPORTA PRIMERO",
            gesture: readOnly ? "SOLO LECTURA" : selectedGesture ? undefined : "GRABA UN GESTO",
          }}
          job={exports.job}
          onAction={(a) => {
            if (a === "gesture") {
              if (!selectedGesture) return;
              const name = saveGesturePreset(selectedGesture);
              props.onNotice(name ? `${name.toUpperCase()} GUARDADO EN LA BIBLIOTECA` : "BIBLIOTECA LLENA · BORRA UN GESTO");
              return;
            }
            void exports.onExportAction(a);
          }}
        />
      ) : panel === "presets" ? (
        <PresetsPanel
          readOnly={readOnly}
          busy={exports.recipeBusy}
          onImport={props.onImportRecipe}
          onShare={() => void exports.onShareRecipe()}
        />
      ) : (
        <GesturePanel
          layerLabel={selected && !readOnly ? layerDef(selected).label : null}
          scene={sources}
          onRecord={() => {
            if (!selected) return;
            const id = ensureGestureRoute(routes, selected.id);
            if (id) rec?.start(id);
            else props.onNotice("MÁXIMO 4 MODULACIONES POR CAPA");
          }}
          onApply={(preset) => {
            if (!selected) return;
            props.onNotice(applyGesturePreset(routes, selected.id, preset) ? `${preset.name.toUpperCase()} APLICADO` : "MÁXIMO 4 MODULACIONES POR CAPA");
          }}
          onDelete={removeGesturePreset}
        />
      )}
    </PanelSheet>
  );
}


