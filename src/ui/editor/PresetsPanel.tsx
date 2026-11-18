import { ActionGrid, type GridAction } from "../kit/ActionGrid";

type Props = {
  readOnly: boolean;
  busy: boolean;
  onImport: () => void;
  onShare: () => void;
};

type PresetAction = "import" | "share" | "save" | "mutate" | "random";

// panel Presets: importar y compartir la receta .synthfx (capas, modulación y semilla, sin la
// pintura); guardar escena, mutar y aleatorizar llegan con el resto de M7
export function PresetsPanel({ readOnly, busy, onImport, onShare }: Props) {
  const actions: GridAction<PresetAction>[] = [
    { id: "import", icon: "square.and.arrow.down", label: "Importar receta", reason: readOnly ? "SOLO LECTURA" : null },
    { id: "share", icon: "square.and.arrow.up", label: "Compartir receta" },
    { id: "save", icon: "square.stack.3d.up", label: "Guardar escena", reason: "PRONTO" },
    { id: "mutate", icon: "wand.and.rays", label: "Mutar", reason: "PRONTO" },
    { id: "random", icon: "dice", label: "Aleatorizar", reason: "PRONTO" },
  ];
  return (
    <ActionGrid
      actions={actions}
      disabled={busy}
      onPress={(id) => {
        if (id === "import") onImport();
        if (id === "share") onShare();
      }}
    />
  );
}
