import { SymbolView, type SFSymbol } from "expo-symbols";
import { Text } from "react-native";

import { colors } from "../tokens";

/** Icono SF Symbols (iOS). Si no existe, muestra el texto de respaldo. */
export function Icon({
  name,
  size = 22,
  color = colors.inkText,
  fallback = "•",
}: {
  name: SFSymbol;
  size?: number;
  color?: string;
  fallback?: string;
}) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight="regular"
      fallback={<Text style={{ color, fontSize: size * 0.8 }}>{fallback}</Text>}
    />
  );
}
