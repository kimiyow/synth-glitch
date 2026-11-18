import type { SkImage } from "@shopify/react-native-skia";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  rerollSeed,
  resetLayer,
  setBlend,
  setRouteAmount,
  setRouteSource,
  setSources,
  setTempo,
} from "../../actions/sceneEdits";
import type { Layer, Project } from "../../domain/types";
import { EFFECT_BY_ID, GENERATOR_BY_ID } from "../../engine/registry";
import { hasFastLuminanceRoute } from "../../modulation/safety";
import { MAX_STROKES } from "../../paint/strokeInterpolate";
import { EffectThumb } from "../../render/EffectThumb";
import { sceneStore, useScene } from "../../state/activeScene";
import { colors, type } from "../tokens";
import { BrushPanel } from "./BrushPanel";
import { EffectsPanel, THUMB_SIZE, type TileRef } from "./EffectsPanel";
import { ExportPanel } from "./ExportPanel";
import { ModPanel } from "./ModPanel";
import { PanelSheet } from "./PanelSheet";
import type { PanelId } from "./panels";
import { PresetsPanel } from "./PresetsPanel";
import { useParamDrag } from "./useParamDrag";
import type { useExportJob } from "./useExportJob";

type Props = {
  panel: PanelId;
  project: Project;
  image: SkImage | null;
  selected: Layer | null;
  brush: Omit<ComponentProps<typeof BrushPanel>, "strokes" | "maxStrokes">;
  mic: ComponentProps<typeof ModPanel>["mic"];
  onMicVisible: (visible: boolean) => void;
  onTile: (tile: TileRef) => void;
  onRemove: (layerId: string) => void;
  onToggleMod: () => void;
  exports: ReturnType<typeof useExportJob>;
  onImportRecipe: () => void;
};

// el panel abierto del editor dentro de su hoja flotante
export function EditorPanels(props: Props) {
  const { panel, project, selected, exports } = props;
  const readOnly = useScene((s) => s.readOnly);
  const saveStatus = useScene((s) => s.saveStatus);
  const draft = useScene((s) => s.draft);
  const paramDrag = useParamDrag();
  const { layers, routes, sources, seed } = project.scene;

  return (
    <PanelSheet>
      {panel === "brush" ? (
        <BrushPanel {...props.brush} strokes={project.scene.paint.strokes.length} maxStrokes={MAX_STROKES} />
      ) : panel === "effects" ? (
        <EffectsPanel
          layers={layers}
          selectedLayerId={selected?.id ?? null}
          warning={hasFastLuminanceRoute(layers, routes, sources) ? "AVISO · DESTELLOS RÁPIDOS (> 3 HZ) SOBRE UNA ZONA AMPLIA" : null}
          renderThumb={(layer) => <EffectThumb image={props.image} layer={layer} seed={seed} size={THUMB_SIZE} />}
          onTile={props.onTile}
          onRemove={props.onRemove}
          onReset={resetLayer}
          onBlend={setBlend}
          onSeed={rerollSeed}
          {...paramDrag}
          onModulate={props.onToggleMod}
        />
      ) : panel === "mod" ? (
        <ModPanel
          layer={
            selected
              ? {
                  id: selected.id,
                  label: selected.kind === "effect" ? EFFECT_BY_ID[selected.effect].label : GENERATOR_BY_ID[selected.generator].label,
                }
              : null
          }
          routes={routes}
          mic={props.mic}
          onMicVisible={props.onMicVisible}
          onRouteSource={setRouteSource}
          onRouteAmount={setRouteAmount}
          sources={sources}
          onSources={setSources}
          onTempo={setTempo}
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
