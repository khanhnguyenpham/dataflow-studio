import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowRight,
  CheckCheck,
  FileSpreadsheet,
  GitMerge,
  Layers3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from "lucide-react";

export default function Welcome({
  language,
  error,
  notice,
  busy,
  tryDemo,
  signIn,
}: {
  language: ReactNode;
  error: ReactNode;
  notice: string;
  busy: boolean;
  tryDemo: () => Promise<void>;
  signIn: (credentials: {
    username: string;
    password: string;
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [login, setLogin] = useState(false);
  return (
    <main className="welcome product-welcome">
      <header>
        <div className="brand">
          <Layers3 size={25} />
          <span>
            DataFlow <b>Studio</b>
          </span>
        </div>
        <div className="welcome-header-actions">
          <span>{t("landing.workspaceType")}</span>
          {language}
        </div>
      </header>
      <div className="product-hero">
        <section className="hero">
          <span className="hero-kicker">
            <span />
            {t("landing.eyebrow")}
          </span>
          <h1>{t("tagline")}</h1>
          <p>{t("intro")}</p>
          {error}
          {notice && <p role="status">{notice}</p>}
          <div className="hero-actions">
            <button disabled={busy} onClick={() => void tryDemo()}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <ArrowRight size={18} />
              )}
              {t("tryDemo")}
            </button>
            <button
              className="secondary"
              onClick={() => setLogin(!login)}
              aria-expanded={login}
            >
              {t("signIn")}
            </button>
          </div>
          <small>{t("demoNote")}</small>
          {login && (
            <form
              className="login-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void signIn({
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
              <button disabled={busy}>{t("signIn")}</button>
            </form>
          )}
          <div className="hero-assurance">
            <ShieldCheck size={17} />
            <span>{t("landing.sourceSafe")}</span>
          </div>
        </section>
        <section
          className="workflow-showcase"
          aria-label={t("landing.exampleTitle")}
        >
          <header>
            <span className="showcase-dot" />
            <span>{t("landing.exampleTitle")}</span>
            <small>{t("landing.exampleLabel")}</small>
          </header>
          <div className="showcase-files">
            <div>
              <FileSpreadsheet size={22} />
              <span>{t("wf.salesSample")}</span>
              <small>CSV</small>
            </div>
            <div>
              <FileSpreadsheet size={22} />
              <span>{t("wf.productSample")}</span>
              <small>XLSX / CSV</small>
            </div>
          </div>
          <div className="showcase-connector" aria-hidden="true">
            <ArrowDown size={17} />
          </div>
          <div className="showcase-recipe">
            <div>
              <Workflow size={20} />
              <strong>{t("landing.savedRecipe")}</strong>
            </div>
            <ol>
              <li>
                <CheckCheck size={16} />
                <span>{t("landing.checkInputs")}</span>
                <small>01</small>
              </li>
              <li>
                <Layers3 size={16} />
                <span>{t("landing.dedupe")}</span>
                <small>02</small>
              </li>
              <li>
                <GitMerge size={16} />
                <span>{t("landing.join")}</span>
                <small>03</small>
              </li>
              <li>
                <ShieldCheck size={16} />
                <span>{t("landing.approve")}</span>
                <small>04</small>
              </li>
            </ol>
          </div>
          <div className="showcase-connector" aria-hidden="true">
            <ArrowDown size={17} />
          </div>
          <div className="showcase-output">
            <div>
              <RefreshCw size={20} />
              <span>
                <strong>{t("landing.reuseTitle")}</strong>
                <small>{t("landing.reuseHint")}</small>
              </span>
            </div>
            <span className="output-formats">CSV · XLSX · JSON</span>
          </div>
          <p className="showcase-note">{t("landing.exampleNote")}</p>
        </section>
      </div>
      <section className="product-benefits" aria-label={t("landing.benefits")}>
        {(
          [
            ["review", CheckCheck],
            ["reuse", RefreshCw],
            ["history", Layers3],
          ] as const
        ).map(([key, Icon], index) => (
          <article key={key}>
            <div>
              <Icon size={21} />
              <span>0{index + 1}</span>
            </div>
            <h2>{t(`landing.${key}Title`)}</h2>
            <p>{t(`landing.${key}Description`)}</p>
          </article>
        ))}
      </section>
      <footer className="welcome-footer">
        <span>DataFlow Studio</span>
        <span>{t("landing.footer")}</span>
        <a
          href="https://github.com/khanhnguyenpham/dataflow-studio/blob/main/docs/USER_GUIDE.en.md"
          target="_blank"
          rel="noreferrer"
        >
          {t("landing.guide")}
          <ArrowRight size={14} />
        </a>
      </footer>
    </main>
  );
}
