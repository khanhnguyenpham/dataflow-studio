import { useEffect, useRef, useState } from "react";
import {
  api,
  post,
  download,
  ApiError,
  type Dataset,
  type Detail,
} from "./api";

export interface AggregateSpec {
  group_by: string;
  operation: string;
  measure: string | null;
  chart_type: string;
  filters: { op: "filter"; column: string; operator: string; value: string }[];
}
export interface AggregateResult {
  items: { group: string | null; value: string | null; rows: number }[];
  metrics: {
    input_rows: number;
    filtered_rows: number;
    groups: number;
    missing_values: number;
    valid_values: number;
    overall: string | null;
  };
}
export interface Report {
  id: string;
  name: string;
  dataset_id: string;
  dataset_version: number;
  specification: AggregateSpec;
  created_at: string;
}
export interface SavedReport extends Report {
  result: AggregateResult;
}

export function useAnalytics(datasets: Dataset[]) {
  const [input, setInput] = useState(""),
    [detail, setDetail] = useState<Detail | null>(null),
    [spec, setSpec] = useState<AggregateSpec>({
      group_by: "",
      operation: "count",
      measure: null,
      chart_type: "bar",
      filters: [],
    }),
    [result, setResult] = useState<AggregateResult | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [reports, setReports] = useState<Report[]>([]),
    [saved, setSaved] = useState<SavedReport | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState(1);
  const currentVersion = datasets.find((d) => d.id === input)?.version;
  const [workflowSaved, setWorkflowSaved] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    api<{ items: Report[] }>("/reports", { signal: controller.signal })
      .then((x) => setReports(x.items))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.code ?? "unknown");
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!input) return;
    const controller = new AbortController();
    const ticket = ++generation.current;
    api<Detail>(`/datasets/${input}?page_size=1`, { signal: controller.signal })
      .then((row) => {
        if (ticket !== generation.current) return;
        setDetail(row);
        setSpec({
          group_by: row.column_names[0],
          operation: "count",
          measure: null,
          chart_type: "bar",
          filters: [],
        });
        setResult(null);
        setConfirmed(false);
        setPage(1);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.code ?? "unknown");
      });
    return () => controller.abort();
  }, [input, currentVersion]);
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
  function body() {
    return {
      dataset_id: input,
      expected_version: detail?.version,
      specification: spec,
      confirmed,
    };
  }
  return {
    input,
    detail,
    spec,
    result,
    confirmed,
    setConfirmed,
    reports,
    saved,
    busy,
    error,
    workflowSaved,
    page,
    setPage,
    select: (id: string) => {
      setWorkflowSaved(false);
      setInput(id);
      setDetail(null);
      setResult(null);
      setSaved(null);
      setError("");
      setConfirmed(false);
    },
    update: (value: AggregateSpec) => {
      setWorkflowSaved(false);
      setSpec(value);
      setResult(null);
      setPage(1);
      setError("");
    },
    preview: () =>
      perform(async () => {
        setResult(await post<AggregateResult>("/reports/preview", body()));
        setPage(1);
      }),
    saveWorkflow: (name: string) =>
      perform(async () => {
        await post("/workflows", {
          name,
          description: "",
          dataset_id: input,
          expected_version: detail?.version,
          steps: [],
          aggregation: spec,
        });
        setWorkflowSaved(true);
      }),
    save: (name: string) =>
      perform(async () => {
        const row = await post<SavedReport>("/reports", { ...body(), name });
        setSaved(row);
        setReports((old) => [row, ...old]);
        setResult(row.result);
        setPage(1);
      }),
    open: (id: string) =>
      perform(async () => {
        const ticket = ++generation.current;
        const row = await api<SavedReport>(`/reports/${id}`);
        if (ticket !== generation.current) return;
        setSaved(row);
        setResult(row.result);
        setPage(1);
      }),
    reset: () => {
      ++generation.current;
      setSaved(null);
      setResult(null);
      setPage(1);
    },
    remove: () =>
      perform(async () => {
        if (!saved) return;
        await api(`/reports/${saved.id}`, { method: "DELETE" });
        setReports((old) => old.filter((r) => r.id !== saved.id));
        setSaved(null);
        setResult(null);
      }),
    export: (format: string) =>
      perform(async () => {
        if (!saved) return;
        await download(
          `/reports/${saved.id}/export`,
          { format, confirmed: true },
          `dataflow-report.${format}`,
        );
      }),
  };
}
