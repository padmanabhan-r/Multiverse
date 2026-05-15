import type { MeResponse } from "@multiverse-fm/shared";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Fetcher = typeof fetch;

export function makeApi(opts: { getToken?: () => Promise<string | null>; fetcher?: Fetcher } = {}) {
  const f = opts.fetcher ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    const token = await opts.getToken?.();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await f(`${BASE}${path}`, { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new ApiError(res.status, text);
    }
    return (await res.json()) as T;
  }

  return {
    me: (): Promise<MeResponse> => request<MeResponse>("/me"),
    checkout: (tier: "explorer" | "architect"): Promise<{ url: string }> =>
      request("/billing/checkout", { method: "POST", body: JSON.stringify({ tier }) }),
    portal: (): Promise<{ url: string }> => request("/billing/portal", { method: "POST" }),
  };
}
