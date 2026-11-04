// https://docs.expo.dev/guides/using-eslint/
// Reglas obligatorias del SDD v2, sección 8.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

const LEGACY_IMPORTS = {
  group: ["**/legacy", "**/legacy/**", "@/legacy", "@/legacy/**"],
  message: "src/legacy/ es solo de referencia; no se importa.",
};

const PURE_MODULE_IMPORTS = {
  // Skia (@shopify/react-native-skia) sí está permitido.
  regex: "^(react|react-native|expo|zustand)(/.*)?$|^(react-native-|expo-)[^/]+(/.*)?$|^@expo/",
  message: "engine/ y modulation/ son puros: sin React, Expo ni el store.",
};

// Funciones que se ejecutan en el hilo de UI: worklets explícitos y callbacks de gestos.
const WORKLET_FN =
  ":function[body.body.0.directive='worklet']";
const GESTURE_CALLBACK =
  "CallExpression[callee.property.name=/^on(Begin|Start|Update|Change|End|Finalize|TouchesDown|TouchesMove|TouchesUp|TouchesCancelled)$/] > :function";
const STORE_CALL =
  "CallExpression[callee.property.name=/^(getState|setState)$/]";
const REACT_SETTER_CALL = "CallExpression[callee.name=/^set[A-Z]/]";
const UI_THREAD_MESSAGE =
  "Sin store ni setState en el hilo de UI; usa valores compartidos y una sola llamada runOnJS al terminar el gesto.";

const UI_THREAD_RULES = [
  { selector: `${WORKLET_FN} ${STORE_CALL}`, message: UI_THREAD_MESSAGE },
  { selector: `${WORKLET_FN} ${REACT_SETTER_CALL}`, message: UI_THREAD_MESSAGE },
  { selector: `${GESTURE_CALLBACK} ${STORE_CALL}`, message: UI_THREAD_MESSAGE },
  { selector: `${GESTURE_CALLBACK} ${REACT_SETTER_CALL}`, message: UI_THREAD_MESSAGE },
];

// El React Compiler lee `x.y` al renderizar para memoizar; con `x!.y` truena si x es null.
const NO_NON_NULL_MEMBER = {
  selector: "MemberExpression > TSNonNullExpression.object",
  message: "Sin `x!.y` en componentes: comprueba que x no sea null antes (el React Compiler lo lee al renderizar).",
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "src/legacy/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": ["error", { patterns: [LEGACY_IMPORTS] }],
      "no-restricted-syntax": ["error", ...UI_THREAD_RULES],
    },
  },
  {
    files: ["**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...UI_THREAD_RULES, NO_NON_NULL_MEMBER],
    },
  },
  {
    files: ["src/engine/**", "src/modulation/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [LEGACY_IMPORTS, PURE_MODULE_IMPORTS] },
      ],
    },
  },
]);
