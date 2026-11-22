import { useTranslation } from "react-i18next";
import type { Step } from "./useCleaning";

export default function StepSummary({ step }: { step: Step }) {
  const { t } = useTranslation();
  const column = step.columns?.join(", ") ?? step.column ?? "";
  let details = column;
  if (step.op === "rename") details += ` → ${step.name}`;
  if (step.op === "fill_null") details += ` → “${step.value}”`;
  if (step.op === "replace") details += `: “${step.old}” → “${step.value}”`;
  if (step.op === "date")
    details += ` · ${(step.formats as string[]).join(", ")}`;
  if (step.op === "number")
    details += ` · ${t("clean.decimal")}: ${step.decimal} · ${t("clean.thousands")}: ${step.thousands || t("clean.none")}`;
  if (step.op === "filter")
    details += ` · ${t(`clean.${step.operator}`)} “${step.value}”`;
  if (step.op === "split")
    details += ` → ${step.names?.join(", ")} · “${step.separator}”`;
  if (step.op === "combine") details += ` → ${step.name} · “${step.separator}”`;
  if (step.op === "map_columns")
    details =
      step.mapping?.map((m) => `${m.source} → ${m.target}`).join("; ") ?? "";
  if (step.op === "validate") {
    details += ` · ${t(`validationRule.${step.rule}`)}`;
    if (step.rule === "date")
      details += ` · ${(step.formats as string[]).join(", ")}`;
    details += ` · ${t(step.allow_empty && step.rule !== "not_null" ? "validationRule.emptyAllowed" : "validationRule.emptyRejected")}`;
  }
  return (
    <span className="step-summary">
      <b>{t(`op.${step.op}`)}</b>
      <small>{details}</small>
    </span>
  );
}
