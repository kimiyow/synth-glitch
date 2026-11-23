import type { SkImage } from "@shopify/react-native-skia";
import type { ComponentProps } from "react";

import {
  applyGesturePreset,
  ensureGestureRoute,
  removeGesturePreset,
  renameGesturePreset,
  saveGestureNotice,
  saveGesturePreset,
} from "../../actions/gestureLibrary";
import { removeModulation, setGestureTransform, setSources, setTempo } from "../../actions/sceneEdits";
import type { StageMode } from "../../canvas/StageView";
import type { GestureClip, Layer, Project, ScenePreset } from "../../domain/types";
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
import { StagePanel } from "./StagePanel";
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
  // fila PINTURA de Capas: abre el pincel
  onOpenBrush: () => void;
  // abre el panel Modulación en la capa y modulación dadas (desde el resumen de Capas o Efectos)
  onOpenMod: (layerId: string, routeId: string | null, fresh: boolean) => void;
  // modulación que el panel Modulación abre al entrar (null = la primera)
  modFocus: { id: string | null; fresh: boolean } | null;
  onNotice: (text: string) => void;
  // cierra el panel (✕) o, si está encima de otro, vuelve a él
  onClose: () => void;
  // panel de abajo cuando este se abrió encima (p. ej. Gesto desde Modulación), o null
  backTo: PanelId | null;
  // entra al modo escenario con el modo elegido
  onStartStage: (mode: StageMode) => void;
  // aplica una escena con la transición elegida
  onTriggerScene: (preset: ScenePreset) => void;
  exports: ReturnType<typeof useExportJob>;
  onImportRecipe: () => void;
  // estela del gesto sobre el lienzo
  trail: { visible: boolean; onToggle: () => void };
  // gesto guardado en vista previa: se dibuja sobre la imagen (null = ninguno)
  onGesturePreview: (clip: GestureClip | null) => void;
};

const PANEL_TITLE: Record<PanelId, string> = {
  brush: "Pincel",
  effects: "Efectos",
  layers: "Capas",
  mod: "Modulación",
  gesture: "Gesto",
  presets: "Escenas",
  export: "Exportar",
  stage: "Escenario",
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
  const gestureRoute = selected
    ? (routes.find((r) => r.target.layerId === selected.id && r.source === "track" && (r.settings?.gesture?.samples.length ?? 0) >= 4) ?? null)
    : null;
  const selectedGesture = gestureRoute?.settings?.gesture;
  const warning = hasFastLuminanceRoute(layers, routes, sources) ? "AVISO · DESTELLOS RÁPIDOS (> 3 HZ) SOBRE UNA ZONA AMPLIA" : null;
  const renderInspector = (layer: Layer, onBack: () => void, focus?: "mod") => (
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
      focus={focus}
      focusRoute={focus === "mod" ? props.modFocus : null}
      onOpenMod={props.onOpenMod}
      {...paramDrag}
    />
  );

  return (
    <PanelSheet key={panel} title={PANEL_TITLE[panel]} onClose={props.onClose} back={props.backTo ? PANEL_TITLE[props.backTo] : null}>
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
      ) : panel === "layers" || panel === "mod" ? (
        <LayersPanel
          startInLayer={panel === "mod"}
          layers={layers}
          paint={project.scene.paint}
          onOpenBrush={props.onOpenBrush}
          onNotice={props.onNotice}
          routes={routes}
          selectedLayerId={selected?.id ?? null}
          onSelect={props.onSelect}
          renderThumb={(layer, size) => <EffectThumb image={props.image} layer={layer} seed={seed} size={size} />}
          renderInspector={panel === "mod" ? (layer, onBack) => renderInspector(layer, onBack, "mod") : renderInspector}
          onOpenEffects={props.onOpenEffects}
          sources={sources}
          onSources={setSources}
          onTempo={setTempo}
          mic={props.mic}
          onMicVisible={props.onMicVisible}
          onRemove={props.onRemove}
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
              props.onNotice(saveGestureNotice(saveGesturePreset(selectedGesture)));
              return;
            }
            void exports.onExportAction(a);
          }}
        />
      ) : panel === "stage" ? (
        <StagePanel onStart={props.onStartStage} />
      ) : panel === "presets" ? (
        <PresetsPanel
          readOnly={readOnly}
          busy={exports.recipeBusy}
          image={props.image}
          seed={seed}
          layers={layers}
          routes={routes}
          sources={sources}
          onSelect={props.onSelect}
          onNotice={props.onNotice}
          onTriggerScene={props.onTriggerScene}
          onImport={props.onImportRecipe}
          onShare={() => void exports.onShareRecipe()}
        />
      ) : (
        <GesturePanel
          layer={selected && !readOnly ? { label: layerDef(selected).label, axes: layerDef(selected).axes, params: selected.params } : null}
          route={readOnly ? null : gestureRoute}
          routes={routes}
          scene={sources}
          onSave={() => {
            if (selectedGesture) props.onNotice(saveGestureNotice(saveGesturePreset(selectedGesture)));
          }}
          trailVisible={props.trail.visible}
          onToggleTrail={props.trail.onToggle}
          onTransform={(patch) => {
            if (gestureRoute) setGestureTransform(gestureRoute.id, patch);
          }}
          onRemove={() => {
            if (!gestureRoute) return;
            removeModulation(gestureRoute.id);
            props.onNotice("GESTO QUITADO · PUEDES DESHACERLO CON ↶");
          }}
          onRecord={() => {
            if (!selected) return;
            const id = ensureGestureRoute(routes, selected.id);
            if (id) rec?.start(id);
            else props.onNotice("MÁXIMO 4 MODULACIONES POR CAPA");
          }}
          onApply={(preset) => {
            if (!selected) return;
            const ok = applyGesturePreset(routes, selected.id, preset);
            props.onNotice(ok ? `${preset.name.toUpperCase()} APLICADO` : "MÁXIMO 4 MODULACIONES POR CAPA");
            // abierto desde Modulación: se vuelve allí, con la tarjeta GESTO ya lista
            if (ok && props.backTo) props.onClose();
          }}
          onRename={(id, name) => void renameGesturePreset(id, name)}
          onPreview={props.onGesturePreview}
          onDelete={removeGesturePreset}
        />
      )}
    </PanelSheet>
  );
}


