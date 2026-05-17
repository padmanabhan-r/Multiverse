import type {
  CartItem,
  MeResponse,
  Pack,
  PackListFilters,
} from "@multiverse-fm/shared";

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

export interface CreditsResponse {
  balance: number;
  tier_monthly_grant: number;
  cycle_start: string | null;
  last_topup_at: string | null;
  cost_per_category: Record<string, number>;
}

export interface DraftPayload {
  title: string;
  category: string;
  description: string;
  price_cents: number;
  tags: string[];
  moods: string[];
  license_commercial_multiplier: number;
  style_profile?: Record<string, unknown>;
}

export interface ApiClient {
  me: () => Promise<MeResponse>;
  subscribe: (tier: "creator" | "pro_studio") => Promise<{ url: string }>;
  portal: () => Promise<{ url: string }>;
  listPacks: (filters?: PackListFilters) => Promise<Pack[]>;
  getPack: (packId: string) => Promise<Pack>;
  checkoutCart: (items: CartItem[]) => Promise<{ url: string }>;
  myCredits: () => Promise<CreditsResponse>;
  createDraft: (data: DraftPayload) => Promise<Pack>;
  publishPack: (packId: string) => Promise<Pack>;
}

export function makeApi(opts: { getToken?: () => Promise<string | null>; fetcher?: Fetcher } = {}): ApiClient {
  const f = opts.fetcher ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body) headers.set("Content-Type", "application/json");
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
    me: () => request<MeResponse>("/me"),
    subscribe: (tier) =>
      request("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ tier }),
      }),
    portal: () => request("/billing/portal", { method: "POST" }),
    listPacks: (filters = {}) => {
      const params = packFiltersToQuery(filters);
      const qs = params.toString();
      return request<Pack[]>(`/packs${qs ? `?${qs}` : ""}`);
    },
    getPack: (packId) => request<Pack>(`/packs/${encodeURIComponent(packId)}`),
    checkoutCart: (items) =>
      request("/checkout", {
        method: "POST",
        body: JSON.stringify({
          items: items.map((i) => ({
            pack_id: i.pack_id,
            license_kind: i.license_kind,
          })),
        }),
      }),
    myCredits: () => request<CreditsResponse>("/me/credits"),
    createDraft: (data) =>
      request<Pack>("/packs/draft", { method: "POST", body: JSON.stringify(data) }),
    publishPack: (packId) =>
      request<Pack>(`/packs/${encodeURIComponent(packId)}/publish`, { method: "POST" }),
  };
}

function packFiltersToQuery(filters: PackListFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.category) p.set("category", filters.category);
  for (const tag of filters.tags ?? []) p.append("tags", tag);
  for (const mood of filters.moods ?? []) p.append("moods", mood);
  if (filters.price_min_cents != null)
    p.set("price_min_cents", String(filters.price_min_cents));
  if (filters.price_max_cents != null)
    p.set("price_max_cents", String(filters.price_max_cents));
  if (filters.q) p.set("q", filters.q);
  if (filters.sort) p.set("sort", filters.sort);
  if (filters.limit != null) p.set("limit", String(filters.limit));
  if (filters.offset != null) p.set("offset", String(filters.offset));
  return p;
}

// Module-level token getter — set once by AuthSync after Clerk loads.
let _tokenGetter: (() => Promise<string | null>) | undefined;

/** Called by AuthSync to wire Clerk's getToken into the singleton. */
export function setTokenGetter(fn: () => Promise<string | null>): void {
  _tokenGetter = fn;
}

/** Singleton ApiClient used by hooks. Override only in tests. */
export const api: ApiClient = makeApi({
  getToken: () => _tokenGetter?.() ?? Promise.resolve(null),
});
