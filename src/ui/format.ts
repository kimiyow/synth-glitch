const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** "3 NOV" en hora local; vacío si la fecha no es válida. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export const MEDIA_KIND_LABEL = { photo: "FOTO", clip: "CLIP", generative: "GENERATIVO" } as const;
