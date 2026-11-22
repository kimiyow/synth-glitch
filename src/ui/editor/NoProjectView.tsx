import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";

import { createGenerativeProject } from "../../actions/captureActions";
import { listAllProjects, openProjectById } from "../../actions/projectActions";
import type { ProjectSummary } from "../../project/storage";
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
  const [recents, setRecents] = useState<ProjectSummary[]>([]);

  // al volver a la pestaña (p. ej. tras guardar o borrar en la Galería) la lista se actualiza.
  // Una lectura fallida solo oculta Recientes: la Galería es la que informa del error
  useFocusEffect(
    useCallback(() => {
      try {
        setRecents(listAllProjects().filter((p) => !p.error));
      } catch {
        setRecents([]);
      }
    }, []),
  );

  const openRecent = (project: ProjectSummary) => {
    const result = openProjectById(project.id);
    if (result.ok) router.push("/project");
    else void reportError({ title: "No se pudo abrir el proyecto", error: result.error, retry: () => openRecent(project) });
  };

  const create = async (aspect: GenerativeAspect, generator: GeneratorId, animated: boolean) => {
    setCreating(true);
    setMessage(null);
    const result = await createGenerativeProject(aspect, generator, animated);
    if (result.ok) router.push("/project");
    else void reportError({ title: "No se pudo crear el proyecto", error: result.error, retry: () => create(aspect, generator, animated) });
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
      recents={recents}
      onOpenRecent={openRecent}
      onSeeAll={() => router.navigate("/gallery")}
      onImport={importMedia}
      onCamera={() => router.navigate("/")}
      onDismissMessage={() => setMessage(null)}
    />
  );
}
