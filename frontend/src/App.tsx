import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  BrushCleaning,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FlaskConical,
  HelpCircle,
  Layers3,
  LoaderCircle,
  LogOut,
  Settings,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
  Workflow,
  BarChart3,
} from "lucide-react";
import { useWorkspace } from "./useWorkspace";
import CleaningWorkspace from "./CleaningWorkspace";
import WorkflowWorkspace from "./WorkflowWorkspace";
import AdminWorkspace from "./AdminWorkspace";
import Welcome from "./Welcome";
import WorkspaceOverview from "./WorkspaceOverview";
const AnalyticsWorkspace = lazy(() => import("./AnalyticsWorkspace"));
const views = new Set([
  "overview",
  "datasets",
  "quality",
  "cleaning",
  "workflows",
  "analytics",
  "account",
  "help",
  "administration",
]);
const currentView = () =>
  views.has(location.hash.slice(1)) ? location.hash.slice(1) : "overview";

export default function App() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState(currentView),
    [importing, setImporting] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [sheets, setSheets] = useState<string[]>([]),
    [sheet, setSheet] = useState(""),
    [encoding, setEncoding] = useState("utf-8-sig"),
    [notice, setNotice] = useState("");
  const w = useWorkspace(["datasets", "quality", "cleaning"].includes(tab));
  const [sampleKind, setSampleKind] = useState("sales");
  const [workflowComposer, setWorkflowComposer] = useState(false);
  const [workflowContext, setWorkflowContext] = useState<{
    id: string;
    source: string;
    lookup?: string;
  } | null>(null);
  const [analyticsContext, setAnalyticsContext] = useState<{
    report: string;
  } | null>(null);
  const fmt = (n: number) => new Intl.NumberFormat(i18n.language).format(n);
  const date = (s: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
      new Date(s),
    );
  useEffect(() => {
    const change = () => setTab(currentView());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  function navigate(view: string) {
    location.hash = view;
    setTab(view);
    setWorkflowComposer(false);
    if (view !== "workflows") setWorkflowContext(null);
    if (view !== "analytics") setAnalyticsContext(null);
  }
  function openDataset(id: string, view = "datasets") {
    w.select(id);
    navigate(view);
  }
  async function submitFile(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const result = await w.upload(file, sheet, encoding);
    if (result && "requires_sheet" in result) {
      setSheets(result.sheets);
      setSheet(result.sheets[0]);
    } else if (result) {
      setImporting(false);
      setFile(null);
      setSheets([]);
      navigate("datasets");
    }
  }
  const language = (
    <label className="locale">
      <span className="sr-only">{t("language")}</span>
      <select
        value={i18n.language}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
      >
        <option value="en">English</option>
        <option value="vi">Tiếng Việt</option>
      </select>
    </label>
  );
  const error = w.error && (
    <div className="error" role="alert">
      {t(`error.${w.error}`, { defaultValue: t("error.unknown") })}
      <button
        className="icon"
        aria-label={t("close")}
        onClick={() => w.setError("")}
      >
        <X size={16} />
      </button>
    </div>
  );
  const loading = (
    <div className="skeleton" role="status">
      <span>{t("loading")}</span>
      <i />
      <i />
      <i />
    </div>
  );
  if (w.initial) return <main className="boot">{loading}</main>;
  if (!w.user)
    return (
      <Welcome
        language={language}
        error={error}
        notice={notice}
        busy={w.busy}
        tryDemo={() => w.authenticate()}
        signIn={(credentials) => w.authenticate(credentials)}
      />
    );
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="#overview">
          <Layers3 size={22} />
          <span>
            DataFlow <b>Studio</b>
          </span>
        </a>
        <div className="workspace-badge">
          <span className="status-dot" />
          {t(w.user.role)}
        </div>
        <nav aria-label={t("workspace")}>
          {[
            ["overview", LayoutDashboard],
            ["datasets", Database],
            ["quality", CheckCheck],
            ["cleaning", BrushCleaning],
            ["workflows", Workflow],
            ["analytics", BarChart3],
            ["help", HelpCircle],
            ["account", Settings],
            ...(w.user.role === "admin"
              ? [["administration", ShieldCheck]]
              : []),
          ].map(([key, Icon]) => {
            const ViewIcon = Icon as typeof Database;
            return (
              <button
                key={String(key)}
                className={tab === key ? "active" : ""}
                aria-current={tab === key ? "page" : undefined}
                onClick={() => navigate(String(key))}
              >
                <ViewIcon size={18} />
                <span>
                  {t(key === "analytics" ? "analyticsNav" : String(key))}
                </span>
              </button>
            );
          })}
        </nav>
        <button
          className="logout"
          onClick={() => void w.logout()}
          disabled={w.busy}
        >
          <LogOut size={17} />
          {t("signOut")}
        </button>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div>
            <span>{t("workspace")}</span>
            <b>{t(tab === "analytics" ? "analyticsNav" : tab)}</b>
          </div>
          {language}
        </header>
        <main id="workspace-content">
          {error}
          {notice && <p role="status">{notice}</p>}
          <div className="page-title">
            <div>
              <p className="eyebrow">{t(w.user.role)}</p>
              <h1>{t(tab === "analytics" ? "analyticsNav" : tab)}</h1>
            </div>
            {["overview", "datasets", "quality"].includes(tab) && (
              <button
                disabled={w.busy}
                onClick={() => setImporting(!importing)}
              >
                <UploadCloud size={17} />
                {t("import")}
              </button>
            )}
          </div>
          {importing && (
            <form className="import-form" onSubmit={(e) => void submitFile(e)}>
              <label>
                {t("chooseFile")}
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  required
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setSheets([]);
                    setSheet("");
                  }}
                />
              </label>
              <p className="muted">
                {w.uploadLimits
                  ? t("fileHelp", {
                      mb: fmt(w.uploadLimits.upload_max_bytes / 1024 / 1024),
                      rows: fmt(w.uploadLimits.max_rows),
                      columns: fmt(w.uploadLimits.max_columns),
                    })
                  : t("loading")}
              </p>
              <div className="form-row">
                <label>
                  {t("encoding")}
                  <select
                    value={encoding}
                    onChange={(e) => setEncoding(e.target.value)}
                  >
                    <option value="utf-8-sig">UTF-8</option>
                    <option value="cp1258">Windows Vietnamese</option>
                    <option value="cp1252">Windows Western</option>
                  </select>
                </label>
                {sheets.length > 0 && (
                  <label>
                    {t("sheet")}
                    <select
                      value={sheet}
                      onChange={(e) => setSheet(e.target.value)}
                    >
                      {sheets.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                )}
                <button disabled={w.busy || !file}>
                  {w.busy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <UploadCloud size={16} />
                  )}{" "}
                  {t("importNow")}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setImporting(false)}
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          )}
          {tab === "overview" && (
            <WorkspaceOverview
              key={w.datasets
                .map((item) => `${item.id}:${item.version}`)
                .join(",")}
              openDataset={openDataset}
              navigate={navigate}
              importData={() => setImporting(true)}
              openWorkflow={(id, source, lookup) => {
                setWorkflowContext({ id, source, lookup });
                navigate("workflows");
              }}
              openReport={(report) => {
                setAnalyticsContext({ report });
                navigate("analytics");
              }}
            />
          )}
          {["datasets", "quality", "cleaning"].includes(tab) && (
            <>
              <div className="dataset-bar">
                <select
                  aria-label={t("datasets")}
                  value={w.selected}
                  onChange={(e) => w.select(e.target.value)}
                >
                  <option value="">{t("selectDataset")}</option>
                  {w.datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {fmt(d.rows)} {t("rows").toLowerCase()}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary"
                  disabled={w.busy}
                  onClick={() => void w.sample(sampleKind)}
                >
                  <FlaskConical size={16} />
                  {t("sample")}
                </button>
                <select
                  aria-label={t("wf.sampleType")}
                  value={sampleKind}
                  onChange={(e) => setSampleKind(e.target.value)}
                >
                  <option value="sales">{t("wf.salesSample")}</option>
                  <option value="products">{t("wf.productSample")}</option>
                  <option value="next-month">{t("wf.nextSample")}</option>
                  <option value="inventory">{t("samples.inventory")}</option>
                  <option value="missing-key">{t("samples.missingKey")}</option>
                  <option value="variant">{t("mapping.variantSample")}</option>
                </select>
              </div>
              {w.loading ? (
                loading
              ) : !w.detail ? (
                <section className="empty">
                  <FileSpreadsheet size={36} />
                  <h2>
                    {t(w.datasets.length ? "selectDataset" : "noDatasets")}
                  </h2>
                  <p>{t("emptyHint")}</p>
                </section>
              ) : (
                <>
                  <nav
                    className="data-journey"
                    aria-label={t("home.datasetJourney")}
                  >
                    {(
                      ["datasets", "quality", "cleaning", "analytics"] as const
                    ).map((view, index) => (
                      <button
                        key={view}
                        aria-current={tab === view ? "step" : undefined}
                        aria-label={t("home.goToStep", {
                          step: index + 1,
                          name: t(view === "analytics" ? "analyticsNav" : view),
                        })}
                        onClick={() => navigate(view)}
                      >
                        <span>{index + 1}</span>
                        {t(view === "analytics" ? "analyticsNav" : view)}
                      </button>
                    ))}
                    <small>
                      {w.detail.name} · v{w.detail.version}
                    </small>
                  </nav>
                  <section className="metrics" aria-label={t("details")}>
                    {[
                      ["rows", w.detail.rows],
                      ["columns", w.detail.columns],
                      ["missing", w.profile?.missing_cells ?? 0],
                      ["duplicates", w.profile?.duplicate_rows ?? 0],
                    ].map(([key, value]) => (
                      <div key={key}>
                        <span>{t(String(key))}</span>
                        <strong>{fmt(Number(value))}</strong>
                      </div>
                    ))}
                  </section>
                  {tab === "cleaning" ? (
                    <CleaningWorkspace
                      key={`${w.detail.id}:${w.detail.version}`}
                      detail={w.detail}
                      changed={w.changed}
                      datasets={w.datasets}
                      startWorkflow={workflowComposer}
                      openWorkflow={(id, source, lookup) => {
                        setWorkflowContext({ id, source, lookup });
                        navigate("workflows");
                      }}
                    />
                  ) : tab === "datasets" ? (
                    <section className="data-panel">
                      <div className="panel-title">
                        <div>
                          <h2>{w.detail.name}</h2>
                          <small>
                            {t("created")}: {date(w.detail.created_at)}
                            {w.detail.sheet && ` · ${w.detail.sheet}`}
                          </small>
                        </div>
                        <button
                          className="icon danger"
                          aria-label={t("delete")}
                          disabled={w.busy}
                          onClick={() => {
                            if (confirm(t("deleteConfirm")))
                              void w.remove(w.detail!.id);
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              {w.detail.column_names.map((c) => (
                                <th key={c}>{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {w.detail.records.map((r, i) => (
                              <tr key={i}>
                                {r.map((v, j) => (
                                  <td key={j}>
                                    {v === null || v === "" ? (
                                      <span className="null">—</span>
                                    ) : (
                                      v
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mobile-records">
                        {w.detail.records.map((r, i) => (
                          <details key={i}>
                            <summary>
                              {t("row", { row: (w.page - 1) * 25 + i + 1 })} ·{" "}
                              {r[0] ?? "—"}
                            </summary>
                            <dl>
                              {w.detail!.column_names.map((c, j) => (
                                <div key={c}>
                                  <dt>{c}</dt>
                                  <dd>{r[j] ?? "—"}</dd>
                                </div>
                              ))}
                            </dl>
                          </details>
                        ))}
                      </div>
                      <footer className="pagination">
                        <span>{t("page", { page: fmt(w.page) })}</span>
                        <div>
                          <button
                            className="secondary"
                            aria-label={t("previous")}
                            disabled={w.page === 1}
                            onClick={() => w.setPage(w.page - 1)}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            className="secondary"
                            aria-label={t("next")}
                            disabled={w.page * 25 >= w.detail.rows}
                            onClick={() => w.setPage(w.page + 1)}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </footer>
                    </section>
                  ) : (
                    <section className="quality-panel">
                      <p className="quality-note">
                        <ShieldCheck size={18} />
                        {t("qualityNote")}
                      </p>
                      {w.profile?.fields.map((f) => (
                        <article className="field" key={f.name}>
                          <div className="field-name">
                            <h3>{f.name}</h3>
                            <span className="type">{t(f.suggested_type)}</span>
                          </div>
                          <dl>
                            <div>
                              <dt>{t("missing")}</dt>
                              <dd className={f.missing ? "warn" : ""}>
                                {fmt(f.missing)}
                              </dd>
                            </div>
                            <div>
                              <dt>{t("unique")}</dt>
                              <dd>{fmt(f.unique)}</dd>
                            </div>
                            <div>
                              <dt>{t("invalid")}</dt>
                              <dd className={f.invalid ? "warn" : ""}>
                                {fmt(f.invalid)}
                              </dd>
                            </div>
                            <div>
                              <dt>{t("outliers")}</dt>
                              <dd>{fmt(f.outlier_warnings)}</dd>
                            </div>
                          </dl>
                          {f.outlier_bounds && (
                            <p className="muted">
                              {t("profileBounds", {
                                lower: fmt(Number(f.outlier_bounds.lower)),
                                upper: fmt(Number(f.outlier_bounds.upper)),
                              })}
                            </p>
                          )}
                          {!!f.distribution?.length && (
                            <details>
                              <summary>{t("distribution")}</summary>
                              <dl>
                                {f.distribution.map((entry) => (
                                  <div key={entry.value}>
                                    <dt>{entry.value}</dt>
                                    <dd>{fmt(entry.count)}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                          {f.statistics && (
                            <details>
                              <summary>{t("statistics")}</summary>
                              <dl>
                                {Object.entries(f.statistics).map(([k, v]) => (
                                  <div key={k}>
                                    <dt>{t(k)}</dt>
                                    <dd>
                                      {new Intl.NumberFormat(i18n.language, {
                                        maximumFractionDigits: 3,
                                      }).format(Number(v))}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                        </article>
                      ))}
                    </section>
                  )}
                </>
              )}
            </>
          )}
          {tab === "workflows" && (
            <WorkflowWorkspace
              key={workflowContext?.id ?? "choose"}
              datasets={w.datasets}
              changed={w.changed}
              createWorkflow={() => {
                if (!w.datasets.length) {
                  navigate("datasets");
                  setImporting(true);
                  return;
                }
                if (!w.selected) w.select(w.datasets[0].id);
                navigate("cleaning");
                setWorkflowComposer(true);
              }}
              initialWorkflowId={workflowContext?.id}
              initialDatasetId={workflowContext?.source}
              initialLookupId={workflowContext?.lookup}
            />
          )}
          {tab === "analytics" && (
            <Suspense fallback={loading}>
              <AnalyticsWorkspace
                key={analyticsContext?.report ?? "new"}
                datasets={w.datasets}
                initialDatasetId={analyticsContext ? "" : w.selected}
                initialReportId={analyticsContext?.report}
              />
            </Suspense>
          )}
          {tab === "administration" && w.user.role === "admin" && (
            <AdminWorkspace
              ownId={w.user.id}
              sessionChanged={w.refreshIdentity}
            />
          )}
          {tab === "administration" && w.user.role !== "admin" && (
            <p className="error" role="alert">
              {t("error.forbidden")}
            </p>
          )}
          {tab === "help" && (
            <section className="help">
              <h2>{t("helpTitle")}</h2>
              {[1, 2, 3, 4].map((n) => (
                <p key={n}>
                  <span>{n}</span>
                  {t(`help${n}`)}
                </p>
              ))}
            </section>
          )}
          {tab === "account" &&
            (w.user.role === "guest" ? (
              <section className="help">
                <p>{t("guestAccount")}</p>
              </section>
            ) : (
              <form
                className="account-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (
                    await w.password(
                      String(f.get("current")),
                      String(f.get("new")),
                    )
                  )
                    setNotice(t("passwordChanged"));
                }}
              >
                <label>
                  {t("currentPassword")}
                  <input
                    name="current"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  {t("newPassword")}
                  <input
                    name="new"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                </label>
                <button disabled={w.busy}>{t("changePassword")}</button>
              </form>
            ))}
        </main>
      </div>
    </div>
  );
}
