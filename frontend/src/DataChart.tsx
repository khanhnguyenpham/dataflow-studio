import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  const rows = result.items
    .filter((row) => row.value !== null)
    .slice(0, 20)
    .map((row, index) => ({
      group:
        row.group === null || row.group === ""
          ? t("analytics.missingGroup")
          : row.group,
      value: Number(row.value),
      exact: row.value,
      color: colors[index % colors.length],
    }));
  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(
      value,
    );
  // Plotting uses JS numbers; the adjacent table and exports retain server Decimal strings.
  if (!rows.length)
    return <p className="empty-chart">{t("analytics.emptyResult")}</p>;
  const tooltip = (
    <Tooltip
      formatter={(value) => format(Number(value))}
      cursor={{ fill: "#edf4ef" }}
    />
  );
  return (
    <>
      <div className="chart-scroll" role="region" aria-label={title}>
        <ResponsiveContainer width="100%" height={330} minWidth={0}>
          {type === "pie" ? (
            <PieChart accessibilityLayer>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="group"
                innerRadius={35}
                outerRadius={100}
                isAnimationActive={false}
              >
                {rows.map((row) => (
                  <Cell key={row.group} fill={row.color} />
                ))}
              </Pie>
              {tooltip}
              <Legend />
            </PieChart>
          ) : type === "line" ? (
            <LineChart
              data={rows}
              accessibilityLayer
              margin={{ top: 16, right: 20, bottom: 36, left: 20 }}
            >
              <CartesianGrid stroke="#e4ebe5" vertical={false} />
              <XAxis dataKey="group" tickMargin={10} />
              <YAxis tickFormatter={format} width={75} />
              <Line
                type="linear"
                dataKey="value"
                name={t("analytics.value")}
                stroke="#28766f"
                strokeWidth={2}
                dot
                isAnimationActive={false}
              />
              {tooltip}
            </LineChart>
          ) : (
            <BarChart
              data={rows}
              accessibilityLayer
              margin={{ top: 16, right: 20, bottom: 36, left: 20 }}
            >
              <CartesianGrid stroke="#e4ebe5" vertical={false} />
              <XAxis dataKey="group" tickMargin={10} />
              <YAxis tickFormatter={format} width={75} />
              <Bar
                dataKey="value"
                name={t("analytics.value")}
                fill="#28766f"
                maxBarSize={48}
                isAnimationActive={false}
              />
              {tooltip}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="muted">{t("analytics.chartHelp")}</p>
      {result.items.length > 20 && (
        <p className="muted">{t("analytics.chartLimit")}</p>
      )}
    </>
  );
}
