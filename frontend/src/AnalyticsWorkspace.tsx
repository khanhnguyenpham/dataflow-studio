import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, Download, Eye, Save, Trash2 } from "lucide-react";
import type { Dataset } from "./api";
import { useAnalytics } from "./useAnalytics";
import DataChart from "./DataChart";

export default function AnalyticsWorkspace({
  datasets,
}: {
  datasets: Dataset[];
}) {
  const { t, i18n } = useTranslation(),
    w = useAnalytics(datasets);
  const [exportFormat, setExportFormat] = useState("csv");
  const spec = w.saved?.specification ?? w.spec;
  const fmt = (value: number | string | null) =>
    value === null
      ? "—"
      : new Intl.NumberFormat(i18n.language, {
          maximumFractionDigits: 3,
        }).format(Number(value));
  const filter = w.spec.filters[0];
  return (
    <div className="cleaning-workspace" aria-busy={w.busy}>
      {w.error && (
        <div className="error" role="alert">
          {t(`error.${w.error}`, { defaultValue: t("error.unknown") })}
        </div>
      )}
      {w.workflowSaved && (
        <p className="success" role="status">
          {t("analytics.workflowSaved")}
        </p>
      )}
      <div className="report-toolbar">
        <label>
          {t("analytics.savedReports")}
          <select
            value={w.saved?.id ?? ""}
            disabled={w.busy}
            onChange={(e) =>
              e.target.value ? void w.open(e.target.value) : w.reset()
            }
          >
            <option value="">{t("analytics.new")}</option>
            {w.reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · v{r.dataset_version}
              </option>
            ))}
          </select>
        </label>
      </div>
      {w.saved ? (
        <section className="version-banner">
          <div>
            <strong>{w.saved.name}</strong>
            <span>
              {t("analytics.pinned", { version: w.saved.dataset_version })}
            </span>
            <span>
              {t(`analytics.${spec.operation}`)} · {spec.measure ?? t("rows")} ·{" "}
              {spec.group_by}
            </span>
          </div>
          <button
            className="icon danger"
            aria-label={t("analytics.delete")}
            disabled={w.busy}
            onClick={() => {
              if (confirm(t("analytics.deleteConfirm"))) void w.remove();
            }}
          >
            <Trash2 size={17} />
          </button>
        </section>
      ) : (
        <section className="recipe-panel">
          <h2>{t("analytics.build")}</h2>
          <div className="analytics-form">
            <label>
              {t("analytics.dataset")}
              <select
                value={w.input}
                disabled={w.busy}
                onChange={(e) => w.select(e.target.value)}
              >
                <option value="">{t("wf.selectInput")}</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · v{d.version}
                  </option>
                ))}
              </select>
            </label>
            {w.detail && (
              <>
                <label>
                  {t("analytics.groupBy")}
                  <select
                    value={w.spec.group_by}
                    disabled={w.busy}
                    onChange={(e) =>
                      w.update({ ...w.spec, group_by: e.target.value })
                    }
                  >
                    {w.detail.column_names.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("analytics.operation")}
                  <select
                    value={w.spec.operation}
                    disabled={w.busy}
                    onChange={(e) =>
                      w.update({
                        ...w.spec,
                        operation: e.target.value,
                        measure: null,
                      })
                    }
                  >
                    {["count", "sum", "average"].map((v) => (
                      <option key={v} value={v}>
                        {t(`analytics.${v}`)}
                      </option>
                    ))}
                  </select>
                </label>
                {w.spec.operation !== "count" && (
                  <label>
                    {t("analytics.measure")}
                    <select
                      value={w.spec.measure ?? ""}
                      disabled={w.busy}
                      onChange={(e) =>
                        w.update({ ...w.spec, measure: e.target.value })
                      }
                    >
                      <option value="">{t("analytics.selectMeasure")}</option>
                      {w.detail.column_names.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  {t("analytics.chart")}
                  <select
                    value={w.spec.chart_type}
                    disabled={w.busy}
                    onChange={(e) =>
                      w.update({ ...w.spec, chart_type: e.target.value })
                    }
                  >
                    {["bar", "line", "pie"].map((v) => (
                      <option key={v} value={v}>
                        {t(`analytics.${v}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <details className="analytics-filter">
                  <summary>{t("analytics.filter")}</summary>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      disabled={w.busy}
                      checked={!!filter}
                      onChange={(e) =>
                        w.update({
                          ...w.spec,
                          filters: e.target.checked
                            ? [
                                {
                                  op: "filter",
                                  column: w.detail!.column_names[0],
                                  operator: "eq",
                                  value: "",
                                },
                              ]
                            : [],
                        })
                      }
                    />
                    {t("analytics.enableFilter")}
                  </label>
                  {filter && (
                    <div className="form-row">
                      <label>
                        {t("field")}
                        <select
                          value={filter.column}
                          disabled={w.busy}
                          onChange={(e) =>
                            w.update({
                              ...w.spec,
                              filters: [{ ...filter, column: e.target.value }],
                            })
                          }
                        >
                          {w.detail.column_names.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t("clean.condition")}
                        <select
                          value={filter.operator}
                          disabled={w.busy}
                          onChange={(e) =>
                            w.update({
                              ...w.spec,
                              filters: [
                                { ...filter, operator: e.target.value },
                              ],
                            })
                          }
                        >
                          {["eq", "ne", "contains", "gt", "lt"].map((v) => (
                            <option key={v} value={v}>
                              {t(`clean.${v}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t("clean.value")}
                        <input
                          value={filter.value}
                          disabled={w.busy}
                          maxLength={500}
                          onChange={(e) =>
                            w.update({
                              ...w.spec,
                              filters: [{ ...filter, value: e.target.value }],
                            })
                          }
                        />
                      </label>
                    </div>
                  )}
                </details>
              </>
            )}
          </div>
          <p className="muted">{t("analytics.numberPolicy")}</p>
          {w.detail && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={w.confirmed}
                disabled={w.busy}
                onChange={(e) => w.setConfirmed(e.target.checked)}
              />
              {t("analytics.confirmVersion", { version: w.detail.version })}
            </label>
          )}
          <button
            disabled={
              w.busy ||
              !w.detail ||
              !w.confirmed ||
              (w.spec.operation !== "count" && !w.spec.measure)
            }
            onClick={() => void w.preview()}
          >
            <Eye size={16} />
            {t(w.busy ? "clean.working" : "analytics.preview")}
          </button>
        </section>
      )}
      {w.result && (
        <>
          <section className="metrics" aria-label={t("analytics.metrics")}>
            {[
              ["filteredRows", w.result.metrics.filtered_rows],
              ["groups", w.result.metrics.groups],
              ["overall", w.result.metrics.overall],
              ["excluded", w.result.metrics.missing_values],
            ].map(([key, value]) => (
              <div key={key}>
                <span>{t(`analytics.${key}`)}</span>
                <strong>{fmt(value)}</strong>
              </div>
            ))}
          </section>
          <section className="recipe-panel">
            <h2>{w.saved?.name ?? t("analytics.result")}</h2>
            <DataChart
              result={w.result}
              type={spec.chart_type}
              title={`${t(`analytics.${spec.operation}`)} · ${spec.group_by}`}
            />
            <div className="preview-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{spec.group_by}</th>
                    <th>{t(`analytics.${spec.operation}`)}</th>
                    <th>{t("analytics.sourceRows")}</th>
                  </tr>
                </thead>
                <tbody>
                  {w.result.items
                    .slice((w.page - 1) * 25, w.page * 25)
                    .map((r, i) => (
                      <tr key={i}>
                        <td>{r.group ?? t("analytics.missingGroup")}</td>
                        <td title={r.value ?? ""}>{fmt(r.value)}</td>
                        <td>{fmt(r.rows)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>{t("page", { page: w.page })}</span>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={w.page === 1}
                  onClick={() => w.setPage(w.page - 1)}
                >
                  {t("previous")}
                </button>
                <button
                  className="secondary"
                  disabled={w.page * 25 >= w.result!.items.length}
                  onClick={() => w.setPage(w.page + 1)}
                >
                  {t("next")}
                </button>
              </div>
            </div>
          </section>
          {!w.saved ? (
            <form
              className="recipe-panel save-report"
              onSubmit={(e) => {
                e.preventDefault();
                const name = String(new FormData(e.currentTarget).get("name"));
                const submitter = (e.nativeEvent as SubmitEvent)
                  .submitter as HTMLButtonElement | null;
                if (submitter?.value === "workflow") void w.saveWorkflow(name);
                else void w.save(name);
              }}
            >
              <label>
                {t("analytics.reportName")}
                <input name="name" required maxLength={100} />
              </label>
              <button value="report" disabled={w.busy || !w.confirmed}>
                <Save size={16} />
                {t("analytics.save")}
              </button>
              <button
                value="workflow"
                className="secondary"
                disabled={w.busy || !w.confirmed}
              >
                {t("analytics.saveWorkflow")}
              </button>
            </form>
          ) : (
            <section className="recipe-panel">
              <p>{t("analytics.exportNote")}</p>
              <div className="actions">
                <label>
                  {t("clean.fileFormat")}
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                </label>
                <button
                  disabled={w.busy}
                  onClick={() => {
                    if (confirm(t("analytics.exportConfirm")))
                      void w.export(exportFormat);
                  }}
                >
                  <Download size={16} />
                  {t("clean.download")}
                </button>
              </div>
            </section>
          )}
        </>
      )}
      {!w.input && !w.saved && (
        <section className="empty">
          <BarChart3 size={32} />
          <p>{t("analytics.start")}</p>
        </section>
      )}
    </div>
  );
}
