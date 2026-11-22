import { useEffect, useState } from "react";
import { post, ApiError, type Dataset } from "./api";
import type { Preview } from "./useCleaning";
export interface Suggestions {
  source_columns: string[];
  items: {
    target: string;
    suggested_source: string | null;
    status: string;
    candidates: { source: string; score: number; reason: string }[];
  }[];
}
export function useSchemaAssistant(
  source: Dataset,
  targets: string[],
  changed: () => Promise<void>,
) {
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null),
    [choices, setChoices] = useState<Record<string, string>>({}),
    [dropExtras, setDropExtras] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    setSuggestions(null);
    setChoices({});
    setPreview(null);
    setDropExtras(false);
  }, [source.version]);
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof ApiError ? e.code : "network");
    } finally {
      setBusy(false);
    }
  }
  const selected = targets.map((target) => choices[target]).filter(Boolean);
  const extras =
    suggestions?.source_columns.filter((c) => !selected.includes(c)) ?? [];
  const complete =
    selected.length === targets.length &&
    new Set(selected).size === selected.length;
  return {
    suggestions,
    choices,
    dropExtras,
    preview,
    busy,
    error,
    saved,
    extras,
    complete,
    choose: (target: string, value: string) => {
      setChoices((old) => ({ ...old, [target]: value }));
      setPreview(null);
      setSaved(false);
    },
    drop: (value: boolean) => {
      setDropExtras(value);
      setPreview(null);
    },
    inspect: () =>
      perform(async () => {
        const result = await post<Suggestions>(
          `/datasets/${source.id}/column-suggestions`,
          { expected_version: source.version, targets },
        );
        setSuggestions(result);
        setChoices(
          Object.fromEntries(
            result.items.map((item) => [
              item.target,
              item.suggested_source ?? "",
            ]),
          ),
        );
        setPreview(null);
        setSaved(false);
      }),
    prepare: () =>
      perform(async () => {
        setPreview(
          await post<Preview>(`/datasets/${source.id}/preview`, {
            expected_version: source.version,
            steps: [
              {
                op: "map_columns",
                mapping: targets.map((target) => ({
                  source: choices[target],
                  target,
                })),
                keep_extras: !dropExtras,
              },
            ],
          }),
        );
      }),
    apply: () =>
      perform(async () => {
        if (!preview) return;
        await post(`/datasets/${source.id}/preview/${preview.id}/apply`);
        setPreview(null);
        await changed();
        setSaved(true);
      }),
  };
}
