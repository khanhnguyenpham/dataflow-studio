import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
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
} from "lucide-react";
import { useWorkspace } from "./useWorkspace";
import CleaningWorkspace from "./CleaningWorkspace";

export default function App() {
  const { t, i18n } = useTranslation();
  const w = useWorkspace();
  const [tab, setTab] = useState(location.hash.slice(1) || "datasets"),
    [login, setLogin] = useState(false),
    [importing, setImporting] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [sheets, setSheets] = useState<string[]>([]),
    [sheet, setSheet] = useState(""),
    [encoding, setEncoding] = useState("utf-8-sig"),
    [notice, setNotice] = useState("");
  const fmt = (n: number) => new Intl.NumberFormat(i18n.language).format(n);
  const date = (s: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
      new Date(s),
    );
  useEffect(() => {
    const change = () => setTab(location.hash.slice(1) || "datasets");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  function navigate(view: string) {
    location.hash = view;
    setTab(view);
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
      <main className="welcome">
        <header>
          <div className="brand">
            <Layers3 size={24} />
            DataFlow <b>Studio</b>
          </div>
          {language}
        </header>
        <section className="hero">
          <span className="eyebrow">DataFlow Studio</span>
          <h1>{t("tagline")}</h1>
          <p>{t("intro")}</p>
          {error}
          {notice && <p role="status">{notice}</p>}
          <div className="hero-actions">
            <button disabled={w.busy} onClick={() => void w.authenticate()}>
              {w.busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <FlaskConical size={18} />
              )}{" "}
              {t("tryDemo")} <ArrowRight size={18} />
            </button>
            <button className="secondary" onClick={() => setLogin(!login)}>
              {t("signIn")}
            </button>
          </div>
          <small>{t("demoNote")}</small>
          {login && (
            <form
              className="login-form"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void w.authenticate({
                  username: String(data.get("username")),
                  password: String(data.get("password")),
                });
              }}
            >
              <label>
                {t("username")}
                <input
                  name="username"
                  autoComplete="username"
                  required
                  maxLength={100}
                />
              </label>
              <label>
                {t("password")}
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                />
              </label>
              <button disabled={w.busy}>{t("signIn")}</button>
            </form>
          )}
        </section>
        <section className="welcome-example" aria-label={t("sampleLabel")}>
          <div className="example-label">
            <FileSpreadsheet size={18} />
            {t("sampleLabel")}
          </div>
          <div className="example-row">
            <span>Order ID</span>
            <span>Order Date</span>
            <span>Quantity</span>
          </div>
          <div className="example-row">
            <span>003</span>
            <span className="flag">31/02/2026</span>
            <span className="flag">—</span>
          </div>
          <p>
            <ShieldCheck size={16} />
            {t("qualityNote")}
          </p>
        </section>
      </main>
    );
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="#datasets">
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
            ["datasets", Database],
            ["quality", CheckCheck],
            ["cleaning", BrushCleaning],
            ["help", HelpCircle],
            ["account", Settings],
          ].map(([key, Icon]) => {
            const ViewIcon = Icon as typeof Database;
            return (
              <button
                key={String(key)}
                className={tab === key ? "active" : ""}
                onClick={() => navigate(String(key))}
              >
                <ViewIcon size={18} />
                <span>{t(String(key))}</span>
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
            <b>{t(tab)}</b>
          </div>
          {language}
        </header>
        <main id="workspace-content">
          {error}
          {notice && <p role="status">{notice}</p>}
          <div className="page-title">
            <div>
              <p className="eyebrow">{t(w.user.role)}</p>
              <h1>{t(tab)}</h1>
            </div>
            {(tab === "datasets" || tab === "quality") && (
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
              <p className="muted">{t("fileHelp")}</p>
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
                  onClick={() => void w.sample()}
                >
                  <FlaskConical size={16} />
                  {t("sample")}
                </button>
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
