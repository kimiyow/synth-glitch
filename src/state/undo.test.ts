import { expect, it } from "@jest/globals";
import { array, assert, integer, property, record } from "fast-check";

import { change, EMPTY_HISTORY, MAX_UNDO, redo, undo, type UndoHistory } from "./undo";

type S = { seed: number; layers: { id: string; x: number }[] };

it("deshacer todo vuelve al inicio y rehacer todo al final (cambios aleatorios)", () => {
  assert(
    property(array(record({ op: integer({ min: 0, max: 2 }), n: integer({ min: 0, max: 9 }) }), { maxLength: 40 }), (ops) => {
      const start: S = { seed: 0, layers: [] };
      let value = start;
      let history: UndoHistory = EMPTY_HISTORY;
      for (const { op, n } of ops) {
        ({ value, history } = change(value, history, "x", (d) => {
          if (op === 0) d.seed = n;
          else if (op === 1) d.layers.push({ id: `l${n}`, x: n / 10 });
          else if (d.layers.length) d.layers[n % d.layers.length].x = n / 9;
        }));
      }
      const end = value;
      for (let r = undo(value, history); r; r = undo(value, history)) ({ value, history } = r);
      expect(value).toEqual(start);
      for (let r = redo(value, history); r; r = redo(value, history)) ({ value, history } = r);
      expect(value).toEqual(end);
    }),
  );
});

it("un cambio nuevo vacía rehacer, sin diferencias no hay entrada y el límite es 100", () => {
  let value = { seed: 0, layers: [] } as S;
  let history: UndoHistory = EMPTY_HISTORY;
  ({ value, history } = change(value, history, "a", (d) => void (d.seed = 1)));
  const u = undo(value, history)!;
  ({ value, history } = change(u.value, u.history, "b", (d) => void (d.seed = 2)));
  expect(history.future).toEqual([]);
  expect(change(value, history, "nada", (d) => void (d.seed = 2)).history).toBe(history);
  for (let i = 0; i < MAX_UNDO + 20; i++) ({ value, history } = change(value, history, "n", (d) => void (d.seed = i + 10)));
  expect(history.past).toHaveLength(MAX_UNDO);
});
