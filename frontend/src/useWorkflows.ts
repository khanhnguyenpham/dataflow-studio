import { useEffect, useRef, useState } from "react";
import { api, post, ApiError, type Dataset } from "./api";
import type { Preview, Step } from "./useCleaning";
import type { AggregateSpec } from "./useAnalytics";

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
}
export interface WorkflowDetail extends Workflow {
  versions: number[];
  definition: {
    input_schema: string[];
    steps: Step[];
    aggregation?: AggregateSpec | null;
    integration: null | {
      mode: string;
      right_schema: string[];
      left_key: string;
      right_key: string;
      allow_unmatched: boolean;
    };
  };
}
export interface Run {
  id: string;
  workflow_version: number;
  dataset_id: string;
  source_version: number;
  status: string;
  preview_id: string | null;
  error_code: string | null;
  error_details?: { missing_columns?: string[]; unexpected_columns?: string[] };
  created_at: string;
  summary: Record<string, number> | null;
}

export function useWorkflows(
  datasets: Dataset[],
  changed: () => Promise<void>,
) {
  const [items, setItems] = useState<Workflow[]>([]),
    [selected, setSelected] = useState(""),
    [detail, setDetail] = useState<WorkflowDetail | null>(null),
    [runs, setRuns] = useState<Run[]>([]),
    [input, setInput] = useState(""),
    [lookup, setLookup] = useState(""),
    [result, setResult] = useState<{ run: Run; preview: Preview } | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [draftSteps, setDraftSteps] = useState<
    { step: Step; enabled: boolean }[]
  >([]);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<{ items: Workflow[] }>("/workflows", { signal: controller.signal })
      .then((x) => setItems(x.items))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.code ?? "unknown");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    Promise.all([
      api<WorkflowDetail>(`/workflows/${selected}`, {
        signal: controller.signal,
      }),
      api<{ items: Run[] }>(`/workflows/${selected}/runs`, {
        signal: controller.signal,
      }),
    ])
      .then(([definition, history]) => {
        setDetail(definition);
        setDraftSteps(
          definition.definition.steps.map((step) => ({ step, enabled: true })),
        );
        setRuns(history.items);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.code ?? "unknown");
      });
    return () => controller.abort();
  }, [selected]);
  async function perform(work: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setError(e instanceof ApiError ? e.code : "network");
    } finally {
      setBusy(false);
    }
  }
  async function loadResult(run: Run) {
    const preview = await api<Preview>(
      `/workflows/${selected}/runs/${run.id}/result`,
    );
    setResult({ run, preview });
  }
  return {
    items,
    selected,
    detail,
    draftSteps,
    setDraftSteps,
    runs,
    input,
    setInput: (id: string) => {
      setInput(id);
      setResult(null);
    },
    lookup,
    setLookup: (id: string) => {
      setLookup(id);
      setResult(null);
    },
    result,
    busy,
    loading,
    error,
    select: (id: string) => {
      setSelected(id);
      setDetail(null);
      setResult(null);
      setRuns([]);
      setError("");
      setInput("");
      setLookup("");
    },
    run: () =>
      perform(async () => {
        setResult(null);
        if (!detail) return;
        const source = datasets.find((d) => d.id === input),
          right = datasets.find((d) => d.id === lookup);
        const body = {
          workflow_version: detail.version,
          dataset_id: input,
          expected_version: source?.version,
          right_dataset_id: detail.definition.integration ? lookup : null,
          expected_right_version: detail.definition.integration
            ? right?.version
            : null,
        };
        const fingerprint = JSON.stringify({ workflow: selected, ...body });
        if (!attempt.current || attempt.current.fingerprint !== fingerprint)
          attempt.current = { fingerprint, key: crypto.randomUUID() };
        const pending = await post<Run>(`/workflows/${selected}/runs`, {
          ...body,
          idempotency_key: attempt.current.key,
        });
        setRuns((old) => [pending, ...old.filter((r) => r.id !== pending.id)]);
        const completed = await post<Run>(
          `/workflows/${selected}/runs/${pending.id}/execute`,
        );
        setRuns((old) => [
          completed,
          ...old.filter((r) => r.id !== completed.id),
        ]);
        if (["completed", "failed"].includes(completed.status))
          attempt.current = null;
        if (completed.status === "failed")
          throw new ApiError(completed.error_code ?? "execution_failed", 422);
        if (completed.status === "completed") await loadResult(completed);
      }),
    inspect: (run: Run) => perform(() => loadResult(run)),
    apply: () =>
      perform(async () => {
        if (!result) return;
        await post(
          `/datasets/${result.run.dataset_id}/preview/${result.preview.id}/apply`,
        );
        setResult(null);
        await changed();
      }),
    remove: () =>
      perform(async () => {
        await api(`/workflows/${selected}`, { method: "DELETE" });
        setItems((old) => old.filter((w) => w.id !== selected));
        setSelected("");
        setDetail(null);
        setResult(null);
      }),
    saveVersion: (name: string, description: string) =>
      perform(async () => {
        if (!detail) return;
        const source = datasets.find((d) => d.id === input);
        const integration = detail.definition.integration;
        const saved = await post<WorkflowDetail>(`/workflows/${selected}`, {
          name,
          description,
          expected_workflow_version: detail.version,
          dataset_id: input,
          expected_version: source?.version,
          steps: draftSteps.filter((d) => d.enabled).map((d) => d.step),
          aggregation: detail.definition.aggregation ?? null,
          right_dataset_id: integration ? lookup : null,
          integration: integration
            ? {
                mode: integration.mode,
                left_key: integration.left_key,
                right_key: integration.right_key,
                allow_unmatched: integration.allow_unmatched,
              }
            : null,
        });
        setDetail({ ...saved, versions: [...detail.versions, saved.version] });
        setDraftSteps(
          saved.definition.steps.map((step) => ({ step, enabled: true })),
        );
        setItems((old) => old.map((w) => (w.id === selected ? saved : w)));
      }),
  };
}
