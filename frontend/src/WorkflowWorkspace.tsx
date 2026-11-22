import { useTranslation } from "react-i18next";
import { Play, Eye, Check, Trash2 } from "lucide-react";
import type { Dataset } from "./api";
import { useWorkflows } from "./useWorkflows";
import StepSummary from "./StepSummary";
import ErrorDetails from "./ErrorDetails";
import StepBuilder from "./StepBuilder";
import { recipeColumns } from "./recipes";
import SchemaAssistant from "./SchemaAssistant";

export default function WorkflowWorkspace({
  datasets,
  changed,
}: {
  datasets: Dataset[];
  changed: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const w = useWorkflows(datasets, changed),
    definition = w.detail?.definition;
  return (
    <div className="cleaning-workspace" aria-busy={w.busy}>
      <p className="muted">{t("wf.intro")}</p>
      {w.error && (
        <div className="error" role="alert">
          {t(`error.${w.error}`, { defaultValue: t("error.unknown") })}
        </div>
      )}
      {w.loading ? (
        <p role="status">{t("loading")}</p>
      ) : !w.items.length ? (
        <section className="empty">
          <h2>{t("wf.empty")}</h2>
          <p>{t("wf.emptyHint")}</p>
        </section>
      ) : (
        <label>
          {t("wf.choose")}
          <select
            value={w.selected}
            disabled={w.busy}
            onChange={(e) => w.select(e.target.value)}
          >
            <option value="">{t("wf.choose")}</option>
            {w.items.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · v{x.version}
              </option>
            ))}
          </select>
        </label>
      )}
      {w.detail && definition && (
        <>
          <div className="cleaning-grid">
            <section className="recipe-panel">
              <div className="panel-title">
                <h2>{w.detail.name}</h2>
                <button
                  className="icon danger"
                  disabled={w.busy}
                  aria-label={t("wf.delete")}
                  onClick={() => {
                    if (confirm(t("wf.deleteConfirm"))) void w.remove();
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <p>{w.detail.description}</p>
              <small>
                {t("wf.schema")} {definition.input_schema.join(" · ")}
              </small>
              <ol className="workflow-steps">
                {w.draftSteps.map(({ step: s, enabled }, i) => (
                  <li key={i}>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={w.busy}
                        aria-label={t("wf.enableStep", { step: i + 1 })}
                        onChange={(e) =>
                          w.setDraftSteps((old) =>
                            old.map((d, n) =>
                              n === i ? { ...d, enabled: e.target.checked } : d,
                            ),
                          )
                        }
                      />
                      <StepSummary step={s} />
                    </label>
                    <div className="actions">
                      <button
                        className="secondary"
                        type="button"
                        disabled={w.busy || i === 0}
                        onClick={() =>
                          w.setDraftSteps((old) => {
                            const copy = [...old];
                            [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
                            return copy;
                          })
                        }
                      >
                        {t("wf.up")}
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        disabled={w.busy || i === w.draftSteps.length - 1}
                        onClick={() =>
                          w.setDraftSteps((old) => {
                            const copy = [...old];
                            [copy[i + 1], copy[i]] = [copy[i], copy[i + 1]];
                            return copy;
                          })
                        }
                      >
                        {t("wf.down")}
                      </button>
                      <button
                        className="icon danger"
                        disabled={w.busy}
                        aria-label={t("clean.removeStep", { step: i + 1 })}
                        onClick={() =>
                          w.setDraftSteps((old) =>
                            old.filter((_, n) => n !== i),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
                {definition.integration && (
                  <li>
                    <b>{t(`wf.${definition.integration.mode}`)}</b> ·{" "}
                    {definition.integration.left_key} →{" "}
                    {definition.integration.right_key}
                  </li>
                )}
              </ol>
              <details>
                <summary>{t("clean.build")}</summary>
                <StepBuilder
                  columns={recipeColumns(
                    definition.input_schema,
                    w.draftSteps.filter((d) => d.enabled).map((d) => d.step),
                  )}
                  busy={w.busy}
                  count={w.draftSteps.length}
                  onAdd={(step) =>
                    w.setDraftSteps((old) => [...old, { step, enabled: true }])
                  }
                />
              </details>
              <p className="muted">{t("wf.draftNote")}</p>
              <p className="muted">
                {t("wf.versionHistory")} {w.detail.versions.join(", ")}
              </p>
              {definition.aggregation && (
                <p>
                  {t("analyticsNav")}:{" "}
                  {t(`analytics.${definition.aggregation.operation}`)} ·{" "}
                  {definition.aggregation.measure ?? t("rows")} ·{" "}
                  {definition.aggregation.group_by}
                </p>
              )}
            </section>
            <section className="recipe-panel">
              <h2>{t("wf.runTitle")}</h2>
              <div className="step-form">
                <label>
                  {t("wf.source")}
                  <select
                    value={w.input}
                    disabled={w.busy}
                    onChange={(e) => w.setInput(e.target.value)}
                  >
                    <option value="">{t("wf.selectInput")}</option>
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · v{d.version}
                      </option>
                    ))}
                  </select>
                </label>
                {definition.integration && (
                  <label>
                    {t("wf.lookup")}
                    <select
                      value={w.lookup}
                      disabled={w.busy}
                      onChange={(e) => w.setLookup(e.target.value)}
                    >
                      <option value="">{t("wf.selectInput")}</option>
                      {datasets
                        .filter((d) => d.id !== w.input)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} · v{d.version}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <p className="muted">{t("wf.runNote")}</p>
                {datasets.find((d) => d.id === w.input) && (
                  <SchemaAssistant
                    key={`source:${w.input}`}
                    source={datasets.find((d) => d.id === w.input)!}
                    targets={definition.input_schema}
                    changed={w.inputsChanged}
                  />
                )}
                {definition.integration &&
                  datasets.find((d) => d.id === w.lookup) && (
                    <SchemaAssistant
                      key={`lookup:${w.lookup}`}
                      source={datasets.find((d) => d.id === w.lookup)!}
                      targets={definition.integration.right_schema}
                      changed={w.inputsChanged}
                    />
                  )}
                <button
                  disabled={
                    w.busy ||
                    !w.input ||
                    (!!definition.integration && !w.lookup)
                  }
                  onClick={() => void w.run()}
                >
                  <Play size={16} />
                  {t(w.busy ? "clean.working" : "wf.run")}
                </button>
              </div>
              <details className="workflow-edit">
                <summary>{t("wf.updateContract")}</summary>
                <p className="muted">{t("wf.updateHint")}</p>
                <form
                  className="step-form"
                  key={w.detail.version}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (confirm(t("wf.updateConfirm")))
                      void w.saveVersion(
                        String(f.get("name")),
                        String(f.get("description")),
                      );
                  }}
                >
                  <label>
                    {t("wf.name")}
                    <input
                      name="name"
                      required
                      defaultValue={w.detail.name}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    {t("wf.description")}
                    <input
                      name="description"
                      defaultValue={w.detail.description}
                      maxLength={1000}
                    />
                  </label>
                  <button
                    className="secondary"
                    disabled={
                      w.busy ||
                      !w.input ||
                      (!!definition.integration && !w.lookup)
                    }
                  >
                    {t("wf.saveVersion")}
                  </button>
                </form>
              </details>
            </section>
          </div>
          {w.result && (
            <section className="recipe-panel">
              <h2>{t("wf.result")}</h2>
              <p>
                {t("wf.resultCount", {
                  before: w.result.preview.before.rows,
                  after: w.result.preview.after.rows,
                })}
              </p>
              {w.result.run.summary?.unmatched_left_rows !== undefined && (
                <p className="quality-note">
                  {t("wf.joinCounts", {
                    matched: w.result.run.summary.matched_left_rows,
                    unmatched: w.result.run.summary.unmatched_left_rows,
                    unused: w.result.run.summary.unused_right_rows,
                  })}
                </p>
              )}
              <div className="preview-scroll">
                <table>
                  <thead>
                    <tr>
                      {w.result.preview.after.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {w.result.preview.after.records.map((row, i) => (
                      <tr key={i}>
                        {row.map((v, j) => (
                          <td key={j}>{v ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">
                {t("clean.previewRows")} · {t("wf.resultNote")}
              </p>
              <button
                disabled={w.busy || !w.result.preview.changed}
                onClick={() => {
                  if (confirm(t("clean.applyConfirm"))) void w.apply();
                }}
              >
                <Check size={16} />
                {t("clean.apply")}
              </button>
            </section>
          )}
          <section className="recipe-panel">
            <h2>{t("wf.history")}</h2>
            {!w.runs.length ? (
              <p className="muted">{t("wf.noRuns")}</p>
            ) : (
              <div className="run-list">
                {w.runs.map((r) => (
                  <div key={r.id}>
                    <div>
                      <b>{t(`wf.${r.status}`)}</b>
                      <small>
                        {new Intl.DateTimeFormat(i18n.language, {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(r.created_at))}{" "}
                        · v{r.workflow_version} ·{" "}
                        {t("wf.sourceVersion", { version: r.source_version })}
                      </small>
                      {r.error_code && (
                        <small className="warn">
                          {t(`error.${r.error_code}`, {
                            defaultValue: t("error.unknown"),
                          })}
                        </small>
                      )}
                      <ErrorDetails details={r.error_details} />
                      {!!r.error_details?.missing_columns?.length && (
                        <small>
                          {t("wf.missingColumns")}{" "}
                          {r.error_details.missing_columns.join(", ")}
                        </small>
                      )}
                      {!!r.error_details?.unexpected_columns?.length && (
                        <small>
                          {t("wf.unexpectedColumns")}{" "}
                          {r.error_details.unexpected_columns.join(", ")}
                        </small>
                      )}
                    </div>
                    {["pending", "running"].includes(r.status) && (
                      <button
                        className="secondary"
                        disabled={w.busy}
                        onClick={() => void w.resume(r)}
                      >
                        {t("wf.resume")}
                      </button>
                    )}
                    {r.status === "completed" && (
                      <button
                        className="secondary"
                        disabled={w.busy}
                        onClick={() => void w.inspect(r)}
                      >
                        <Eye size={15} />
                        {t("wf.viewResult")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
