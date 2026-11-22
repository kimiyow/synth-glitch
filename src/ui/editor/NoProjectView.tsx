import { router } from "expo-router";
import { useMemo, useState } from "react";

import { createGenerativeProject } from "../../actions/captureActions";
import type { GeneratorId } from "../../domain/types";
import { GENERATORS } from "../../engine/registry";
import { EffectThumb } from "../../render/EffectThumb";
import { blankImage, generatorLayer } from "../../render/renderPreviews";
import { reportError } from "../errors";
import { useImportMedia } from "../useImportMedia";
import { EditorEmpty, GEN_THUMB, type GenerativeAspect } from "./EditorEmpty";

// editor sin proyecto. las importaciones no se recortan (aspecto libre); crear sin imagen usa un
// cuadro fijo del generador como base
export function NoProjectView() {
  const imports = useImportMedia();
  const { message, setMessage, importMedia } = imports;
  const [creating, setCreating] = useState(false);
  const busy = imports.busy || creating;

  const create = async (aspect: GenerativeAspect, generator: GeneratorId) => {
    setCreating(true);
    setMessage(null);
    const result = await createGenerativeProject(aspect, generator);
    if (result.ok) router.push("/project");
    else void reportError({ title: "No se pudo crear el proyecto", error: result.error, retry: () => create(aspect, generator) });
    setCreating(false);
  };

  // una capa estable por generador para que las miniaturas no se redibujen en cada render
  const thumbs = useMemo(() => Object.fromEntries(GENERATORS.map((g) => [g.id, generatorLayer(g.id)])), []);

  return (
    <EditorEmpty
      busy={busy}
      message={message}
      onCreate={create}
      renderGeneratorThumb={(g) => <EffectThumb image={blankImage()} layer={thumbs[g]} seed={7} size={GEN_THUMB} />}
      onImport={importMedia}
      onCamera={() => router.navigate("/")}
      onDismissMessage={() => setMessage(null)}
    />
  );
}
