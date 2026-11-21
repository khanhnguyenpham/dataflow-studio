import type { Step } from "./useCleaning";

export function recipeColumns(input: string[], steps: Step[]) {
  return steps.reduce(
    (columns, step) => {
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
