import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { Step } from "./useCleaning";
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
export default function StepBuilder({
  columns,
  onAdd,
  busy,
  count,
}: {
  columns: string[];
  onAdd: (step: Step) => void;
  busy: boolean;
  count: number;
}) {
  const { t } = useTranslation();
  const [op, setOp] = useState("trim");
  const multi = ["trim", "unicode", "dedupe", "combine"].includes(op);
  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const step: Step = { op };
    for (const [key, value] of form.entries())
      if (key !== "columns") step[key] = String(value);
    if (multi) step.columns = form.getAll("columns").map(String);
    if (op === "date") step.formats = form.getAll("formats").map(String);
    if (op === "split")
      step.names = String(step.names)
        .split(",")
        .map((s) => s.trim());
    onAdd(step);
  }
  return (
    <form onSubmit={add} className="step-form" key={op}>
      <label>
        {t("clean.operation")}
        <select
          value={op}
          onChange={(e) => setOp(e.target.value)}
          disabled={busy}
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
          <select name="formats" multiple required defaultValue={["%Y-%m-%d"]}>
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
          <input name="names" required placeholder={t("clean.splitExample")} />
        </label>
      )}
      {op === "combine" && <small>{t("clean.combineNote")}</small>}
      <button className="secondary" disabled={busy || count >= 20}>
        <Plus size={16} />
        {t("clean.add")}
      </button>
    </form>
  );
}
