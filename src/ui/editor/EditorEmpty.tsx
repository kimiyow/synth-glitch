import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GENERATORS } from "../../engine/registry";
import { selectFeedback } from "../../platform/haptics";
import type { GeneratorId } from "../../state/types";
import { AppHeader } from "../AppHeader";
import { Button } from "../kit/Button";
import { Icon } from "../kit/Icon";
import { Pill } from "../kit/Pill";
import { colors, radius, space, type } from "../tokens";

export type GenerativeAspect = "9:16" | "1:1" | "4:5";
const ASPECTS: readonly GenerativeAspect[] = ["9:16", "1:1", "4:5"];
export const GEN_THUMB = 88;

type Props = {
  busy: boolean;
  message: string | null;
  onImport: () => void;
  onCamera: () => void;
  /** CAM-06: crea un proyecto generativo con el aspecto y el generador elegidos. */
  onCreate: (aspect: GenerativeAspect, generator: GeneratorId) => void;
  /** Miniatura de un generador (vive en editor/, que sí conoce Skia). */
  renderGeneratorThumb: (generator: GeneratorId) => ReactNode;
  onDismissMessage: () => void;
};

/** Editor sin proyecto: importar desde Fotos, ir a la cámara o crear sin imagen. */
export function EditorEmpty(props: Props) {
  const { busy, message, onImport, onCamera, onDismissMessage } = props;
  const [creating, setCreating] = useState(false);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <AppHeader />
      <View style={styles.center}>
        {creating ? (
          <CreateGenerative {...props} onCancel={() => setCreating(false)} />
        ) : (
          <>
            <View style={styles.badge}>
              <Icon name="photo.on.rectangle.angled" size={34} />
            </View>
            <Text style={styles.title}>Sin imagen</Text>
            <Text style={styles.subtitle}>Toma o importa una imagen para empezar a editar</Text>
            <View style={styles.buttons}>
              <Button label={busy ? "Importando…" : "Importar desde Fotos"} icon="photo.badge.plus" disabled={busy} onPress={onImport} />
              <Button label="Ir a cámara" icon="camera" variant="secondary" disabled={busy} onPress={onCamera} />
              <Button label="Crear sin imagen" icon="sparkles" variant="secondary" disabled={busy} onPress={() => setCreating(true)} />
            </View>
          </>
        )}
        {message && (
          <Text style={styles.message} onPress={onDismissMessage}>
            {message}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function CreateGenerative({ busy, onCreate, renderGeneratorThumb, onCancel }: Props & { onCancel: () => void }) {
  const [aspect, setAspect] = useState<GenerativeAspect>("9:16");
  const [generator, setGenerator] = useState<GeneratorId>("noise");

  return (
    <View style={styles.create}>
      <Text style={styles.title}>Crear sin imagen</Text>
      <Text style={styles.subtitle}>Elige un formato y un generador como base</Text>

      <Text style={styles.section}>FORMATO</Text>
      <View style={styles.row}>
        {ASPECTS.map((a) => (
          <Pill key={a} label={a} selected={a === aspect} onPress={() => setAspect(a)} />
        ))}
      </View>

      <Text style={styles.section}>GENERADOR</Text>
      <View style={styles.row}>
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

      <View style={styles.buttons}>
        <Button label={busy ? "Creando…" : "Crear"} icon="sparkles" disabled={busy} onPress={() => onCreate(aspect, generator)} />
        <Button label="Cancelar" variant="secondary" disabled={busy} onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl, paddingBottom: 60 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: radius.lg,
    backgroundColor: colors.inkRaised,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.lg,
  },
  title: { color: colors.inkText, fontFamily: type.family, fontSize: type.title, fontWeight: "600", textAlign: "center" },
  subtitle: { color: colors.inkMute, fontFamily: type.family, fontSize: type.body - 2, marginTop: space.xs, textAlign: "center" },
  buttons: { alignSelf: "stretch", marginTop: space.xl, gap: space.sm },
  create: { alignSelf: "stretch", alignItems: "center" },
  section: {
    alignSelf: "flex-start",
    marginTop: space.xl,
    marginBottom: space.sm,
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.micro,
    letterSpacing: 1.2,
  },
  row: { alignSelf: "stretch", flexDirection: "row", gap: space.sm, justifyContent: "space-between" },
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
  genLabelOn: { color: colors.inkText },
  message: {
    marginTop: space.lg,
    color: colors.paperText,
    backgroundColor: colors.paper,
    fontFamily: type.family,
    fontSize: type.label,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
});
