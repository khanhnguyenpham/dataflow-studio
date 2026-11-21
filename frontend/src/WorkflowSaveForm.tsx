import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Save } from "lucide-react";
import { api, post, ApiError, type Dataset, type Detail } from "./api";
import type { Step } from "./useCleaning";

export default function WorkflowSaveForm({
  detail,
  steps,
  datasets,
  columns,
  disabled,
}: {
  detail: Detail;
  steps: Step[];
  datasets: Dataset[];
  columns: string[];
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("none"),
    [rightId, setRightId] = useState(""),
    [rightColumns, setRightColumns] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!rightId) return;
    const controller = new AbortController();
    api<Detail>(`/datasets/${rightId}?page_size=1`, {
      signal: controller.signal,
    })
      .then((row) => setRightColumns(row.column_names))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.code ?? "unknown");
      });
    return () => controller.abort();
  }, [rightId]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      await post("/workflows", {
        name: String(form.get("name")),
        description: String(form.get("description")),
        dataset_id: detail.id,
        expected_version: detail.version,
        steps,
        right_dataset_id: mode === "none" ? null : rightId,
        integration:
          mode === "none"
            ? null
            : {
                mode,
                ...(mode === "append"
                  ? {}
                  : {
                      left_key: String(form.get("left_key")),
                      right_key: String(form.get("right_key")),
                    }),
                allow_unmatched: form.get("allow_unmatched") === "on",
              },
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.code : "network");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="recipe-panel">
      <details>
        <summary className="section-summary">{t("wf.saveTitle")}</summary>
        <p>{t("wf.saveHint")}</p>
        {saved && (
          <p role="status" className="success">
            {t("wf.saved")}
          </p>
        )}
        {error && (
          <div role="alert" className="error">
            {t(`error.${error}`, { defaultValue: t("error.unknown") })}
          </div>
        )}
        <form className="step-form" onSubmit={save}>
          <div className="form-row">
            <label>
              {t("wf.name")}
              <input name="name" required maxLength={100} />
            </label>
            <label>
              {t("wf.description")}
              <input name="description" maxLength={1000} />
            </label>
          </div>
          <label>
            {t("wf.integration")}
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {["none", "append", "left", "inner"].map((x) => (
                <option key={x} value={x}>
                  {t(`wf.${x}`)}
                </option>
              ))}
            </select>
          </label>
          {mode !== "none" && (
            <label>
              {t("wf.lookup")}
              <select
                required
                value={rightId}
                onChange={(e) => {
                  setRightColumns([]);
                  setRightId(e.target.value);
                }}
              >
                <option value="">{t("wf.selectInput")}</option>
                {datasets
                  .filter((d) => d.id !== detail.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · v{d.version}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {["left", "inner"].includes(mode) && (
            <>
              <div className="form-row">
                <label>
                  {t("wf.leftKey")}
                  <select name="left_key" required>
                    {columns.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("wf.rightKey")}
                  <select name="right_key" required>
                    {rightColumns.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="checkbox-label">
                <input name="allow_unmatched" type="checkbox" />
                {t("wf.allowUnmatched")}
              </label>
              <small>{t("wf.joinSafety")}</small>
            </>
          )}
          <button
            disabled={
              busy ||
              disabled ||
              (!steps.length && mode === "none") ||
              (mode !== "none" && !rightColumns.length)
            }
          >
            <Save size={16} />
            {t(busy ? "clean.working" : "wf.save")}
          </button>
        </form>
      </details>
    </section>
  );
}
