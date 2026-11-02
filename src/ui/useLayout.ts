import { useWindowDimensions } from "react-native";

export function useLayout() {
  const { width } = useWindowDimensions();
  const regular = width >= 600;

  return {
    regular,
    margin: regular ? 32 : 16,
    scale: regular ? 1.15 : 1,
  };
}
