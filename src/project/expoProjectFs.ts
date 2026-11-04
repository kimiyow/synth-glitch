import { Directory, File, Paths } from "expo-file-system";

import type { ProjectFs } from "./projectFs";

/** `documentDirectory/projects/` (SDD 3.7) sobre expo-file-system. */
export function createExpoProjectFs(rootName = "projects"): ProjectFs {
  const root = () => {
    const dir = new Directory(Paths.document, rootName);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    return dir;
  };
  const dir = (id: string) => new Directory(root(), id);
  const file = (id: string, name: string) => new File(dir(id), name);

  return {
    listIds: () => root().list().filter((e) => e instanceof Directory).map((d) => d.name),
    createDir: (id) => dir(id).create({ intermediates: true, idempotent: true }),
    removeDir: (id) => {
      const d = dir(id);
      if (d.exists) d.delete();
    },
    copyDir: (fromId, toId) => {
      const to = dir(toId);
      to.create({ intermediates: true, idempotent: true });
      for (const entry of dir(fromId).list()) {
        if (entry instanceof File) entry.copySync(new File(to, entry.name));
      }
    },
    exists: (id, name) => file(id, name).exists,
    readText: (id, name) => file(id, name).textSync(),
    writeText: (id, name, text) => writeFile(file(id, name), text),
    writeBytes: (id, name, bytes) => writeFile(file(id, name), bytes),
    copyFileIn: (id, name, sourceUri) => new File(sourceUri).copySync(file(id, name), { overwrite: true }),
    move: (id, from, to) => file(id, from).moveSync(file(id, to), { overwrite: true }),
    remove: (id, name) => {
      const f = file(id, name);
      if (f.exists) f.delete();
    },
    uri: (id, name) => file(id, name).uri,
  };
}

function writeFile(f: File, content: string | Uint8Array) {
  if (!f.exists) f.create({ intermediates: true });
  f.writeSync(content);
}
