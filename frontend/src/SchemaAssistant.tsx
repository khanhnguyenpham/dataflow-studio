import { useTranslation } from "react-i18next";
import { WandSparkles, Eye, Check } from "lucide-react";
import type { Dataset } from "./api";
import { useSchemaAssistant } from "./useSchemaAssistant";

export default function SchemaAssistant({
  source,
  targets,
  changed,
}: {
  source: Dataset;
  targets: string[];
  changed: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation(),
    w = useSchemaAssistant(source, targets, changed);
  return (
    <details className="schema-assistant">
      <summary>{t("mapping.title")}</summary>
      <p>{t("mapping.explain")}</p>
      {w.error && (
        <div className="error" role="alert">
          {t(`error.${w.error}`, { defaultValue: t("error.unknown") })}
        </div>
      )}
      {w.saved && (
        <p className="success" role="status">
          {t("mapping.saved")}
        </p>
      )}
      <button
        className="secondary"
        disabled={w.busy}
        onClick={() => void w.inspect()}
      >
        <WandSparkles size={16} />
        {t("mapping.check")}
      </button>
      {w.suggestions && (
        <>
          <div className="preview-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("mapping.expected")}</th>
                  <th>{t("mapping.source")}</th>
                  <th>{t("mapping.score")}</th>
                </tr>
              </thead>
              <tbody>
                {w.suggestions.items.map((item) => {
                  const candidate = item.candidates.find(
                    (c) => c.source === w.choices[item.target],
                  );
                  return (
                    <tr key={item.target}>
                      <td>{item.target}</td>
                      <td>
                        <select
                          aria-label={t("mapping.choose", {
                            target: item.target,
                          })}
                          value={w.choices[item.target] ?? ""}
                          disabled={w.busy}
                          onChange={(e) =>
                            w.choose(item.target, e.target.value)
                          }
                        >
                          <option value="">{t("mapping.review")}</option>
                          {w.suggestions!.source_columns.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {candidate
                          ? `${new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(candidate.score)} · ${t(`mapping.${candidate.reason}`)}`
                          : t("mapping.manual")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!w.complete && <p className="warn">{t("mapping.incomplete")}</p>}
          {!!w.extras.length && (
            <div className="quality-note">
              <p>
                {t("mapping.extras")} {w.extras.join(" · ")}
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={w.dropExtras}
                  disabled={w.busy}
                  onChange={(e) => w.drop(e.target.checked)}
                />
                {t("mapping.drop")}
              </label>
            </div>
          )}
          <p className="muted">{t("mapping.confirmNote")}</p>
          <button
            disabled={
              w.busy || !w.complete || (!!w.extras.length && !w.dropExtras)
            }
            onClick={() => void w.prepare()}
          >
            <Eye size={16} />
            {t("mapping.preview")}
          </button>
        </>
      )}
      {w.preview && (
        <section className="mapping-preview">
          <h3>{t("mapping.before")}</h3>
          <p>{w.preview.before.columns.join(" · ")}</p>
          <h3>{t("mapping.after")}</h3>
          <p>{w.preview.after.columns.join(" · ")}</p>
          <p>
            {t("clean.impact", {
              before: w.preview.before.rows,
              after: w.preview.after.rows,
              cells: 0,
            })}
          </p>
          <div className="preview-scroll">
            <table>
              <thead>
                <tr>
                  {w.preview.after.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {w.preview.after.records.map((row, i) => (
                  <tr key={i}>
                    {row.map((v, j) => (
                      <td key={j}>{v ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">{t("clean.previewRows")}</p>
          {w.preview.changed ? (
            <button
              disabled={w.busy}
              onClick={() => {
                if (confirm(t("clean.applyConfirm"))) void w.apply();
              }}
            >
              <Check size={16} />
              {t("mapping.apply")}
            </button>
          ) : (
            <p>{t("mapping.aligned")}</p>
          )}
        </section>
      )}
    </details>
  );
}
