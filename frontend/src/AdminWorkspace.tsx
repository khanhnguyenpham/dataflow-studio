import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, UserPlus, Save, ShieldCheck } from "lucide-react";
import { useAdmin, type Account } from "./useAdmin";

function AccountRow({
  account,
  busy,
  update,
  reset,
}: {
  account: Account;
  busy: boolean;
  update: (role: string, active: boolean) => void;
  reset: (password: string, done: () => void) => void;
}) {
  const { t } = useTranslation(),
    [role, setRole] = useState(account.role),
    [active, setActive] = useState(account.active);
  return (
    <tr>
      <td>
        <b>{account.username}</b>
      </td>
      <td>
        <select
          aria-label={t("adminPanel.roleFor", { name: account.username })}
          value={role}
          disabled={busy}
          onChange={(e) => setRole(e.target.value as Account["role"])}
        >
          <option value="user">{t("user")}</option>
          <option value="admin">{t("admin")}</option>
        </select>
      </td>
      <td>
        <label className="checkbox-label">
          <input
            type="checkbox"
            aria-label={t("adminPanel.activeFor", { name: account.username })}
            disabled={busy}
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          {t(active ? "adminPanel.active" : "adminPanel.disabled")}
        </label>
      </td>
      <td>
        <button
          className="secondary"
          disabled={
            busy || (role === account.role && active === account.active)
          }
          onClick={() => {
            if (confirm(t("adminPanel.changeConfirm"))) update(role, active);
          }}
        >
          <Save size={14} />
          {t("adminPanel.apply")}
        </button>
      </td>
      <td>
        <details>
          <summary>{t("adminPanel.resetPassword")}</summary>
          <form
            className="step-form password-reset"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                password = String(new FormData(form).get("password"));
              if (confirm(t("adminPanel.resetConfirm")))
                reset(password, () => form.reset());
            }}
          >
            <label>
              {t("newPassword")}
              <input
                type="password"
                name="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
                disabled={busy}
              />
            </label>
            <button disabled={busy}>{t("adminPanel.resetPassword")}</button>
          </form>
        </details>
      </td>
    </tr>
  );
}

