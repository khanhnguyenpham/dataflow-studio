import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Eye, RotateCcw, Trash2, Check } from "lucide-react";
import type { Dataset, Detail } from "./api";
import StepSummary from "./StepSummary";
import ErrorDetails from "./ErrorDetails";
import { recipeColumns } from "./recipes";
import StepBuilder from "./StepBuilder";
import WorkflowSaveForm from "./WorkflowSaveForm";
import { useCleaning, type Slice } from "./useCleaning";

function PreviewTable({ value, label }: { value: Slice; label: string }) {
  const { t, i18n } = useTranslation();
  return (
    <section className="preview-side">
      <h3>
        {label}{" "}
        <span>
          {new Intl.NumberFormat(i18n.language).format(value.rows)} {t("rows")}
        </span>
      </h3>
      <div className="preview-scroll">
        <table>
          <thead>
            <tr>
              {value.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {value.records.map((row, i) => (
              <tr key={i}>
                {row.map((v, j) => (
                  <td key={j}>{v ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function CleaningWorkspace({
  detail,
  changed,
  datasets,
}: {
  detail: Detail;
  changed: () => Promise<void>;
  datasets: Dataset[];
}) {
  const { t } = useTranslation();
  const w = useCleaning(detail, changed);
  const [format, setFormat] = useState("xlsx"),
    [confirmed, setConfirmed] = useState(false);
  const columns = recipeColumns(detail.column_names, w.steps);
  return (
    <div className="cleaning-workspace" aria-busy={w.busy}>
      <div className="version-banner">
        <div>
          <strong>{detail.name}</strong>
          <span>
            {t("clean.version", { version: detail.version })} ·{" "}
            {t("clean.sourceSafe")}
          </span>
        </div>
      </div>
      {w.error && (
        <div className="error" role="alert">
          {t(`error.${w.error}`, { defaultValue: t("error.unknown") })}
          <ErrorDetails details={w.errorDetails} />
        </div>
      )}
      <div className="cleaning-grid">
        <section className="recipe-panel">
          <h2>{t("clean.build")}</h2>
          <p>{t("clean.instructions")}</p>
          <StepBuilder
            columns={columns}
            onAdd={(step) => w.updateSteps([...w.steps, step])}
            busy={w.busy}
            count={w.steps.length}
          />
        </section>
        <section className="recipe-panel">
          <h2>{t("clean.recipe")}</h2>
          {!w.steps.length && <p className="muted">{t("clean.emptyRecipe")}</p>}
          <ol className="recipe-list">
            {w.steps.map((step, i) => (
              <li key={i}>
                <div>
                  <StepSummary step={step} />
                </div>
                <button
                  className="icon danger"
                  disabled={w.busy}
                  aria-label={t("clean.removeStep", { step: i + 1 })}
                  onClick={() =>
                    w.updateSteps(w.steps.filter((_, n) => i !== n))
                  }
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ol>
          <div className="actions">
            <button
              disabled={!w.steps.length || w.busy}
              onClick={() => void w.inspect()}
            >
              <Eye size={16} />
              {t(w.busy ? "clean.working" : "clean.preview")}
            </button>
            <button
              className="secondary"
              disabled={!w.steps.length || w.busy}
              onClick={() => w.updateSteps([])}
            >
              {t("clean.clear")}
            </button>
          </div>
          <p className="muted">{t("clean.previewNote")}</p>
        </section>
      </div>
      <WorkflowSaveForm
        detail={detail}
        steps={w.steps}
        datasets={datasets}
        columns={columns}
        disabled={w.busy}
      />
      {w.preview && (
        <section className="recipe-panel preview-result">
          <div className="panel-title">
            <h2>{t("clean.review")}</h2>
            <span>{t("clean.previewRows")}</span>
          </div>
          <div className="before-after">
            <PreviewTable value={w.preview.before} label={t("clean.before")} />
            <PreviewTable value={w.preview.after} label={t("clean.after")} />
          </div>
          <ul className="impact-list">
            {w.preview.impacts.map((impact, i) => (
              <li key={i}>
                <b>{t(`op.${impact.op}`)}</b>
                <span>
                  {t("clean.impact", {
                    before: impact.rows_before,
                    after: impact.rows_after,
                    cells: impact.cell_updates,
                  })}
                </span>
              </li>
            ))}
          </ul>
          {!w.preview.changed ? (
            <p>{t("clean.noChanges")}</p>
          ) : (
            <button
              disabled={w.busy}
              onClick={() => {
                if (confirm(t("clean.applyConfirm"))) void w.apply();
              }}
            >
              <Check size={17} />
              {t("clean.apply")}
            </button>
          )}
        </section>
      )}
      <div className="cleaning-grid">
        <section className="recipe-panel">
          <h2>{t("clean.history")}</h2>
          <div className="version-list">
            {w.versions.map((v) => (
              <div key={v.number}>
                <div>
                  <b>{t("clean.version", { version: v.number })}</b>
                  <small>
                    {v.parent
                      ? t("clean.parent", { version: v.parent })
                      : t("clean.original")}{" "}
                    · {v.rows} {t("rows")}
                  </small>
                </div>
                {v.number === detail.version ? (
                  <span className="type">{t("clean.current")}</span>
                ) : (
                  <button
                    className="secondary"
                    disabled={w.busy}
                    onClick={() => {
                      if (confirm(t("clean.restoreConfirm")))
                        void w.restore(v.number);
                    }}
                  >
                    <RotateCcw size={14} />
                    {t("clean.restore")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="recipe-panel">
          <h2>{t("clean.export")}</h2>
          <p>{t("clean.exportNote")}</p>
          <label>
            {t("clean.fileFormat")}
            <select
              value={format}
              onChange={(e) => {
                setFormat(e.target.value);
                setConfirmed(false);
              }}
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="json">JSON (.json)</option>
              <option value="quality">{t("clean.qualityReport")}</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t("clean.exportConfirm", { version: detail.version })}
          </label>
          <button
            disabled={!confirmed || w.busy}
            onClick={() => void w.export(format)}
          >
            <Download size={16} />
            {t("clean.download")}
          </button>
        </section>
      </div>
    </div>
  );
}
