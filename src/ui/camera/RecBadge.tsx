import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, type } from "../tokens";

// contador de grabación sobre el visor: ● REC 0:03 / 0:05
export function RecBadge({ maxSeconds }: { maxSeconds: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setSeconds(Math.min(maxSeconds, Math.floor((Date.now() - startedAt) / 1000))), 250);
    return () => clearInterval(id);
  }, [maxSeconds]);

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.dot} />
      <Text style={styles.text}>
        REC 0:{String(seconds).padStart(2, "0")} / 0:{String(maxSeconds).padStart(2, "0")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    minHeight: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.paperText },
  text: { color: colors.paperText, fontFamily: type.family, fontSize: type.label, fontWeight: "600", letterSpacing: 0.8, fontVariant: ["tabular-nums"] },
});