export default function AdminWorkspace({
  ownId,
  sessionChanged,
}: {
  ownId: string;
  sessionChanged: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation(),
    w = useAdmin(ownId, sessionChanged),
    [tab, setTab] = useState("users");
  const fmt = (n: number) => new Intl.NumberFormat(i18n.language).format(n);
  return (
    <div className="cleaning-workspace" aria-busy={w.busy}>
      <p className="quality-note">
        <ShieldCheck size={18} />
        {t("adminPanel.scope")}
      </p>
      {w.error && (
        <div className="error" role="alert">
          {t(`error.${w.error}`, { defaultValue: t("error.unknown") })}
        </div>
      )}
      {w.notice && (
        <p className="success" role="status">
          {t(w.notice)}
        </p>
      )}
      <nav className="admin-tabs" aria-label={t("administration")}>
        {["users", "runs", "limits", "audit"].map((key) => (
          <button
            aria-pressed={tab === key}
            className={tab === key ? "" : "secondary"}
            key={key}
            onClick={() => setTab(key)}
          >
            {t(`adminPanel.${key}`)}
          </button>
        ))}
        <button
          className="secondary"
          disabled={w.busy}
          onClick={() => void w.refresh()}
        >
          <RefreshCw size={15} />
          {t("adminPanel.refresh")}
        </button>
      </nav>
      {w.status && (
        <section className="metrics" aria-label={t("adminPanel.status")}>
          {["users", "active_guests", "datasets", "failed_runs"].map((key) => (
            <div key={key}>
              <span>{t(`adminPanel.${key}`)}</span>
              <strong>{fmt(w.status![key])}</strong>
            </div>
          ))}
        </section>
      )}
      {w.loading ? (
        <p role="status">{t("loading")}</p>
      ) : (
        <>
          {tab === "users" && (
            <>
              <section className="recipe-panel">
                <details>
                  <summary className="section-summary">
                    {t("adminPanel.create")}
                  </summary>
                  <form
                    className="admin-create"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget,
                        data = new FormData(form);
                      void w.create(
                        {
                          username: String(data.get("username")),
                          password: String(data.get("password")),
                          role: String(data.get("role")),
                        },
                        () => form.reset(),
                      );
                    }}
                  >
                    <label>
                      {t("username")}
                      <input
                        name="username"
                        autoComplete="off"
                        required
                        minLength={3}
                        maxLength={100}
                        pattern="[a-zA-Z0-9._-]+"
                      />
                    </label>
                    <label>
                      {t("newPassword")}
                      <input
                        type="password"
                        name="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={128}
                      />
                    </label>
                    <label>
                      {t("adminPanel.role")}
                      <select name="role">
                        <option value="user">{t("user")}</option>
                        <option value="admin">{t("admin")}</option>
                      </select>
                    </label>
                    <button disabled={w.busy}>
                      <UserPlus size={16} />
                      {t("adminPanel.create")}
                    </button>
                  </form>
                  <p className="muted">{t("adminPanel.passwordNote")}</p>
                </details>
              </section>
              <section className="recipe-panel">
                <h2>{t("adminPanel.users")}</h2>
                <div className="preview-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("username")}</th>
                        <th>{t("adminPanel.role")}</th>
                        <th>{t("adminPanel.state")}</th>
                        <th>{t("adminPanel.actions")}</th>
                        <th>{t("password")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {w.accounts.map((account) => (
                        <AccountRow
                          key={`${account.id}:${account.role}:${account.active}`}
                          account={account}
                          busy={w.busy}
                          update={(role, active) =>
                            void w.update(account, role, active)
                          }
                          reset={(password, done) =>
                            void w.reset(account.id, password, done)
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pagination">
                  <span>
                    {t("adminPanel.accountCount", { count: w.total })}
                  </span>
                  <div className="actions">
                    <button
                      className="secondary"
                      disabled={w.busy || w.page === 1}
                      onClick={() => w.setPage(w.page - 1)}
                    >
                      {t("previous")}
                    </button>
                    <button
                      className="secondary"
                      disabled={w.busy || w.page * 25 >= w.total}
                      onClick={() => w.setPage(w.page + 1)}
                    >
                      {t("next")}
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
          {tab === "limits" && w.limits && (
            <section className="recipe-panel">
              <h2>{t("adminPanel.limits")}</h2>
              <p>{t("adminPanel.limitNote")}</p>
              <p className="quality-note">
                {t("adminPanel.storage", {
                  used: fmt((w.status?.payload_bytes ?? 0) / 1024 / 1024),
                  limit: w.status?.global_storage_mb,
                })}
              </p>
              <form
                key={w.limits.revision}
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget),
                    value = Object.fromEntries(
                      [...data.entries()].map(([key, v]) => [key, Number(v)]),
                    );
                  if (confirm(t("adminPanel.limitConfirm")))
                    void w.saveLimits(value);
                }}
              >
                <div className="limits-grid">
                  {Object.entries(w.limits.limits).map(([key, value]) => (
                    <label key={key}>
                      {t(`quota.${key}`)}
                      <input
                        type="number"
                        name={key}
                        required
                        min={w.limits!.fields[key].minimum}
                        max={w.limits!.fields[key].maximum}
                        step="1"
                        defaultValue={value}
                        disabled={w.busy}
                      />
                    </label>
                  ))}
                </div>
                <button disabled={w.busy}>
                  <Save size={16} />
                  {t("adminPanel.saveLimits")}
                </button>
              </form>
              <div className="maintenance-action">
                <p>{t("adminPanel.retention")}</p>
                <button
                  className="secondary"
                  disabled={w.busy}
                  onClick={() => void w.cleanup()}
                >
                  {t("adminPanel.cleanup")}
                </button>
              </div>
            </section>
          )}
          {tab === "runs" && (
            <section className="recipe-panel">
              <h2>{t("adminPanel.runs")}</h2>
              <label>
                {t("adminPanel.filterState")}
                <select
                  value={w.runFilter}
                  disabled={w.busy}
                  onChange={(e) => w.filterRuns(e.target.value)}
                >
                  <option value="">{t("adminPanel.allStates")}</option>
                  {["pending", "running", "completed", "failed"].map(
                    (value) => (
                      <option key={value} value={value}>
                        {t(`wf.${value}`)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              {!w.runs.length ? (
                <p className="muted">{t("adminPanel.noRuns")}</p>
              ) : (
                <div className="preview-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("username")}</th>
                        <th>{t("adminPanel.state")}</th>
                        <th>{t("adminPanel.time")}</th>
                        <th>{t("adminPanel.runError")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {w.runs.map((run) => (
                        <tr key={run.id}>
                          <td>{run.username}</td>
                          <td>{t(`wf.${run.status}`)}</td>
                          <td>
                            {new Intl.DateTimeFormat(i18n.language, {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(run.created_at))}
                          </td>
                          <td>
                            {run.error_code
                              ? t(`error.${run.error_code}`, {
                                  defaultValue: t("error.unknown"),
                                })
                              : "—"}
                            <details>
                              <summary>{t("details")}</summary>
                              {run.id} · v{run.workflow_version}
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="pagination">
                <span>{t("page", { page: w.runPage })}</span>
                <div className="actions">
                  <button
                    className="secondary"
                    disabled={w.busy || w.runPage === 1}
                    onClick={() => w.setRunPage(w.runPage - 1)}
                  >
                    {t("previous")}
                  </button>
                  <button
                    className="secondary"
                    disabled={w.busy || w.runPage * 25 >= w.runTotal}
                    onClick={() => w.setRunPage(w.runPage + 1)}
                  >
                    {t("next")}
                  </button>
                </div>
              </div>
            </section>
          )}
          {tab === "audit" && (
            <section className="recipe-panel">
              <h2>{t("adminPanel.audit")}</h2>
              <p className="muted">{t("adminPanel.auditNote")}</p>
              {!w.audit.length ? (
                <p>{t("adminPanel.noAudit")}</p>
              ) : (
                <div className="preview-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("adminPanel.time")}</th>
                        <th>{t("adminPanel.action")}</th>
                        <th>{t("adminPanel.details")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {w.audit.map((event) => (
                        <tr key={event.id}>
                          <td>
                            {new Intl.DateTimeFormat(i18n.language, {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(event.created_at))}
                          </td>
                          <td>
                            {t(`auditAction.${event.action}`, {
                              defaultValue: event.action,
                            })}
                          </td>
                          <td>
                            <details>
                              <summary>{t("details")}</summary>
                              <dl>
                                <dt>{t("adminPanel.actor")}</dt>
                                <dd>
                                  {event.actor_id ?? t("adminPanel.system")}
                                </dd>
                                <dt>{t("adminPanel.target")}</dt>
                                <dd>{event.target_id ?? "—"}</dd>
                                {Object.entries(event.details).map(
                                  ([key, v]) => (
                                    <div key={key}>
                                      <dt>
                                        {t(`auditField.${key}`, {
                                          defaultValue: key,
                                        })}
                                      </dt>
                                      <dd>
                                        {Array.isArray(v)
                                          ? v
                                              .map((x) =>
                                                t(`quota.${x}`, {
                                                  defaultValue: String(x),
                                                }),
                                              )
                                              .join(", ")
                                          : String(v)}
                                      </dd>
                                    </div>
                                  ),
                                )}
                              </dl>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="pagination">
                <span>{t("page", { page: w.auditPage })}</span>
                <div className="actions">
                  <button
                    className="secondary"
                    disabled={w.busy || w.auditPage === 1}
                    onClick={() => w.setAuditPage(w.auditPage - 1)}
                  >
                    {t("previous")}
                  </button>
                  <button
                    className="secondary"
                    disabled={w.busy || w.auditPage * 25 >= w.auditTotal}
                    onClick={() => w.setAuditPage(w.auditPage + 1)}
                  >
                    {t("next")}
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
