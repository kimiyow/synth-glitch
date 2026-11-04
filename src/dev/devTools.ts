/**
 * HUD y testLab: activos en desarrollo y también en builds de medición
 * (`EXPO_PUBLIC_DEV_TOOLS=1 npx expo start --no-dev --minify`).
 */
export const DEV_TOOLS_ENABLED =
  __DEV__ || process.env.EXPO_PUBLIC_DEV_TOOLS === "1";
