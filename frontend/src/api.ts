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
    outlier_bounds: { lower: string; upper: string; method: string } | null;
    distribution: { value: string; count: number }[];
  }[];
}
export interface ProblemDetails {
  column?: string;
  rule?: string;
  rows?: number[];
  count?: number;
}
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public details?: ProblemDetails,
  ) {
    super(code);
  }
}
let csrf = "";
let sessionGeneration = 0;
let authenticated = false;
const expiryListeners = new Set<() => void>();

// Invalidate pending responses when an identity changes. Tokens stay in memory.
export function setSessionAuthenticated(active: boolean) {
  sessionGeneration++;
  authenticated = active;
  if (!active) csrf = "";
}

export function onSessionExpired(listener: () => void) {
  expiryListeners.add(listener);
  return () => {
    expiryListeners.delete(listener);
  };
}

function checkGeneration(generation: number | null) {
  if (generation !== null && generation !== sessionGeneration)
    throw new DOMException("The active session changed.", "AbortError");
}

async function request(path: string, options: RequestInit) {
  const generation = ["/config", "/health"].includes(path)
    ? null
    : sessionGeneration;
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
  checkGeneration(generation);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ code: "unknown" }));
    checkGeneration(generation);
    // Wrong credentials/current password are not evidence of session expiry.
    if (
      response.status === 401 &&
      authenticated &&
      ["unauthorized", "session_expired"].includes(error.code)
    ) {
      setSessionAuthenticated(false);
      expiryListeners.forEach((listener) => listener());
    }
    throw new ApiError(error.code ?? "unknown", response.status, error.details);
  }
  return { response, generation };
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { response, generation } = await request(path, options);
  const data =
    response.status === 204
      ? undefined
      : await response.json().catch(() => ({ code: "unknown" }));
  checkGeneration(generation);
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
  const { response, generation } = await request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const blob = await response.blob();
  checkGeneration(generation);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
