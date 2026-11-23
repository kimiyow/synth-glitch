import type { SFSymbol } from "expo-symbols";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GENERATORS } from "../../engine/registry";
import { selectFeedback, tapFeedback } from "../../platform/haptics";
import type { GeneratorId } from "../../domain/types";
import type { ProjectSummary } from "../../project/storage";
import { AppHeader } from "../AppHeader";
import { ProjectCard } from "../gallery/ProjectCard";
import { Button } from "../kit/Button";
import { Icon } from "../kit/Icon";
import { Segmented } from "../kit/Segmented";
import { Toast } from "../kit/Toast";
import { colors, COMPACT_FONT_SCALE, radius, space, type } from "../tokens";
import { CONTENT_MAX_WIDTH, PANEL_MAX_WIDTH, useLayout } from "../useLayout";

export type GenerativeAspect = "9:16" | "1:1" | "4:5";
const ASPECTS: readonly GenerativeAspect[] = ["9:16", "1:1", "4:5"];
const MAX_RECENTS = 8;
const GAP = space.sm;
// en "Crear sin imagen" (formulario angosto)
const FORM_GEN_THUMB = 88;

// qué hace cada generador, en una línea
const GENERATOR_NOTE: Record<GeneratorId, string> = {
  noise: "Grano y nubes",
  bars: "Barras de datos",
  voronoi: "Celdas",
  grid: "Cuadrícula de líneas",
  checker: "Casillas que parpadean",
  rings: "Círculos que se expanden",
};

type Props = {
  busy: boolean;
  message: string | null;
  // proyectos guardados, del más reciente al más antiguo
  recents: ProjectSummary[];
  onImport: () => void;
  onCamera: () => void;
  onOpenRecent: (project: ProjectSummary) => void;
  onSeeAll: () => void;
  // crea un proyecto generativo con el aspecto y el generador elegidos; animado = generador en vivo
  // con una modulación LFO
  onCreate: (aspect: GenerativeAspect, generator: GeneratorId, animated: boolean) => void;
  // miniatura de un generador al tamaño dado (vive en editor/, que sí conoce Skia)
  renderGeneratorThumb: (generator: GeneratorId, size: number) => ReactNode;
  onDismissMessage: () => void;
};

