import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Database,
  FileSpreadsheet,
  History,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { api } from "./api";

interface Overview {
  counts: {
    datasets: number;
    workflows: number;
    reports: number;
    runs: number;
  };
  datasets: {
    id: string;
    name: string;
    rows: number | null;
    version: number;
    created_at: string;
  }[];
  reports: {
    id: string;
    name: string;
    dataset_version: number;
    created_at: string;
  }[];
  runs: {
    id: string;
    workflow_id: string;
    workflow_name: string;
    dataset_id: string;
    right_dataset_id: string | null;
    status: string;
    error_code: string | null;
    created_at: string;
  }[];
}

export default function WorkspaceOverview({
  openDataset,
  openWorkflow,
  openReport,
  navigate,
  importData,
}: {
  openDataset: (id: string, view?: string) => void;
  openWorkflow: (id: string, source: string, lookup?: string) => void;
  openReport: (id: string) => void;
  navigate: (view: string) => void;
  importData: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<Overview>("/overview", { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.code ?? "network");
      });
    return () => controller.abort();
  }, [revision]);
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
      new Date(value),
    );
  const fmt = (value: number) =>
    new Intl.NumberFormat(i18n.language).format(value);
  if (error)
    return (
      <div className="error" role="alert">
        {t(`error.${error}`, { defaultValue: t("error.unknown") })}
        <button
          onClick={() => {
            setError("");
            setRevision(revision + 1);
          }}
        >
          {t("retry")}
        </button>
      </div>
    );
  if (!data)
    return (
      <div className="overview-loading" role="status">
        <span>{t("loading")}</span>
        <div />
        <div />
        <div />
      </div>
    );
  return (
    <div className="workspace-home">
      <section className="workspace-intro">
        <div>
          <span className="eyebrow">{t("home.startHere")}</span>
          <h2>{t("home.nextReport")}</h2>
          <p>{t("home.nextHint")}</p>
          <button
            onClick={() =>
              data.datasets.length
                ? openDataset(data.datasets[0].id, "quality")
                : importData()
            }
          >
            {t(data.datasets.length ? "home.inspect" : "import")}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="report-path" aria-label={t("home.reportPath")}>
          <div>
            <FileSpreadsheet size={18} />
            <span>{t("home.files")}</span>
            <small>CSV / XLSX</small>
          </div>
          <span className="path-link" aria-hidden="true" />
          <div>
            <ShieldCheck size={18} />
            <span>{t("home.review")}</span>
            <small>{t("home.previewFirst")}</small>
          </div>
          <span className="path-link" aria-hidden="true" />
          <div>
            <Workflow size={18} />
            <span>{t("home.reuse")}</span>
            <small>{t("home.nextMonth")}</small>
          </div>
        </div>
      </section>
      <section className="home-stats" aria-label={t("home.stats")}>
        {(
          [
            ["datasets", Database],
            ["workflows", Workflow],
            ["reports", BarChart3],
            ["runs", History],
          ] as const
        ).map(([key, Icon]) => (
          <article key={key}>
            <span className="stat-symbol">
              <Icon size={18} />
            </span>
            <div>
              <span>{t(`home.${key}`)}</span>
              <strong>{fmt(data.counts[key])}</strong>
            </div>
          </article>
        ))}
      </section>
      <div className="home-grid">
        <section className="home-panel recent-files">
          <header>
            <div>
              <h2>{t("home.recentFiles")}</h2>
              <p>{t("home.currentVersion")}</p>
            </div>
            <button
              className="icon"
              aria-label={t("home.allFiles")}
              onClick={() => navigate("datasets")}
            >
              <ArrowUpRight size={18} />
            </button>
          </header>
          {data.datasets.length ? (
            <ul className="asset-list">
              {data.datasets.map((item) => (
                <li key={item.id}>
                  <span className="file-symbol">
                    <FileSpreadsheet size={20} />
                  </span>
                  <div className="asset-name">
                    <strong title={item.name}>{item.name}</strong>
                    <small>
                      {item.rows === null ? "—" : fmt(item.rows)}{" "}
                      {t("rows").toLowerCase()} · v{item.version} ·{" "}
                      {date(item.created_at)}
                    </small>
                  </div>
                  <button
                    className="secondary compact"
                    aria-label={t("home.inspectFile", { name: item.name })}
                    onClick={() => openDataset(item.id, "quality")}
                  >
                    {t("home.open")}
                    <ArrowRight size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="home-empty">
              <FileSpreadsheet size={26} />
              <h3>{t("noDatasets")}</h3>
              <p>{t("emptyHint")}</p>
              <button className="secondary" onClick={importData}>
                {t("import")}
              </button>
            </div>
          )}
        </section>
        <section className="home-panel report-shelf">
          <header>
            <div>
              <h2>{t("home.savedReports")}</h2>
              <p>{t("home.pinned")}</p>
            </div>
            <BarChart3 size={19} />
          </header>
          {data.reports.length ? (
            <ul className="asset-list">
              {data.reports.map((item) => (
                <li key={item.id}>
                  <span className="file-symbol report-symbol">
                    <BarChart3 size={18} />
                  </span>
                  <div className="asset-name">
                    <strong title={item.name}>{item.name}</strong>
                    <small>
                      v{item.dataset_version} · {date(item.created_at)}
                    </small>
                  </div>
                  <button
                    className="icon"
                    aria-label={t("home.viewReport", { name: item.name })}
                    onClick={() => openReport(item.id)}
                  >
                    <ArrowUpRight size={18} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="home-empty">
              <BarChart3 size={26} />
              <h3>{t("home.noReports")}</h3>
              <p>{t("home.noReportsHint")}</p>
              <button
                className="secondary"
                onClick={() => navigate("analytics")}
              >
                {t("home.createReport")}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>
        <section className="home-panel run-activity">
          <header>
            <div>
              <h2>{t("home.activity")}</h2>
              <p>{t("home.executionNote")}</p>
            </div>
            <History size={19} />
          </header>
          {data.runs.length ? (
            <ul className="asset-list">
              {data.runs.map((run) => (
                <li key={run.id}>
                  <span
                    className={`run-status ${["pending", "running", "completed", "failed"].includes(run.status) ? run.status : "pending"}`}
                  >
                    {t(`wf.${run.status}`)}
                  </span>
                  <div className="asset-name">
                    <strong>{run.workflow_name}</strong>
                    <small>
                      {run.error_code
                        ? t(`error.${run.error_code}`, {
                            defaultValue: t("error.unknown"),
                          })
                        : date(run.created_at)}
                    </small>
                  </div>
                  <button
                    className="icon"
                    aria-label={t("home.openWorkflow", {
                      name: run.workflow_name,
                    })}
                    onClick={() =>
                      openWorkflow(
                        run.workflow_id,
                        run.dataset_id,
                        run.right_dataset_id ?? "",
                      )
                    }
                  >
                    <ArrowUpRight size={18} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="inline-empty">
              <History size={21} />
              <p>{t("home.noRuns")}</p>
              <button
                className="secondary compact"
                onClick={() => navigate("workflows")}
              >
                {t("home.seeWorkflows")}
              </button>
            </div>
          )}
        </section>
        <section className="home-panel next-steps">
          <header>
            <div>
              <h2>{t("home.monthlySteps")}</h2>
              <p>{t("home.monthlyHint")}</p>
            </div>
            <RefreshCw size={19} />
          </header>
          <ol>
            {(["quality", "cleaning", "workflows"] as const).map(
              (view, index) => (
                <li key={view}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <button
                    onClick={() =>
                      data.datasets.length && view !== "workflows"
                        ? openDataset(data.datasets[0].id, view)
                        : navigate(view)
                    }
                  >
                    <strong>{t(`home.step${index + 1}`)}</strong>
                    <small>{t(`home.step${index + 1}Hint`)}</small>
                  </button>
                  <ArrowUpRight size={16} />
                </li>
              ),
            )}
          </ol>
        </section>
      </div>
      <p className="ownership-note">
        <ShieldCheck size={14} />
        {t("home.ownerNote")}
      </p>
    </div>
  );
}
