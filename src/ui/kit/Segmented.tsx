import { Pressable, StyleSheet, Text, View } from "react-native";

import { selectFeedback } from "../../platform/haptics";
import { colors, radius, type } from "../tokens";

// control segmentado: opciones excluyentes a todo el ancho; la elegida va invertida
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.root} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={String(o.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) return;
              selectFeedback();
              onChange(o.id);
            }}
            style={[styles.item, on && styles.itemOn]}
          >
            <Text style={[styles.text, on && styles.textOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", padding: 2, gap: 2, borderRadius: radius.pill, backgroundColor: colors.inkRaised },
  item: { flex: 1, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  itemOn: { backgroundColor: colors.paper },
  text: { color: colors.inkMute, fontFamily: type.family, fontSize: type.micro, letterSpacing: 0.8 },
  textOn: { color: colors.paperText, fontWeight: "600" },
});
