import type { SkImage } from "@shopify/react-native-skia";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import { setSources, setTempo } from "../../actions/sceneEdits";
import type { Layer, Project } from "../../domain/types";
import { hasFastLuminanceRoute } from "../../modulation/safety";
import { MAX_STROKES } from "../../paint/strokeInterpolate";
import { EffectThumb } from "../../render/EffectThumb";
import { sceneStore, useScene } from "../../state/activeScene";
import { colors, type } from "../tokens";
import { BrushPanel } from "./BrushPanel";
import { EffectsPanel, THUMB_SIZE, type TileRef } from "./EffectsPanel";
import { ExportPanel } from "./ExportPanel";
import { LayerInspector } from "./LayerInspector";
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
            gesture: "PRÓXIMAMENTE",
          }}
          job={exports.job}
          onAction={(a) => void exports.onExportAction(a)}
        />
      ) : panel === "presets" ? (
        <PresetsPanel
          readOnly={readOnly}
          busy={exports.recipeBusy}
          onImport={props.onImportRecipe}
          onShare={() => void exports.onShareRecipe()}
        />
      ) : (
        <View style={styles.pending}>
          <Text style={styles.title}>Gesto</Text>
          <Text style={styles.label}>PRÓXIMAMENTE</Text>
        </View>
      )}
    </PanelSheet>
  );
}

const styles = StyleSheet.create({
  pending: { minHeight: 80, gap: 12 },
  title: { color: colors.inkText, fontFamily: type.family, fontSize: type.body },
  label: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
});
