import type {
  Bundle,
  CartItem,
  MeResponse,
  Pack,
  PackListFilters,
  PackSample,
  SampleKind,
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

export interface EnhanceResponse {
  enriched: string;
  suggestions: string[];
}

export interface VoiceLibraryEntry {
  voice_id: string;
  name: string;
  preview_url: string | null;
  labels: Record<string, string>;
  category: string;
}

export interface CreatorMe {
  creator_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  draft_count: number;
  published_count: number;
  bundle_count: number;
  sales_count_30d: number;
  sales_cents_30d: number;
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

  // Sh.6 — Studio builder surface
  listMyPacks: () => Promise<Pack[]>;
  listSamples: (packId: string) => Promise<PackSample[]>;
  deleteSample: (packId: string, sampleId: string) => Promise<void>;
  updateSample: (
    packId: string,
    sampleId: string,
    patch: { title?: string; position?: number },
  ) => Promise<PackSample>;
  enhancePrompt: (prompt: string, kind: SampleKind) => Promise<EnhanceResponse>;
  generateSfx: (body: {
    pack_id: string;
    prompt: string;
    duration_seconds: number;
    loop?: boolean;
    title: string;
  }) => Promise<PackSample>;
  generateMusic: (body: {
    pack_id: string;
    prompt: string;
    music_length_ms: number;
    title: string;
  }) => Promise<PackSample>;
  generateVoice: (body: {
    pack_id: string;
    voice_id: string;
    text: string;
    title: string;
  }) => Promise<PackSample>;
  generateAmbient: (body: {
    pack_id: string;
    prompt: string;
    duration_seconds: number;
    title: string;
  }) => Promise<PackSample>;
  generateCover: (packId: string) => Promise<{ cover_art_url: string }>;
  listVoices: () => Promise<VoiceLibraryEntry[]>;
  designVoice: (
    body: { prompt: string; name: string },
  ) => Promise<{ voice_id: string; preview_url: string }>;
  createBundle: (body: {
    title: string;
    description: string;
    price_cents: number;
    pack_ids: string[];
  }) => Promise<Bundle>;
  publishBundle: (bundleId: string) => Promise<Bundle>;
  listMyBundles: () => Promise<Bundle[]>;
  creatorMe: () => Promise<CreatorMe>;
  creatorSales: () => Promise<CreatorSale[]>;
  library: () => Promise<LibraryItem[]>;
  creatorPublic: (creatorId: string) => Promise<PublicCreatorPage>;
}

export interface LibraryItem {
  purchase_id: string;
  pack_id: string;
  title: string;
  description: string;
  category: string;
  cover_art_url: string | null;
  license_kind: string;
  price_paid_cents: number;
  purchased_at: string | null;
}

export interface PublicCreatorPage {
  creator: {
    creator_id: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    published_pack_count: number;
    bundle_count: number;
  };
  packs: Pack[];
  bundles: Bundle[];
}

export interface CreatorSale {
  purchase_id: string;
  pack_id: string;
  pack_title: string;
  license_kind: string;
  price_paid_cents: number;
  created_at: string | null;
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

    listMyPacks: () => request<Pack[]>("/packs/mine"),
    listSamples: (packId) =>
      request<PackSample[]>(`/packs/${encodeURIComponent(packId)}/samples`),
    deleteSample: async (packId, sampleId) => {
      const headers = new Headers();
      const token = await opts.getToken?.();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await f(
        `${BASE}/packs/${encodeURIComponent(packId)}/samples/${encodeURIComponent(sampleId)}`,
        { method: "DELETE", headers },
      );
      if (!res.ok) throw new ApiError(res.status, await res.text());
    },
    updateSample: (packId, sampleId, patch) =>
      request<PackSample>(
        `/packs/${encodeURIComponent(packId)}/samples/${encodeURIComponent(sampleId)}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      ),
    enhancePrompt: (prompt, kind) =>
      request<EnhanceResponse>("/studio/enhance-prompt", {
        method: "POST",
        body: JSON.stringify({ prompt, kind }),
      }),
    generateSfx: (body) =>
      request<PackSample>("/studio/generate/sfx", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    generateMusic: (body) =>
      request<PackSample>("/studio/generate/music", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    generateVoice: (body) =>
      request<PackSample>("/studio/generate/voice", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    generateAmbient: (body) =>
      request<PackSample>("/studio/generate/ambient", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    generateCover: (packId) =>
      request<{ cover_art_url: string }>("/studio/generate/cover", {
        method: "POST",
        body: JSON.stringify({ pack_id: packId }),
      }),
    listVoices: () => request<VoiceLibraryEntry[]>("/voices/library"),
    designVoice: (body) =>
      request<{ voice_id: string; preview_url: string }>("/voices/design", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    createBundle: (body) =>
      request<Bundle>("/bundles", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    publishBundle: (bundleId) =>
      request<Bundle>(`/bundles/${encodeURIComponent(bundleId)}/publish`, {
        method: "POST",
      }),
    listMyBundles: () => request<Bundle[]>("/bundles/mine"),
    creatorMe: () => request<CreatorMe>("/creator/me"),
    creatorSales: () => request<CreatorSale[]>("/creator/me/sales"),
    library: () => request<LibraryItem[]>("/library"),
    creatorPublic: (creatorId) =>
      request<PublicCreatorPage>(
        `/creators/${encodeURIComponent(creatorId)}`,
      ),
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
