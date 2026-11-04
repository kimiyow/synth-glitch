import { File, Paths } from "expo-file-system";

import type { AppSettings } from "../state/settings";

const NAME = "settings.json";

/** `documentDirectory/settings.json`, con la misma escritura temporal + renombrado que los proyectos. */
export const settingsFile = {
  load(): unknown {
    const file = new File(Paths.document, NAME);
    return file.exists ? JSON.parse(file.textSync()) : null;
  },
  save(settings: AppSettings) {
    const tmp = new File(Paths.document, `${NAME}.tmp`);
    if (tmp.exists) tmp.delete();
    tmp.create();
    tmp.writeSync(JSON.stringify(settings));
    tmp.moveSync(new File(Paths.document, NAME), { overwrite: true });
  },
};
