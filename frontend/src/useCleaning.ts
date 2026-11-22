import { useEffect, useState } from "react";
import { api, post, download, ApiError, type Detail } from "./api";

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

export function useCleaning(detail: Detail, changed: () => Promise<void>) {
  const [steps, setSteps] = useState<Step[]>([]),
    [preview, setPreview] = useState<Preview | null>(null);
  const [versions, setVersions] = useState<Version[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<{ items: Version[] }>(`/datasets/${detail.id}/versions`, {
      signal: controller.signal,
    })
      .then((result) => setVersions(result.items))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.code ?? "unknown");
      });
    return () => controller.abort();
  }, [detail.id, detail.version]);
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
  const updateSteps = (value: Step[]) => {
    setSteps(value);
    setPreview(null);
    setError("");
  };
  return {
    steps,
    updateSteps,
    preview,
    versions,
    busy,
    error,
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
