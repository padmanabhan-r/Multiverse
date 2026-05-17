export type RealityType = "earth" | "alternate_earth" | "fictional";
export type Tier = "free" | "explorer" | "architect";

export type MasteringPreset =
  | "archive_1940"
  | "archive_1986"
  | "earth_now"
  | "future_orbital"
  | "imperium_steam"
  | "pirate_neon";

export type SegmentKind =
  | "tuning_lock"
  | "ident_dj_intro"
  | "music_foreground_a"
  | "news_bulletin"
  | "music_foreground_b"
  | "sponsor_ad"
  | "dj_banter_callin"
  | "closing_teaser"
  | "fade_retune_cue";

export interface Station {
  id: string;
  station_name: string;
  reality_type: RealityType;
  year_or_era: string;
  place: string;
  broadcast_format: string;
  dj_persona: string;
  language_register: string;
  music_blueprint: Record<string, unknown>;
  ad_economy: string[];
  headline_style: string;
  weather_style: string;
  ambient_palette: string[];
  signal_texture: string;
  station_slogan: string;
  dj_voice_id: string;
  mastering_preset: MasteringPreset;
  tier_required: Tier;
  card_art_url: string | null;
  hero_art_url: string | null;
}

export interface BroadcastSegment {
  t_start_ms: number;
  t_end_ms: number;
  kind: SegmentKind;
  text?: string;
  voice_id?: string;
}

export interface BroadcastStems {
  music_url: string;
  voice_urls: string[];
  ambience_url: string;
}

export interface BroadcastManifest {
  block_id: string;
  station_id: string;
  duration_ms: number;
  segments: BroadcastSegment[];
  stems: BroadcastStems;
  mastering_preset: MasteringPreset;
}

export interface WorldBible {
  id: string;
  user_id: string;
  prompt: string;
  one_line_premise: string;
  reality_axis: { reality: RealityType; year: string };
  geography: string[];
  politics: string[];
  technology: string[];
  daily_life: string[];
  sponsors: string[];
  weather_system: string;
  headline_register: string;
  music_palette: string[];
  music_negatives: string[];
  ambient_palette: string[];
  signal_texture: string;
  derived_station: Station;
  mastering_preset: MasteringPreset;
}

export interface MeResponse {
  user_id: string;
  username: string | null;
  tier: Tier;
  tier_expires_at: string | null;
}

// ─── V3 marketplace types ──────────────────────────────────────────────────

export type PackCategory =
  | "sfx"
  | "music"
  | "voice_packs"
  | "ambient"
  | "radio_packs"
  | "broadcast_packs";

export const PACK_CATEGORIES: ReadonlyArray<PackCategory> = [
  "sfx",
  "music",
  "voice_packs",
  "ambient",
  "radio_packs",
  "broadcast_packs",
];

export type PackStatus = "draft" | "published" | "removed";
export type LicenseKind = "personal" | "commercial";
export type PackSort = "new" | "price_asc" | "price_desc" | "popular";

export interface Pack {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: PackCategory;
  tags: string[];
  moods: string[];
  price_cents: number;
  credit_cost: number;
  license_personal: boolean;
  license_commercial_multiplier: number;
  status: PackStatus;
  cover_art_url: string | null;
  hero_art_url: string | null;
  preview_url: string | null;
  duration_ms: number;
  sample_count: number;
  plays: number;
  purchases_count: number;
  style_profile: Record<string, unknown>;
  published_at: string | null;
}

export interface PackListFilters {
  category?: PackCategory;
  tags?: string[];
  moods?: string[];
  price_min_cents?: number;
  price_max_cents?: number;
  q?: string;
  sort?: PackSort;
  limit?: number;
  offset?: number;
}

export interface CartItem {
  pack_id: string;
  title: string;
  category: PackCategory;
  cover_art_url: string | null;
  unit_price_cents: number; // price for the selected license
  license_kind: LicenseKind;
}
