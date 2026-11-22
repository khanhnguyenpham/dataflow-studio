import type { Step } from "./useCleaning";

export function recipeColumns(input: string[], steps: Step[]) {
  return steps.reduce(
    (columns, step) => {
      if (step.op === "map_columns" && step.mapping) {
        const used = new Set(step.mapping.map((pair) => pair.source));
        return [
          ...step.mapping.map((pair) => pair.target),
          ...(step.keep_extras ? columns.filter((c) => !used.has(c)) : []),
        ];
      }
      if (step.op === "rename")
        return columns.map((c) =>
          c === step.column ? String(step.name).trim().normalize("NFC") : c,
        );
      if (step.op === "split")
        return columns.flatMap((c) =>
          c === step.column
            ? (step.names as string[]).map((n) => n.trim().normalize("NFC"))
            : [c],
        );
      if (step.op === "combine")
        return [...columns, String(step.name).trim().normalize("NFC")];
      return columns;
    },
    [...input],
  );
}
