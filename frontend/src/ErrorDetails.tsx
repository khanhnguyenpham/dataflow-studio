import { useTranslation } from "react-i18next";
import type { ProblemDetails } from "./api";

export default function ErrorDetails({
  details,
}: {
  details?: ProblemDetails;
}) {
  const { t, i18n } = useTranslation();
  if (!details) return null;
  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language).format(value);
  return (
    <div className="error-context">
      {details.column && (
        <small>
          {t("field")}: {details.column}
        </small>
      )}
      {details.rule && (
        <small>
          {t("validationRule.label")}:{" "}
          {t(`validationRule.${details.rule}`, { defaultValue: details.rule })}
        </small>
      )}
      {details.count !== undefined && (
        <small>{t("validationRule.failures", { count: details.count })}</small>
      )}
      {!!details.rows?.length && (
        <small>
          {t("validationRule.rows")}: {details.rows.map(number).join(", ")}
        </small>
      )}
    </div>
  );
}
