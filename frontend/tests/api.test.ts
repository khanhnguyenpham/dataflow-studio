import { afterEach, expect, test, vi } from "vitest";
import {
  api,
  download,
  onSessionExpired,
  post,
  setSessionAuthenticated,
} from "../src/api";

afterEach(() => {
  setSessionAuthenticated(false);
  vi.unstubAllGlobals();
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const deferred = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("missing initial session and wrong current password do not expire an active workspace", async () => {
  const expired = vi.fn();
  const stop = onSessionExpired(expired);
  try {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ code: "unauthorized" }, 401)),
    );
    await expect(api("/auth/session")).rejects.toMatchObject({ status: 401 });
    setSessionAuthenticated(true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ code: "invalid_login" }, 401)),
    );
    await expect(post("/auth/password", {})).rejects.toMatchObject({
      code: "invalid_login",
    });
    expect(expired).not.toHaveBeenCalled();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ code: "unauthorized" }, 401)),
    );
    await expect(api("/datasets")).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  } finally {
    stop();
  }
});

test.each(["api", "download"])(
  "%s notifies session expiry once",
  async (kind) => {
    setSessionAuthenticated(true);
    const expired = vi.fn(),
      stop = onSessionExpired(expired);
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(json({ code: "session_expired" }, 401)),
      );
      const send = () =>
        kind === "api"
          ? api("/datasets")
          : download("/datasets/id/export", {}, "test.csv");
      await expect(send()).rejects.toMatchObject({ code: "session_expired" });
      await expect(send()).rejects.toMatchObject({ status: 401 });
      expect(expired).toHaveBeenCalledOnce();
    } finally {
      stop();
    }
  },
);

test.each([200, 401])(
  "a late %s response cannot restore old data or expire a new identity",
  async (status) => {
    setSessionAuthenticated(true);
    const old = deferred(),
      expired = vi.fn(),
      stop = onSessionExpired(expired);
    try {
      const fetcher = vi
        .fn()
        .mockReturnValueOnce(old.promise)
        .mockResolvedValue(json({ ok: true }));
      vi.stubGlobal("fetch", fetcher);
      const pending = api("/auth/session");
      setSessionAuthenticated(false);
      // Simulate a newly authenticated identity with its own CSRF value.
      fetcher.mockResolvedValueOnce(json({ csrf: "new-test-token" }));
      await api("/auth/session");
      setSessionAuthenticated(true);
      old.resolve(
        json(
          status === 401
            ? { code: "unauthorized" }
            : { csrf: "old-test-token", user: { id: "old" } },
          status,
        ),
      );
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      await post("/datasets/sample");
      expect(
        new Headers(fetcher.mock.calls.at(-1)![1].headers).get("X-CSRF-Token"),
      ).toBe("new-test-token");
      expect(expired).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  },
);

test("public configuration can finish while authentication changes", async () => {
  const config = deferred();
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(config.promise));
  const pending = api("/config");
  setSessionAuthenticated(true);
  config.resolve(json({ max_rows: 10000 }));
  await expect(pending).resolves.toEqual({ max_rows: 10000 });
});

test("an export body from an old identity is never downloaded", async () => {
  let resolve!: (value: Blob) => void;
  const blob = new Promise<Blob>((done) => {
    resolve = done;
  });
  const started = vi.fn().mockReturnValue(blob);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, blob: started }),
  );
  const pending = download("/datasets/id/export", {}, "test.csv");
  await vi.waitFor(() => expect(started).toHaveBeenCalled());
  setSessionAuthenticated(false);
  resolve(new Blob(["old-data"]));
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});
