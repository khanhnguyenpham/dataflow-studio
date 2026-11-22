import { useEffect, useState } from "react";
import {
  api,
  post,
  download,
  ApiError,
  type Detail,
  type ProblemDetails,
} from "./api";

export interface ColumnMapping {
  source: string;
  target: string;
}
export interface Step {
  op: string;
  columns?: string[];
  column?: string;
  name?: string;
  names?: string[];
  mapping?: ColumnMapping[];
  keep_extras?: boolean;
  [key: string]: string | string[] | ColumnMapping[] | boolean | undefined;
}
export interface Slice {
  columns: string[];
  records: (string | null)[][];
  rows: number;
}
export interface Preview {
  id: string;
  input_version: number;
  expires_at: string;
  changed: boolean;
  before: Slice;
  after: Slice;
  impacts: {
    op: string;
    rows_before: number;
    rows_after: number;
    cell_updates: number;
  }[];
}
export interface Version {
  number: number;
  parent: number | null;
  rows: number;
  created_at: string;
  steps: Step[];
}

// One map per mounted identity; never written to browser storage or the server.
export type CleaningDrafts = Map<string, { version: number; steps: Step[] }>;

export function useCleaning(
  detail: Detail,
  changed: () => Promise<void>,
  drafts: CleaningDrafts,
) {
  const [steps, setSteps] = useState<Step[]>(() => {
      const draft = drafts.get(detail.id);
      return draft?.version === detail.version ? draft.steps : [];
    }),
    [preview, setPreview] = useState<Preview | null>(null);
  const [versions, setVersions] = useState<Version[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<ProblemDetails>();
  useEffect(() => {
    if (drafts.get(detail.id)?.version !== detail.version)
      drafts.delete(detail.id);
    const controller = new AbortController();
    api<{ items: Version[] }>(`/datasets/${detail.id}/versions`, {
      signal: controller.signal,
    })
      .then((result) => setVersions(result.items))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.code ?? "unknown");
      });
    return () => controller.abort();
  }, [detail.id, detail.version, drafts]);
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setErrorDetails(undefined);
    try {
      await work();
    } catch (e) {
      setError(e instanceof ApiError ? e.code : "network");
      setErrorDetails(e instanceof ApiError ? e.details : undefined);
    } finally {
      setBusy(false);
    }
  }
  const updateSteps = (value: Step[]) => {
    if (value.length)
      drafts.set(detail.id, { version: detail.version, steps: value });
    else drafts.delete(detail.id);
    setSteps(value);
    setPreview(null);
    setError("");
    setErrorDetails(undefined);
  };
  return {
    steps,
    updateSteps,
    preview,
    versions,
    busy,
    error,
    errorDetails,
    inspect: () =>
      perform(async () =>
        setPreview(
          await post<Preview>(`/datasets/${detail.id}/preview`, {
            expected_version: detail.version,
            steps,
          }),
        ),
      ),
    apply: () =>
      perform(async () => {
        if (!preview) return;
        await post(`/datasets/${detail.id}/preview/${preview.id}/apply`);
        drafts.delete(detail.id);
        setPreview(null);
        setSteps([]);
        await changed();
      }),
    restore: (version: number) =>
      perform(async () => {
        await post(`/datasets/${detail.id}/restore`, {
          expected_version: detail.version,
          version,
        });
        drafts.delete(detail.id);
        setPreview(null);
        setSteps([]);
        await changed();
      }),
    export: (format: string) =>
      perform(() =>
        download(
          `/datasets/${detail.id}/export`,
          {
            expected_version: detail.version,
            format,
            confirmed: true,
          },
          `dataflow-v${detail.version}.${format === "quality" ? "quality.json" : format}`,
        ),
      ),
  };
}
