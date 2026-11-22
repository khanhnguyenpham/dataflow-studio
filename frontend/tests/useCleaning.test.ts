import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import {
  useCleaning,
  type CleaningDrafts,
  type Preview,
} from "../src/useCleaning";
import type { Detail } from "../src/api";

const detail: Detail = {
  id: "source",
  name: "test.csv",
  rows: 2,
  columns: 1,
  version: 1,
  sheet: null,
  created_at: "2026-11-22",
  column_names: ["ID"],
  records: [["001"], ["001"]],
  page: 1,
  page_size: 10,
};
const preview: Preview = {
  id: "preview",
  input_version: 1,
  expires_at: "2026-11-23",
  changed: true,
  before: { columns: ["ID"], records: [["001"], ["001"]], rows: 2 },
  after: { columns: ["ID"], records: [["001"]], rows: 1 },
  impacts: [],
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function serve(failApply = false) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("/versions")
              ? { items: [] }
              : url.endsWith("/preview")
                ? preview
                : failApply
                  ? { code: "preview_expired" }
                  : { ok: true },
          ),
          { status: failApply && url.endsWith("/apply") ? 409 : 200 },
        ),
    ),
  );
}

test("navigation retains only recipe steps; each dataset/version needs a fresh preview", async () => {
  serve();
  const drafts: CleaningDrafts = new Map(),
    changed = vi.fn();
  const first = renderHook(() => useCleaning(detail, changed, drafts));
  act(() =>
    first.result.current.updateSteps([{ op: "dedupe", columns: ["ID"] }]),
  );
  await act(() => first.result.current.inspect());
  expect(first.result.current.preview?.id).toBe("preview");
  first.unmount();
  const other = renderHook(() =>
    useCleaning({ ...detail, id: "other" }, changed, drafts),
  );
  expect(other.result.current.steps).toEqual([]);
  other.unmount();
  const back = renderHook(() => useCleaning(detail, changed, drafts));
  expect(back.result.current.steps).toEqual([
    { op: "dedupe", columns: ["ID"] },
  ]);
  expect(back.result.current.preview).toBeNull();
  expect(JSON.stringify([...drafts.values()])).not.toContain("001");
  back.unmount();
  const newer = renderHook(() =>
    useCleaning({ ...detail, version: 2 }, changed, drafts),
  );
  expect(newer.result.current.steps).toEqual([]);
  expect(drafts.size).toBe(0);
});

test("failed apply retains steps for review; success clears the draft", async () => {
  serve(true);
  const drafts: CleaningDrafts = new Map(),
    changed = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(() => useCleaning(detail, changed, drafts));
  act(() =>
    hook.result.current.updateSteps([{ op: "dedupe", columns: ["ID"] }]),
  );
  await act(() => hook.result.current.inspect());
  await act(() => hook.result.current.apply());
  expect(hook.result.current.error).toBe("preview_expired");
  expect(drafts.size).toBe(1);
  expect(changed).not.toHaveBeenCalled();
  serve();
  await act(() => hook.result.current.inspect());
  await act(() => hook.result.current.apply());
  expect(hook.result.current.steps).toEqual([]);
  expect(drafts.size).toBe(0);
  expect(changed).toHaveBeenCalledOnce();
});
