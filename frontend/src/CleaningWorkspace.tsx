import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Download, Eye, Plus, RotateCcw, Trash2, Check } from "lucide-react";
import type { Detail } from "./api";
import { useCleaning, type Step, type Slice } from "./useCleaning";

const operations = [
  "trim",
  "unicode",
  "rename",
  "fill_null",
  "replace",
  "dedupe",
  "date",
  "number",
  "filter",
  "split",
  "combine",
];
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
}: {
  detail: Detail;
  changed: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const w = useCleaning(detail, changed);
  const [op, setOp] = useState("trim"),
    [format, setFormat] = useState("xlsx"),
    [confirmed, setConfirmed] = useState(false);
  const columns = w.steps.reduce(
    (cols, step) => {
      if (step.op === "rename")
        return cols.map((c) =>
          c === step.column ? String(step.name).trim() : c,
        );
      if (step.op === "split")
        return cols.flatMap((c) =>
          c === step.column ? (step.names as string[]) : [c],
        );
      if (step.op === "combine") return [...cols, String(step.name)];
      return cols;
    },
    [...detail.column_names],
  );
  const multi = ["trim", "unicode", "dedupe", "combine"].includes(op);
  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const step: Step = { op };
    for (const [key, value] of form.entries())
      if (key !== "columns") step[key] = String(value);
    if (multi) step.columns = form.getAll("columns").map(String);
    if (op === "date") step.formats = [String(step.formats)];
    if (op === "split")
      step.names = String(step.names)
        .split(",")
        .map((s) => s.trim());
    w.updateSteps([...w.steps, step]);
  }
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
        </div>
      )}
      <div className="cleaning-grid">
        <section className="recipe-panel">
          <h2>{t("clean.build")}</h2>
          <p>{t("clean.instructions")}</p>
          <form onSubmit={add} className="step-form" key={op}>
            <label>
              {t("clean.operation")}
              <select
                value={op}
                onChange={(e) => setOp(e.target.value)}
                disabled={w.busy}
              >
                {operations.map((x) => (
                  <option key={x} value={x}>
                    {t(`op.${x}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t(multi ? "clean.chooseColumns" : "field")}
              <select
                name={multi ? "columns" : "column"}
                multiple={multi}
                defaultValue={
                  multi
                    ? columns.slice(0, op === "combine" ? 2 : columns.length)
                    : columns[0]
                }
                required
              >
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            {multi && <small>{t("clean.multipleHelp")}</small>}
            {["rename", "combine"].includes(op) && (
              <label>
                {t("clean.newName")}
                <input name="name" required maxLength={255} />
              </label>
            )}
            {["fill_null", "replace", "filter"].includes(op) && (
              <label>
                {t("clean.value")}
                <input name="value" maxLength={500} />
              </label>
            )}
            {op === "replace" && (
              <label>
                {t("clean.oldValue")}
                <input name="old" maxLength={500} />
              </label>
            )}
            {op === "date" && (
              <label>
                {t("clean.dateFormat")}
                <select name="formats">
                  <option value="%Y-%m-%d">YYYY-MM-DD</option>
                  <option value="%d/%m/%Y">DD/MM/YYYY</option>
                  <option value="%m/%d/%Y">MM/DD/YYYY</option>
                </select>
              </label>
            )}
            {op === "number" && (
              <div className="form-row">
                <label>
                  {t("clean.decimal")}
                  <select name="decimal">
                    <option value=".">.</option>
                    <option value=",">,</option>
                  </select>
                </label>
                <label>
                  {t("clean.thousands")}
                  <select name="thousands">
                    <option value="">{t("clean.none")}</option>
                    <option value=",">,</option>
                    <option value=".">.</option>
                    <option value=" ">{t("clean.space")}</option>
                  </select>
                </label>
              </div>
            )}
            {op === "filter" && (
              <label>
                {t("clean.condition")}
                <select name="operator">
                  {["eq", "ne", "contains", "gt", "lt"].map((x) => (
                    <option key={x} value={x}>
                      {t(`clean.${x}`)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {["split", "combine"].includes(op) && (
              <label>
                {t("clean.separator")}
                <input
                  name="separator"
                  required={op === "split"}
                  maxLength={10}
                  defaultValue=" "
                />
              </label>
            )}
            {op === "split" && (
              <label>
                {t("clean.splitNames")}
                <input
                  name="names"
                  required
                  placeholder={t("clean.splitExample")}
                />
              </label>
            )}
            {op === "combine" && <small>{t("clean.combineNote")}</small>}
            <button
              className="secondary"
              disabled={w.busy || w.steps.length >= 20}
            >
              <Plus size={16} />
              {t("clean.add")}
            </button>
          </form>
        </section>
        <section className="recipe-panel">
          <h2>{t("clean.recipe")}</h2>
          {!w.steps.length && <p className="muted">{t("clean.emptyRecipe")}</p>}
          <ol className="recipe-list">
            {w.steps.map((step, i) => (
              <li key={i}>
                <div>
                  <b>{t(`op.${step.op}`)}</b>
                  <small>
                    {Array.isArray(step.columns)
                      ? step.columns.join(", ")
                      : step.column}
                  </small>
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
