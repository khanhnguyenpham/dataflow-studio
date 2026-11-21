import { useCallback, useEffect, useState } from "react";
import { api, post, ApiError } from "./api";

export interface Account {
  id: string;
  username: string;
  role: "user" | "admin";
  active: boolean;
  created_at: string;
}
export interface LimitConfig {
  revision: number;
  limits: Record<string, number>;
  fields: Record<string, { minimum: number; maximum: number; default: number }>;
}
export interface Audit {
  id: string;
  actor_id: string | null;
  action: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
export interface OperationalRun {
  id: string;
  username: string;
  status: string;
  error_code: string | null;
  created_at: string;
  workflow_version: number;
}
export function useAdmin(ownId: string, sessionChanged: () => Promise<void>) {
  const [runs, setRuns] = useState<OperationalRun[]>([]),
    [runTotal, setRunTotal] = useState(0),
    [runPage, setRunPage] = useState(1),
    [runFilter, setRunFilter] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [audit, setAudit] = useState<Audit[]>([]),
    [auditTotal, setAuditTotal] = useState(0),
    [auditPage, setAuditPage] = useState(1),
    [status, setStatus] = useState<Record<string, number> | null>(null),
    [limits, setLimits] = useState<LimitConfig | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const [users, events, health, config, executions] = await Promise.all([
        api<{ items: Account[]; total: number }>(`/admin/users?page=${page}`, {
          signal,
        }),
        api<{ items: Audit[]; total: number }>(
          `/admin/audit?page=${auditPage}`,
          { signal },
        ),
        api<Record<string, number>>("/admin/status", { signal }),
        api<LimitConfig>("/admin/limits", { signal }),
        api<{ items: OperationalRun[]; total: number }>(
          `/admin/runs?page=${runPage}${runFilter ? `&state=${runFilter}` : ""}`,
          { signal },
        ),
      ]);
      setAccounts(users.items);
      setTotal(users.total);
      setAudit(events.items);
      setAuditTotal(events.total);
      setStatus(health);
      setLimits(config);
      setRuns(executions.items);
      setRunTotal(executions.total);
    },
    [page, auditPage, runPage, runFilter],
  );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    refresh(controller.signal)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.code ?? "network");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice("adminPanel.saved");
    } catch (e) {
      setError(e instanceof ApiError ? e.code : "network");
    } finally {
      setBusy(false);
    }
  }
  return {
    runs,
    runTotal,
    runPage,
    setRunPage,
    runFilter,
    filterRuns: (state: string) => {
      setRunPage(1);
      setRunFilter(state);
    },
    accounts,
    total,
    page,
    setPage,
    audit,
    auditTotal,
    auditPage,
    setAuditPage,
    status,
    limits,
    busy,
    loading,
    error,
    notice,
    refresh: () => perform(() => refresh()),
    create: (
      body: { username: string; password: string; role: string },
      done: () => void,
    ) =>
      perform(async () => {
        await post("/admin/users", body);
        done();
        await refresh();
      }),
    update: (account: Account, role: string, active: boolean) =>
      perform(async () => {
        await post(`/admin/users/${account.id}`, { role, active });
        if (
          account.id === ownId &&
          (role !== account.role || active !== account.active)
        ) {
          await sessionChanged();
          return;
        }
        await refresh();
      }),
    reset: (id: string, password: string, done: () => void) =>
      perform(async () => {
        await post(`/admin/users/${id}/password`, { password });
        done();
        if (id === ownId) {
          await sessionChanged();
          return;
        }
        await refresh();
      }),
    saveLimits: (value: Record<string, number>) =>
      perform(async () => {
        await post("/admin/limits", {
          expected_revision: limits?.revision,
          limits: value,
        });
        await refresh();
      }),
    cleanup: () =>
      perform(async () => {
        await post("/admin/maintenance");
        await refresh();
      }),
  };
}
