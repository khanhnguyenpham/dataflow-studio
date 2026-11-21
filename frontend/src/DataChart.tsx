import { useTranslation } from "react-i18next";
import type { AggregateResult } from "./useAnalytics";
const colors = [
  "#28766f",
  "#d69d45",
  "#687eb0",
  "#a46682",
  "#75a66b",
  "#b57159",
  "#5097a5",
  "#8b8b56",
];

export default function DataChart({
  result,
  type,
  title,
}: {
  result: AggregateResult;
  type: string;
  title: string;
}) {
  const { t, i18n } = useTranslation();
  const rows = result.items.filter((row) => row.value !== null).slice(0, 20),
    values = rows.map((r) => Number(r.value));
  const format = (n: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(
      n,
    );
  const label = (value: string | null) =>
    value === null || value === "" ? t("analytics.missingGroup") : value;
  if (!rows.length || rows.every((r) => r.value === null))
    return <p className="empty-chart">{t("analytics.emptyResult")}</p>;
  let angle = -Math.PI / 2;
  const min = Math.min(0, ...values),
    max = Math.max(0, ...values),
    span = max - min || 1;
  const y = (value: number) => 260 - ((value - min) / span) * 220,
    x = (index: number) => 70 + ((index + 0.5) * 600) / rows.length;
  return (
    <>
      <div className="chart-scroll">
        <svg
          className="data-chart"
          viewBox="0 0 720 330"
          role="img"
          aria-label={title}
        >
          <title>{title}</title>
          {type === "pie" ? (
            rows.map((row, i) => {
              const portion = values[i] / values.reduce((a, b) => a + b, 0),
                start = angle;
              angle += portion * Math.PI * 2;
              const cx = 190,
                cy = 155,
                r = 110;
              return (
                <g key={i}>
                  {portion >= 0.999999 ? (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={colors[i % colors.length]}
                    />
                  ) : (
                    <path
                      d={`M ${cx} ${cy} L ${cx + r * Math.cos(start)} ${cy + r * Math.sin(start)} A ${r} ${r} 0 ${portion > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(angle)} ${cy + r * Math.sin(angle)} Z`}
                      fill={colors[i % colors.length]}
                    />
                  )}
                  <title>
                    {label(row.group)}: {row.value}
                  </title>
                  <rect
                    x="360"
                    y={28 + i * 33}
                    width="12"
                    height="12"
                    rx="2"
                    fill={colors[i % colors.length]}
                  />
                  <text x="382" y={39 + i * 33}>
                    {label(row.group).slice(0, 25)} · {format(values[i])}
                  </text>
                </g>
              );
            })
          ) : (
            <>
              {[min, (min + max) / 2, max].map((n, i) => (
                <g key={i}>
                  <line x1="62" y1={y(n)} x2="680" y2={y(n)} stroke="#e4ebe5" />
                  <text x="55" y={y(n) + 4} textAnchor="end">
                    {format(n)}
                  </text>
                </g>
              ))}
              {type === "line" && (
                <polyline
                  fill="none"
                  stroke="#28766f"
                  strokeWidth="3"
                  points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                />
              )}
              {rows.map((row, i) => (
                <g key={i}>
                  {type === "bar" ? (
                    <rect
                      x={x(i) - Math.min(32, 230 / rows.length)}
                      y={Math.min(y(0), y(values[i]))}
                      width={Math.min(64, 460 / rows.length)}
                      height={Math.max(1, Math.abs(y(values[i]) - y(0)))}
                      rx="3"
                      fill={row.value === null ? "#d8e2db" : "#28766f"}
                    />
                  ) : (
                    <circle cx={x(i)} cy={y(values[i])} r="5" fill="#28766f" />
                  )}
                  <title>
                    {label(row.group)}: {row.value ?? t("analytics.noMeasure")}
                  </title>
                  <text
                    x={x(i)}
                    y="286"
                    textAnchor="middle"
                    transform={
                      rows.length > 8 ? `rotate(30,${x(i)},286)` : undefined
                    }
                  >
                    {label(row.group).slice(0, rows.length > 8 ? 7 : 14)}
                  </text>
                </g>
              ))}
            </>
          )}
        </svg>
      </div>
      {result.items.length > 20 && (
        <p className="muted">{t("analytics.chartLimit")}</p>
      )}
    </>
  );
}
