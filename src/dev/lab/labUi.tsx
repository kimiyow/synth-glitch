import { Pressable, StyleSheet, Text } from "react-native";

import { colors, geometry, type } from "../../ui/tokens";

export function LabChip({
  label,
  active = false,
  disabled = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[labStyles.chip, active && labStyles.chipActive, disabled && labStyles.disabled]}
    >
      <Text style={[labStyles.chipText, active && labStyles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export const labStyles = StyleSheet.create({
  controls: { padding: geometry.compactMargin, gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  label: { color: colors.inkMute, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  data: { color: colors.inkText, fontFamily: "Menlo", fontSize: type.data },
  warn: { color: colors.ink, backgroundColor: colors.paper, alignSelf: "flex-start", paddingHorizontal: 6 },
  chip: {
    minHeight: geometry.target,
    minWidth: geometry.target,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.inkLineStrong,
    borderWidth: geometry.hairline,
  },
  chipActive: { backgroundColor: colors.paper },
  disabled: { opacity: 0.5 },
  chipText: { color: colors.inkText, fontFamily: type.family, fontSize: type.label, letterSpacing: 1.2 },
  chipTextActive: { color: colors.paperText },
});
