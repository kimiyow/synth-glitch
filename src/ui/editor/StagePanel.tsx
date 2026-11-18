import type { SFSymbol } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { StageMode } from "../../canvas/StageView";
import { selectFeedback, tapFeedback } from "../../platform/haptics";
import { Icon } from "../kit/Icon";
import { colors, radius, space, type } from "../tokens";

const MODES: { id: StageMode; icon: SFSymbol; label: string; what: string }[] = [
  { id: "interactive", icon: "hand.point.up.left", label: "Interactivo", what: "Tu dedo sigue moviendo el efecto" },
  { id: "locked", icon: "lock", label: "Bloqueado", what: "Ignora los toques" },
];

const SHORTCUTS: { icon: SFSymbol; text: string }[] = [
  { icon: "circle", text: "MANTÉN 2 S LA ESQUINA PARA SALIR" },
  { icon: "hand.tap", text: "DOBLE TOQUE CON 2 DEDOS · PANTALLA NEGRA" },
];

// panel Escenario: elige el modo y entra a pantalla completa (brillo al máximo, pantalla encendida)
export function StagePanel({ onStart }: { onStart: (mode: StageMode) => void }) {
  const [mode, setMode] = useState<StageMode>("interactive");
  return (
    <View style={styles.root}>
      <View style={styles.modes}>
        {MODES.map((m) => {
          const on = m.id === mode;
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={`${m.label}: ${m.what}`}
              accessibilityState={{ selected: on }}
              onPress={() => {
                selectFeedback();
                setMode(m.id);
              }}
              style={({ pressed }) => [styles.mode, on && styles.modeOn, pressed && styles.pressed]}
            >
              <Icon name={m.icon} size={20} color={on ? colors.paperText : colors.inkText} />
              <Text style={[styles.modeLabel, on && styles.modeLabelOn]}>{m.label}</Text>
              <Text style={[styles.modeWhat, on && styles.modeWhatOn]} numberOfLines={1}>
                {m.what}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.shortcuts}>
        {SHORTCUTS.map((s) => (
          <View key={s.text} style={styles.shortcut}>
            <Icon name={s.icon} size={13} color={colors.inkMute} />
            <Text style={styles.shortcutText}>{s.text}</Text>
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Entrar al modo escenario"
        onPress={() => {
          tapFeedback();
          onStart(mode);
        }}
        style={({ pressed }) => [styles.start, pressed && styles.pressed]}
      >
        <Icon name="play.fill" size={14} color={colors.paperText} />
        <Text style={styles.startText}>ENTRAR</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  modes: { flexDirection: "row", gap: space.sm },
  mode: { flex: 1, padding: space.md, gap: 6, borderRadius: radius.md, backgroundColor: colors.inkRaised },
  modeOn: { backgroundColor: colors.paper },
  modeLabel: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, fontWeight: "600" },
  modeLabelOn: { color: colors.paperText },
  modeWhat: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.4 },
  modeWhatOn: { color: colors.paperMute },
  pressed: { opacity: 0.7 },
  shortcuts: { gap: 6 },
  shortcut: { flexDirection: "row", alignItems: "center", gap: space.sm },
  shortcutText: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 1 },
  start: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  startText: { color: colors.paperText, fontFamily: type.family, fontSize: type.label, fontWeight: "700", letterSpacing: 1.4 },
});
