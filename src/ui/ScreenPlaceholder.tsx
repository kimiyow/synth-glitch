import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, type } from "./tokens";

type Props = {
  title: string;
  milestone: string;
  note?: string;
};

/** Pantalla temporal mientras el hito correspondiente no está implementado. */
export function ScreenPlaceholder({ title, milestone, note }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>PENDIENTE · {milestone}</Text>
      {note && <Text style={styles.note}>{note}</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.ink,
  },
  title: {
    color: colors.inkText,
    fontFamily: type.family,
    fontSize: type.title,
    letterSpacing: 1.2,
  },
  note: {
    color: colors.inkMute,
    fontFamily: type.family,
    fontSize: type.label,
    letterSpacing: 1.2,
  },
});