// editor sin proyecto: una sola columna con los modos de empezar en orden de jerarquía. Con una
// imagen (Fotos, la principal, y Cámara) y sin imagen (los tres generadores), todos como tarjetas
// del mismo sistema; al final, los recientes. En iPad es la misma columna, más ancha
export function EditorEmpty(props: Props) {
  const { busy, message, recents, onImport, onCamera, onOpenRecent, onSeeAll, renderGeneratorThumb, onDismissMessage } = props;
  // generador con el que se abre "Crear sin imagen"; null = pantalla de inicio
  const [creating, setCreating] = useState<GeneratorId | null>(null);
  const { regular } = useLayout();
  const { width } = useWindowDimensions();
  const blockW = Math.min(width, regular ? PANEL_MAX_WIDTH : CONTENT_MAX_WIDTH);
  const inner = blockW - space.xl * 2;
  const genSize = Math.floor((inner - GAP * 2) / 3);
  const recentW = Math.floor(regular ? (inner - GAP * 3) / 4 : (inner - GAP * 2) / 3);
  // la tira de recientes empieza alineada con la columna
  const stripInset = Math.max(space.xl, (width - blockW) / 2 + space.xl);

  if (creating) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <AppHeader />
        <View style={styles.createWrap}>
          <CreateGenerative {...props} initial={creating} genSize={FORM_GEN_THUMB} onCancel={() => setCreating(null)} />
          {message && <Toast text={message} onPress={onDismissMessage} style={styles.message} />}
        </View>
      </SafeAreaView>
    );
  }

  const shown = recents.slice(0, MAX_RECENTS);
  const block = [styles.block, { maxWidth: blockW }];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <AppHeader />
      <ScrollView contentContainerStyle={[styles.scroll, regular && styles.scrollWide]} showsVerticalScrollIndicator={false}>
        <View style={block}>
          <Text style={[styles.title, regular && styles.titleWide]} accessibilityRole="header">
            Nuevo proyecto
          </Text>
          <Text style={styles.subtitle}>Parte de una imagen o de un generador y transfórmalo con efectos.</Text>

          <Text style={styles.section} accessibilityRole="header">
            Con una imagen
          </Text>
          <View style={styles.row}>
            <ModeCard
              primary
              icon="photo.on.rectangle"
              title={busy ? "Importando…" : "Fotos"}
              note="Una foto o un clip de hasta 10 s"
              tall={regular}
              disabled={busy}
              onPress={onImport}
            />
            <ModeCard icon="camera" title="Cámara" note="Toma una foto o graba un clip" tall={regular} disabled={busy} onPress={onCamera} />
          </View>
          {message && <Toast text={message} onPress={onDismissMessage} style={styles.message} />}

          <Text style={styles.section} accessibilityRole="header">
            Sin imagen
          </Text>
          <View style={styles.genRow}>
            {GENERATORS.map((g) => (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                accessibilityLabel={`Crear sin imagen con ${g.label}: ${GENERATOR_NOTE[g.id]}`}
                disabled={busy}
                onPress={() => {
                  selectFeedback();
                  setCreating(g.id);
                }}
                style={({ pressed }) => [styles.genCard, { width: genSize }, pressed && styles.pressed, busy && styles.disabled]}
              >
                <View style={[styles.genThumb, { width: genSize, height: genSize }]}>{renderGeneratorThumb(g.id, genSize)}</View>
                <View style={styles.genText}>
                  <Text style={styles.cardTitle} numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
                    {g.label.charAt(0) + g.label.slice(1).toLowerCase()}
                  </Text>
                  <Text style={styles.cardNote} numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
                    {GENERATOR_NOTE[g.id]}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {shown.length > 0 && (
          <>
            <View style={[...block, styles.sectionRow]}>
              <Text style={[styles.section, styles.sectionInRow]} accessibilityRole="header">
                Recientes
              </Text>
              <Pressable accessibilityRole="button" hitSlop={12} onPress={onSeeAll}>
                <Text style={styles.link} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
                  Ver todos
                </Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.recents, { paddingHorizontal: stripInset }]}>
              {shown.map((p) => (
                <ProjectCard key={p.id} project={p} width={recentW} active={false} onOpen={() => onOpenRecent(p)} />
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// tarjeta de un modo de empezar: icono, título y qué hace. La principal va en blanco
function ModeCard({
  icon,
  title,
  note,
  primary = false,
  tall,
  disabled,
  onPress,
}: {
  icon: SFSymbol;
  title: string;
  note: string;
  primary?: boolean;
  tall: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const fg = primary ? colors.paperText : colors.inkText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${note}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.mode, tall && styles.modeTall, primary && styles.modePrimary, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={[styles.modeIcon, primary && styles.modeIconPrimary]}>
        <Icon name={icon} size={20} color={fg} />
      </View>
      <View style={styles.modeText}>
        <Text style={[styles.cardTitle, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
          {title}
        </Text>
        <Text style={[styles.cardNote, primary && styles.cardNotePrimary]} numberOfLines={2} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
          {note}
        </Text>
      </View>
    </Pressable>
  );
}

function CreateGenerative({
  busy,
  onCreate,
  renderGeneratorThumb,
  initial,
  genSize,
  onCancel,
}: Props & { initial: GeneratorId; genSize: number; onCancel: () => void }) {
  const [aspect, setAspect] = useState<GenerativeAspect>("9:16");
  const [generator, setGenerator] = useState<GeneratorId>(initial);
  const [motion, setMotion] = useState<"animated" | "still">("animated");

  return (
    <View style={styles.create}>
      <Text style={styles.title}>Crear sin imagen</Text>

      <Text style={styles.label}>FORMATO</Text>
      <Segmented options={ASPECTS.map((a) => ({ id: a, label: a }))} value={aspect} onChange={setAspect} />

      <Text style={styles.label}>GENERADOR</Text>
      <View style={styles.formGenRow}>
        {GENERATORS.map((g) => {
          const on = g.id === generator;
          return (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              accessibilityLabel={g.label}
              accessibilityState={{ selected: on }}
              onPress={() => {
                selectFeedback();
                setGenerator(g.id);
              }}
              style={styles.formGen}
            >
              <View style={[styles.formGenThumb, { width: genSize + 6, height: genSize + 6 }, on && styles.formGenThumbOn]}>
                {renderGeneratorThumb(g.id, genSize)}
              </View>
              <Text style={[styles.formGenLabel, on && styles.formGenLabelOn]}>{g.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>MOVIMIENTO</Text>
      <Segmented
        options={[
          { id: "animated", label: "Animado" },
          { id: "still", label: "Fijo" },
        ]}
        value={motion}
        onChange={setMotion}
      />
      <Text style={styles.motionNote}>
        {motion === "animated"
          ? "Una modulación LFO mueve el generador. La ajustas en Capas; si la quitas, queda fijo."
          : "Un cuadro congelado del generador. Ideal para pintar con el pincel."}
      </Text>

      <View style={styles.buttons}>
        <Button
          label={busy ? "Creando…" : "Crear"}
          icon="sparkles"
          disabled={busy}
          onPress={() => onCreate(aspect, generator, motion === "animated")}
        />
        <Button label="Cancelar" variant="secondary" disabled={busy} onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  scroll: { paddingTop: space.lg, paddingBottom: 48 },
  // iPad: más aire arriba en una pantalla alta
  scrollWide: { paddingTop: 48 },
  // columna centrada; su ancho máximo depende del dispositivo
  block: { width: "100%", alignSelf: "center", paddingHorizontal: space.xl },

  // jerarquía: título > secciones > tarjetas
  title: { color: colors.inkText, fontFamily: type.family, fontSize: type.display - 6, fontWeight: "700", letterSpacing: -0.4 },
  titleWide: { fontSize: type.display },
  subtitle: { color: colors.inkMute, fontFamily: type.family, fontSize: type.body, marginTop: space.xs, lineHeight: 20 },
  section: {
    marginTop: space.xl + space.sm,
    marginBottom: space.md,
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.body,
    fontWeight: "600",
  },
  sectionRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionInRow: { marginBottom: 0 },
  link: { color: colors.inkMute, fontFamily: type.family, fontSize: type.body - 1, fontWeight: "600" },
  row: { flexDirection: "row", gap: GAP },
  // seis generadores: dos filas de tres
  genRow: { flexDirection: "row", flexWrap: "wrap", gap: GAP },

  // tarjetas (modo y generador comparten superficie, radio y textos)
  mode: {
    flex: 1,
    minHeight: 112,
    padding: space.md,
    gap: space.md,
    justifyContent: "space-between",
    borderRadius: radius.md,
    backgroundColor: colors.inkRaised,
  },
  modeTall: { minHeight: 140, padding: space.lg },
  modePrimary: { backgroundColor: colors.paper },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inkSurface,
  },
  modeIconPrimary: { backgroundColor: colors.paperLine },
  modeText: { gap: 2 },
  cardTitle: { color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600" },
  cardNote: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, lineHeight: 16 },
  cardNotePrimary: { color: colors.paperMute },
  genCard: { borderRadius: radius.md, backgroundColor: colors.inkRaised, overflow: "hidden" },
  genThumb: { backgroundColor: colors.inkSurface },
  genText: { padding: space.md, gap: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  message: { marginTop: space.md },
  recents: { gap: GAP },

  // formulario "Crear sin imagen"
  createWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: space.xl,
    paddingBottom: 60,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  create: { alignSelf: "stretch", alignItems: "center" },
  buttons: { alignSelf: "stretch", marginTop: space.xl, gap: space.sm },
  label: {
    alignSelf: "flex-start",
    marginTop: space.xl,
    marginBottom: space.sm,
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1.2,
  },
  motionNote: {
    alignSelf: "stretch",
    marginTop: space.sm,
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.label + 1,
    lineHeight: 18,
  },
  formGenRow: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", gap: space.sm, justifyContent: "space-between", marginTop: space.md },
  formGen: { alignItems: "center", gap: 6 },
  formGenThumb: {
    padding: 1,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.inkRaised,
    overflow: "hidden",
  },
  formGenThumbOn: { borderColor: colors.paper },
  formGenLabel: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.8 },
  formGenLabelOn: { color: colors.inkText },
});
