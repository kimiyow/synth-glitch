import { NoProjectView } from "../../ui/editor/NoProjectView";

// pestaña Editor: sin proyecto abierto ofrece importar, ir a la cámara o crear sin imagen. El
// proyecto abierto vive en la pantalla apilada /project
export default function EditorTab() {
  return <NoProjectView />;
}
