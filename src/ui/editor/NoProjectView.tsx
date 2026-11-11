import { router } from "expo-router";
import { useMemo, useState } from "react";

import { createGenerativeProject, createProjectFromClip, createProjectFromPhoto } from "../../actions/captureActions";
import type { GeneratorId } from "../../domain/types";
import { GENERATORS } from "../../engine/registry";
import { pickMediaFromLibrary } from "../../platform/pickMedia";
import { EffectThumb } from "../../render/EffectThumb";
import { blankImage, generatorLayer } from "../../render/renderPreviews";
import { EditorEmpty, GEN_THUMB, type GenerativeAspect } from "./EditorEmpty";

// editor sin proyecto. las importaciones no se recortan (aspecto libre); crear sin imagen usa un
// cuadro fijo del generador como base
export function NoProjectView() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const importMedia = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const picked = await pickMediaFromLibrary();
      if (picked.kind === "rejected") setMessage(picked.message);
      if (picked.kind === "selected") {
        const { uri, type: kind } = picked.media;
        const result = kind === "clip" ? await createProjectFromClip(uri, "free") : await createProjectFromPhoto(uri, "free");
        if (!result.ok) setMessage(`ERROR · ${result.error}`);
      }
    } catch (error) {
      setMessage(`ERROR · ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const create = async (aspect: GenerativeAspect, generator: GeneratorId) => {
    setBusy(true);
    setMessage(null);
    const result = await createGenerativeProject(aspect, generator);
    if (!result.ok) setMessage(`ERROR · ${result.error}`);
    setBusy(false);
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
