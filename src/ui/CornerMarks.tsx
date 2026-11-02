import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "./tokens";

type CornerMarksProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function CornerMarks({ size = 16, style }: CornerMarksProps) {
  return (
    <View pointerEvents="none" style={[styles.frame, style]}>
      <View style={[styles.corner, styles.topLeft, { width: size, height: size }]} />
      <View style={[styles.corner, styles.topRight, { width: size, height: size }]} />
      <View style={[styles.corner, styles.bottomLeft, { width: size, height: size }]} />
      <View style={[styles.corner, styles.bottomRight, { width: size, height: size }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    ...StyleSheet.absoluteFill,
  },
  corner: {
    borderColor: colors.inkText,
    position: "absolute",
  },
  topLeft: {
    borderLeftWidth: 1,
    borderTopWidth: 1,
    left: 0,
    top: 0,
  },
  topRight: {
    borderRightWidth: 1,
    borderTopWidth: 1,
    right: 0,
    top: 0,
  },
  bottomLeft: {
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    bottom: 0,
    left: 0,
  },
  bottomRight: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    bottom: 0,
    right: 0,
  },
});
