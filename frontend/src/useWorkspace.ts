import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  post,
  ApiError,
  onSessionExpired,
  setSessionAuthenticated,
  type Dataset,
  type Detail,
  type Profile,
  type User,
} from "./api";

export function useWorkspace(loadSelected = true) {
  const [user, setUser] = useState<User | null>(null),
    [initial, setInitial] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [datasets, setDatasets] = useState<Dataset[]>([]),
    [selected, setSelected] = useState(""),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState<Detail | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  const refreshGeneration = useRef(0);
  const [uploadLimits, setUploadLimits] = useState<{
    upload_max_bytes: number;
    max_rows: number;
    max_columns: number;
  } | null>(null);
  useEffect(
    () =>
      onSessionExpired(() => {
        refreshGeneration.current++;
        setUser(null);
        setDatasets([]);
        setSelected("");
        setDetail(null);
        setProfile(null);
        setNotice("");
        setError("session_expired");
      }),
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    api<{ upload_max_bytes: number; max_rows: number; max_columns: number }>(
      "/config",
      { signal: controller.signal },
    )
      .then(setUploadLimits)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.code ?? "network");
      });
    return () => controller.abort();
  }, []);
  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    const result = await api<{ items: Dataset[] }>("/datasets");
    if (generation === refreshGeneration.current) setDatasets(result.items);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api<{ user: User }>("/auth/session", { signal: controller.signal })
      .then((x) => {
        if (controller.signal.aborted) return;
        setSessionAuthenticated(true);
        setUser(x.user);
      })
      .catch((e) => {
        if (
          !controller.signal.aborted &&
          e instanceof ApiError &&
          e.status !== 401
        )
          setError(e.code);
      })
      .finally(() => setInitial(false));
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (user)
      void refresh().catch((e) => {
        if (e instanceof ApiError && e.status !== 401) setError(e.code);
      });
    else {
      refreshGeneration.current++;
      setDatasets([]);
      setSelected("");
      setDetail(null);
      setProfile(null);
    }
  }, [user, refresh]);
  useEffect(() => {
    if (!selected || !loadSelected) {
      setLoading(false);
      setDetail(null);
      setProfile(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setDetail(null);
    setProfile(null);
    Promise.all([
      api<Detail>(`/datasets/${selected}?page=${page}`, {
        signal: controller.signal,
      }),
      api<Profile>(`/datasets/${selected}/profile`, {
        signal: controller.signal,
      }),
    ])
      .then(([d, p]) => {
        setDetail(d);
        setProfile(p);
      })
      .catch((e) => {
        if (
          !controller.signal.aborted &&
          e instanceof ApiError &&
          e.status !== 401
        )
          setError(e.code);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selected, page, revision, loadSelected]);
  async function action<T>(work: () => Promise<T>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      return await work();
    } catch (e) {
      if (
        !(e instanceof DOMException && e.name === "AbortError") &&
        !(
          e instanceof ApiError &&
          e.status === 401 &&
          e.code !== "invalid_login"
        )
      )
        setError(e instanceof ApiError ? e.code : "unknown");
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  async function authenticate(body?: { username: string; password: string }) {
    await action(async () => {
      const result = await post<{ user: User }>(
        body ? "/auth/login" : "/auth/guest",
        body,
      );
      setSessionAuthenticated(true);
      setUser(result.user);
      if (!body) {
        const sample = await post<Dataset>("/datasets/sample");
        setSelected(sample.id);
        setPage(1);
        await refresh();
      }
    });
  }
  async function sample(kind = "sales") {
    await action(async () => {
      const row = await post<Dataset>(
        `/datasets/sample?kind=${encodeURIComponent(kind)}`,
      );
      await refresh();
      setSelected(row.id);
      setPage(1);
    });
  }
  async function upload(file: File, sheet: string, encoding: string) {
    return action(async () => {
      const form = new FormData();
      form.append("file", file);
      form.append("encoding", encoding);
      if (sheet) form.append("sheet", sheet);
      const result = await api<
        Dataset | { requires_sheet: true; sheets: string[] }
      >("/datasets/import", { method: "POST", body: form });
      if ("id" in result) {
        await refresh();
        setSelected(result.id);
        setPage(1);
      }
      return result;
    });
  }
  async function remove(id: string) {
    await action(async () => {
      await api(`/datasets/${id}`, { method: "DELETE" });
      if (selected === id) setSelected("");
      await refresh();
    });
  }
  async function logout() {
    await action(async () => {
      try {
        await post("/auth/logout");
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401)) throw e;
      }
      setSessionAuthenticated(false);
      setUser(null);
    });
  }
  async function password(current_password: string, new_password: string) {
    return action(async () => {
      await post("/auth/password", { current_password, new_password });
      setSessionAuthenticated(false);
      setUser(null);
      setNotice("passwordChanged");
      return true;
    });
  }
  return {
    user,
    initial,
    busy,
    error,
    notice,
    setError,
    datasets,
    selected,
    select: (id: string) => {
      setSelected(id);
      setPage(1);
    },
    page,
    setPage,
    detail,
    profile,
    loading,
    authenticate,
    sample,
    upload,
    remove,
    logout,
    password,
    refresh,
    uploadLimits,
    refreshIdentity: async () => {
      try {
        const result = await api<{ user: User }>("/auth/session");
        setUser(result.user);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) setUser(null);
        else throw e;
      }
    },
    changed: async () => {
      await refresh();
      setPage(1);
      setRevision((n) => n + 1);
    },
  };
}
