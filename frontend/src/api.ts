export interface User {
  id: string;
  username: string;
  role: "guest" | "user" | "admin";
  expires_at: string | null;
}
export interface Dataset {
  id: string;
  name: string;
  rows: number;
  columns: number;
  version: number;
  sheet: string | null;
  created_at: string;
}
export interface Detail extends Dataset {
  column_names: string[];
  records: (string | null)[][];
  page: number;
  page_size: number;
}
export interface Profile {
  rows: number;
  columns: number;
  duplicate_rows: number;
  missing_cells: number;
  invalid_candidates: number;
  fields: {
    name: string;
    suggested_type: string;
    missing: number;
    unique: number;
    invalid: number;
    outlier_warnings: number;
    statistics: Record<string, string> | null;
  }[];
}
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
let csrf = "";
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.method && options.method !== "GET")
    headers.set("X-CSRF-Token", csrf);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: "same-origin",
      headers,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("network", 0);
  }
  const data =
    response.status === 204
      ? undefined
      : await response.json().catch(() => ({ code: "unknown" }));
  if (!response.ok) throw new ApiError(data.code ?? "unknown", response.status);
  if (data?.csrf) csrf = data.csrf;
  return data as T;
}
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

export async function download(path: string, body: unknown, name: string) {
  const response = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ code: "unknown" }));
    throw new ApiError(error.code ?? "unknown", response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
