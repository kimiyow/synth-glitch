import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { CONTENT_MAX_WIDTH } from "../useLayout";

export type GenerativeAspect = "9:16" | "1:1" | "4:5";
const ASPECTS: readonly GenerativeAspect[] = ["9:16", "1:1", "4:5"];
export const GEN_THUMB = 88;
const RECENT_WIDTH = 104;
const MAX_RECENTS = 8;

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
  // miniatura de un generador (vive en editor/, que sí conoce Skia)
  renderGeneratorThumb: (generator: GeneratorId) => ReactNode;
  onDismissMessage: () => void;
};

// editor sin proyecto: empezar (Fotos, cámara, sin imagen), seguir con un proyecto reciente o
// partir de un generador
export function EditorEmpty(props: Props) {
  const { busy, message, recents, onImport, onCamera, onOpenRecent, onSeeAll, renderGeneratorThumb, onDismissMessage } = props;
  // generador con el que se abre "Crear sin imagen"; null = pantalla de inicio
  const [creating, setCreating] = useState<GeneratorId | null>(null);

  if (creating) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <AppHeader />
        <View style={styles.createWrap}>
          <CreateGenerative {...props} initial={creating} onCancel={() => setCreating(null)} />
          {message && <Toast text={message} onPress={onDismissMessage} style={styles.message} />}
        </View>
      </SafeAreaView>
    );
  }

  const shown = recents.slice(0, MAX_RECENTS);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.block}>
          <Text style={styles.title} accessibilityRole="header">
            Nuevo proyecto
          </Text>
          <Text style={styles.subtitle}>Elige una imagen o un clip y transfórmalo con efectos.</Text>
          <View style={styles.actions}>
            <Button label={busy ? "Importando…" : "Importar desde Fotos"} icon="photo.badge.plus" disabled={busy} onPress={onImport} />
            <View style={styles.actionRow}>
              <QuickAction icon="camera" label="Cámara" disabled={busy} onPress={onCamera} />
              <QuickAction icon="sparkles" label="Sin imagen" disabled={busy} onPress={() => setCreating("noise")} />
            </View>
          </View>
          {message && <Toast text={message} onPress={onDismissMessage} style={styles.message} />}
        </View>

        {shown.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, styles.block]}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                Recientes
              </Text>
              <Pressable accessibilityRole="button" hitSlop={12} onPress={onSeeAll}>
                <Text style={styles.link} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
                  Ver todos
                </Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recents}>
              {shown.map((p) => (
                <ProjectCard key={p.id} project={p} width={RECENT_WIDTH} active={false} onOpen={() => onOpenRecent(p)} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={[styles.section, styles.block]}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Empieza con un generador
          </Text>
          <Text style={styles.sectionNote}>Imagen sintetizada, sin foto: ruido, barras o celdas que respondes con el dedo.</Text>
          <View style={styles.genRow}>
            {GENERATORS.map((g) => (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                accessibilityLabel={`Crear con ${g.label}`}
                disabled={busy}
                onPress={() => {
                  selectFeedback();
                  setCreating(g.id);
                }}
                style={({ pressed }) => [styles.gen, pressed && styles.pressed]}
              >
                <View style={styles.genThumb}>{renderGeneratorThumb(g.id)}</View>
                <Text style={styles.genLabelOn}>{g.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, disabled, onPress }: { icon: "camera" | "sparkles"; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.quick, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Icon name={icon} size={18} />
      <Text style={styles.quickText} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
}

function CreateGenerative({ busy, onCreate, renderGeneratorThumb, initial, onCancel }: Props & { initial: GeneratorId; onCancel: () => void }) {
  const [aspect, setAspect] = useState<GenerativeAspect>("9:16");
  const [generator, setGenerator] = useState<GeneratorId>(initial);
  const [motion, setMotion] = useState<"animated" | "still">("animated");

  return (
    <View style={styles.create}>
      <Text style={styles.title}>Crear sin imagen</Text>

      <Text style={styles.label}>FORMATO</Text>
      <Segmented options={ASPECTS.map((a) => ({ id: a, label: a }))} value={aspect} onChange={setAspect} />

      <Text style={styles.label}>GENERADOR</Text>
      <View style={styles.genRow}>
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
              style={styles.gen}
            >
              <View style={[styles.genThumb, on && styles.genThumbOn]}>{renderGeneratorThumb(g.id)}</View>
              <Text style={[styles.genLabel, on && styles.genLabelOn]}>{g.label}</Text>
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
  // bloques centrados con el mismo ancho máximo que el resto de formularios (iPad)
  block: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", paddingHorizontal: space.xl },
  title: { color: colors.inkText, fontFamily: type.family, fontSize: type.display - 6, fontWeight: "700", letterSpacing: -0.4 },
  subtitle: { color: colors.inkMute, fontFamily: type.family, fontSize: type.body, marginTop: space.xs, lineHeight: 20 },
  actions: { marginTop: space.xl, gap: space.sm },
  actionRow: { flexDirection: "row", gap: space.sm },
  quick: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.inkRaised,
  },
  quickText: { color: colors.inkText, fontFamily: type.family, fontSize: type.body, fontWeight: "600" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  message: { marginTop: space.lg },
  section: { marginTop: 40 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionTitle: { color: colors.inkText, fontFamily: type.family, fontSize: type.title - 2, fontWeight: "600" },
  sectionNote: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label + 1, marginTop: space.xs, lineHeight: 18 },
  link: { color: colors.inkMute, fontFamily: type.family, fontSize: type.body - 1, fontWeight: "600" },
  recents: { gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md },
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
  genRow: { alignSelf: "stretch", flexDirection: "row", gap: space.sm, justifyContent: "space-between", marginTop: space.md },
  gen: { alignItems: "center", gap: 6 },
  genThumb: {
    width: GEN_THUMB + 6,
    height: GEN_THUMB + 6,
    padding: 1,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.inkRaised,
    overflow: "hidden",
  },
  genThumbOn: { borderColor: colors.paper },
  genLabel: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.8 },
  genLabelOn: { color: colors.inkText, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.8 },
});
