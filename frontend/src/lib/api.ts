import type {
  Bundle,
  CartItem,
  MeResponse,
  Pack,
  PackListFilters,
  PackSample,
  SampleKind,
} from "@multiverse/shared";

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

export interface DesignPreviewItem {
  generated_voice_id: string;
  audio_base_64: string;
  media_type: string;
}

export interface DesignPreviewsResponse {
  previews: DesignPreviewItem[];
}

export interface VoiceCloneJob {
  id: string;
  voice_id: string;
  status: "queued" | "fine_tuning" | "fine_tuned" | "failed";
  poll_attempts: number;
  credits_spent: number;
  refunded: boolean;
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export interface CreatedVoice {
  id: string;
  creator_id: string;
  eleven_voice_id: string;
  title: string;
  description: string;
  preview_url: string | null;
  cover_art_url: string | null;
  price_credits: number;
  status: string;
  clone_kind: string;
  training_status: string;
  is_private: boolean;
  requires_verification: boolean;
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
  topupCredits: (credits: number) => Promise<{ url: string }>;
  listTopupPacks: () => Promise<{ packs: Array<{ credits: number; price_cents: number }> }>;
  listPacks: (filters?: PackListFilters) => Promise<Pack[]>;
  getPack: (packId: string) => Promise<Pack>;
  checkoutCart: (items: CartItem[]) => Promise<{ url: string }>;
  myCredits: () => Promise<CreditsResponse>;
  createDraft: (data: DraftPayload) => Promise<Pack>;
  publishPack: (packId: string) => Promise<Pack>;

  // Sh.6 — Studio builder surface
  listMyPacks: () => Promise<Pack[]>;
  packAccess: (packId: string) => Promise<{ owned: boolean; is_creator: boolean }>;
  downloadPackZipUrl: (packId: string) => string;
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
  generateHero: (packId: string) => Promise<{ hero_art_url: string }>;
  listVoices: () => Promise<VoiceLibraryEntry[]>;
  designPreviews: (body: {
    prompt: string;
    name: string;
    gender?: string;
    age?: string;
    accent?: string;
  }) => Promise<DesignPreviewsResponse>;
  designSave: (body: {
    generated_voice_id: string;
    name: string;
    description: string;
    audio_base_64: string;
    publish_kind: "private" | "marketplace_draft";
  }) => Promise<CreatedVoice>;
  cloneInstant: (form: FormData) => Promise<CreatedVoice>;
  clonePvc: (form: FormData) => Promise<VoiceCloneJob>;
  getCloneJob: (jobId: string) => Promise<VoiceCloneJob>;
  publishAsAsset: (voiceId: string) => Promise<CreatedVoice>;
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
  ledger: (limit?: number) => Promise<LedgerEntry[]>;
  purchasePack: (packId: string) => Promise<PurchaseRecord>;
  updatePack: (
    packId: string,
    patch: Partial<{
      title: string;
      description: string;
      tags: string[];
      price_cents: number;
      license_commercial_multiplier: number;
    }>,
  ) => Promise<Pack>;
  deletePack: (packId: string) => Promise<void>;
  listMarketplaceVoices: () => Promise<MarketplaceVoice[]>;
  getMarketplaceVoice: (voiceId: string) => Promise<MarketplaceVoice>;
  purchaseVoice: (voiceId: string) => Promise<VoiceAccessRecord>;
  listOwnedVoices: () => Promise<MarketplaceVoice[]>;
  generateTts: (voiceId: string, text: string) => Promise<TTSResult>;
}

export interface TTSResult {
  audio_url: string;
  credits_spent: number;
  duration_ms: number;
  voice_id: string;
}

export interface MarketplaceVoice {
  id: string;
  creator_id: string;
  creator_name: string;
  title: string;
  description: string;
  eleven_voice_id: string;
  preview_url: string | null;
  cover_art_url: string | null;
  price_credits: number;
  status: string;
  tags: string[];
  purchases_count: number;
  created_at: string | null;
  published_at: string | null;
}

export interface VoiceAccessRecord {
  id: string;
  voice_id: string;
  purchase_credits_paid: number;
  granted_at: string | null;
}

export interface PurchaseRecord {
  id: string;
  pack_id: string;
  price_paid_credits: number;
  license_kind: string;
  created_at: string | null;
}

export interface LedgerEntry {
  id: string;
  delta: number;
  reason: string;
  related_pack_id: string | null;
  related_voice_id: string | null;
  related_user_id: string | null;
  balance_after: number;
  note: string | null;
  created_at: string | null;
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
    // FormData uploads carry their own multipart boundary in Content-Type;
    // setting application/json clobbers it and the server rejects the body.
    if (init.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    const token = await opts.getToken?.();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await f(`${BASE}${path}`, { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new ApiError(res.status, text);
    }
    if (res.status === 204) return undefined as T;
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
    topupCredits: (credits) =>
      request("/billing/topup", {
        method: "POST",
        body: JSON.stringify({ credits }),
      }),
    listTopupPacks: () => request("/billing/topup/packs"),
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
    packAccess: (packId) =>
      request<{ owned: boolean; is_creator: boolean }>(`/packs/${encodeURIComponent(packId)}/access`),
    downloadPackZipUrl: (packId) => `${BASE}/packs/${encodeURIComponent(packId)}/download/zip`,
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
    generateHero: (packId) =>
      request<{ hero_art_url: string }>("/studio/generate/hero", {
        method: "POST",
        body: JSON.stringify({ pack_id: packId }),
      }),
    listVoices: () => request<VoiceLibraryEntry[]>("/voices/library"),
    designPreviews: (body) =>
      request<DesignPreviewsResponse>("/voices/design/previews", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    designSave: (body) =>
      request<CreatedVoice>("/voices/design/save", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    cloneInstant: (form) =>
      request<CreatedVoice>("/voices/clone/instant", {
        method: "POST",
        body: form,
      }),
    clonePvc: (form) =>
      request<VoiceCloneJob>("/voices/clone/professional", {
        method: "POST",
        body: form,
      }),
    getCloneJob: (jobId) =>
      request<VoiceCloneJob>(
        `/voices/clone/jobs/${encodeURIComponent(jobId)}`,
      ),
    publishAsAsset: (voiceId) =>
      request<CreatedVoice>(
        `/voices/${encodeURIComponent(voiceId)}/publish-as-asset`,
        { method: "POST" },
      ),
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
    ledger: (limit = 50) =>
      request<LedgerEntry[]>(`/credits/ledger?limit=${limit}`),
    purchasePack: (packId) =>
      request<PurchaseRecord>(
        `/packs/${encodeURIComponent(packId)}/purchase`,
        { method: "POST", body: JSON.stringify({}) },
      ),
    updatePack: (packId, patch) =>
      request<Pack>(`/packs/${encodeURIComponent(packId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    deletePack: (packId) =>
      request<void>(`/packs/${encodeURIComponent(packId)}`, {
        method: "DELETE",
      }),
    listMarketplaceVoices: () => request<MarketplaceVoice[]>("/voices"),
    getMarketplaceVoice: (voiceId) =>
      request<MarketplaceVoice>(`/voices/${encodeURIComponent(voiceId)}`),
    purchaseVoice: (voiceId) =>
      request<VoiceAccessRecord>(
        `/voices/${encodeURIComponent(voiceId)}/purchase`,
        { method: "POST", body: JSON.stringify({}) },
      ),
    listOwnedVoices: () => request<MarketplaceVoice[]>("/voices/mine"),
    generateTts: (voiceId, text) =>
      request<TTSResult>("/studio/tts", {
        method: "POST",
        body: JSON.stringify({ voice_id: voiceId, text }),
      }),
  };
}

function packFiltersToQuery(filters: PackListFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.category) p.set("category", filters.category);
  for (const tag of filters.tags ?? []) p.append("tags", tag);
  for (const mood of filters.moods ?? []) p.append("moods", mood);
  if (filters.price_min_credits != null)
    p.set("price_min_credits", String(filters.price_min_credits));
  if (filters.price_max_credits != null)
    p.set("price_max_credits", String(filters.price_max_credits));
  if (filters.q) p.set("q", filters.q);
  if (filters.sort) p.set("sort", filters.sort);
  if (filters.limit != null) p.set("limit", String(filters.limit));
  if (filters.offset != null) p.set("offset", String(filters.offset));
  return p;
}

// Module-level token getter — set once by AuthSync after Clerk loads.
let _tokenGetter: (() => Promise<string | null>) | undefined;

// Promise that resolves the first time setTokenGetter() is called. Every
// api.* call awaits this BEFORE issuing fetch so the very first /me /
// /me/credits etc. always carry a JWT (no race with AuthSync's useEffect).
let _resolveTokenReady: (() => void) | undefined;
const _tokenReady: Promise<void> = new Promise((resolve) => {
  _resolveTokenReady = resolve;
});

/** Called by AuthSync to wire Clerk's getToken into the singleton. */
export function setTokenGetter(fn: () => Promise<string | null>): void {
  _tokenGetter = fn;
  _resolveTokenReady?.();
  _resolveTokenReady = undefined;
}

/**
 * Resolve a Clerk JWT, waiting up to 1.5 s for AuthSync to wire its getter.
 * After the timeout we fall back to null — preserves anonymous browse on
 * pages that don't strictly need auth.
 */
async function _getToken(): Promise<string | null> {
  if (!_tokenGetter) {
    await Promise.race([
      _tokenReady,
      new Promise<void>((r) => setTimeout(r, 1500)),
    ]);
  }
  if (!_tokenGetter) return null;
  return _tokenGetter();
}

/** Singleton ApiClient used by hooks. Override only in tests. */
export const api: ApiClient = makeApi({ getToken: _getToken });
