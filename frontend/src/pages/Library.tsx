import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type LibraryItem,
  type MarketplaceVoice,
} from "@/lib/api";
import type { Pack } from "@multiverse/shared";
import { plateFor } from "@/lib/stationArt";
import { cn } from "@/lib/cn";

const CATEGORY_SHORT: Record<string, string> = {
  sfx: "SFX",
  music: "Music",
  voice_packs: "Voice",
  ambient: "Ambient",
  radio_packs: "Radio",
  broadcast_packs: "Broadcast",
};

export function Library() {
  const [purchased, setPurchased] = useState<LibraryItem[] | null>(null);
  const [myPacks, setMyPacks] = useState<Pack[] | null>(null);
  const [myVoices, setMyVoices] = useState<MarketplaceVoice[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.library().catch(() => []),
      api.listMyPacks().catch(() => []),
      api.listOwnedVoices().catch(() => []),
    ])
      .then(([lib, packs, voices]) => {
        setPurchased(lib);
        setMyPacks(packs);
        setMyVoices(voices);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "load failed"));
  }, []);

  if (err)
    return (
      <div data-testid="library-error" className="text-molten">
        {err}
      </div>
    );

  if (purchased === null || myPacks === null || myVoices === null)
    return (
      <div data-testid="library-loading" className="text-silver">
        Loading…
      </div>
    );

  // Drop creator-owned packs from purchased list to avoid duplicates.
  const myPackIds = new Set(myPacks.map((p) => p.id));
  const purchasedFiltered = purchased.filter(
    (i) => !myPackIds.has(i.pack_id),
  );

  const totalOwned = myPacks.length + myVoices.length + purchasedFiltered.length;

  if (totalOwned === 0)
    return (
      <section className="space-y-6 pb-8" data-testid="library-page">
        <header className="space-y-1">
          <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
            Your library
          </div>
          <h1 className="font-display text-warm text-3xl sm:text-[40px] tracking-tight">
            Nothing here yet.
          </h1>
          <p className="text-silver text-[14px]">
            Buy a pack from Discover or publish a pack from Studio to see it here.
          </p>
        </header>
        <Link
          to="/browse"
          data-testid="library-browse-cta"
          className="
            inline-block px-3.5 py-2 rounded-md bg-molten text-[10px]
            tracking-[0.22em] uppercase font-mono font-semibold shadow-bloom
          "
          style={{ color: "#1a0700" }}
        >
          Browse the marketplace
        </Link>
      </section>
    );

  return (
    <section className="space-y-8 pb-8" data-testid="library-page">
      <header className="space-y-1">
        <div className="font-mono text-silver2 text-[10px] tracking-[0.32em] uppercase">
          Your library
        </div>
        <h1 className="font-display text-warm text-3xl sm:text-[40px] tracking-tight">
          Your packs.
        </h1>
        <p className="text-silver text-[14px]">
          {totalOwned} {totalOwned === 1 ? "item" : "items"} owned ·{" "}
          {myPacks.length} created, {myVoices.length} voices,{" "}
          {purchasedFiltered.length} purchased
        </p>
      </header>

      {myVoices.length > 0 && (
        <Group title="My voices" count={myVoices.length}>
          {myVoices.map((v) => (
            <li key={v.id}>
              <VoiceCard voice={v} />
            </li>
          ))}
        </Group>
      )}

      {myPacks.length > 0 && (
        <Group title="My packs" count={myPacks.length}>
          {myPacks.map((p) => (
            <li key={p.id}>
              <PackCard pack={p} />
            </li>
          ))}
        </Group>
      )}

      {purchasedFiltered.length > 0 && (
        <Group title="Purchased" count={purchasedFiltered.length}>
          {purchasedFiltered.map((i) => (
            <li key={i.purchase_id}>
              <PurchaseCard item={i} />
            </li>
          ))}
        </Group>
      )}
    </section>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3" data-testid={`library-group-${slug(title)}`}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-mono text-warm text-[12px] tracking-[0.22em] uppercase font-semibold">
          {title}
        </h2>
        <span className="font-mono text-silver2 text-[10px] tracking-[0.22em] uppercase">
          {count.toString().padStart(2, "0")}
        </span>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {children}
      </ul>
    </section>
  );
}

function PackCard({ pack }: { pack: Pack }) {
  const plate = plateFor(pack.id);
  return (
    <Link
      to={`/p/${pack.id}`}
      data-testid={`library-pack-${pack.id}`}
      className={cn(
        "group block rounded-lg overflow-hidden",
        "border border-glass-soft hover:border-molten/40",
        "transition-colors duration-tune ease-tune",
      )}
    >
      <div
        className="aspect-square relative"
        style={{
          background: pack.cover_art_url
            ? `center / cover no-repeat url('${pack.cover_art_url}'), ${plate.background}`
            : plate.background,
        }}
      >
        <span
          aria-hidden
          className="absolute inset-0 mvfm-grain opacity-40 pointer-events-none"
        />
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 45%, rgba(10,10,12,0.88) 100%)",
          }}
        />
        <div className="absolute top-2 left-2 font-mono text-silver2 text-[9px] tracking-[0.24em] uppercase">
          {CATEGORY_SHORT[pack.category] ?? pack.category}
        </div>
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-pill bg-molten-tint border border-molten/40 font-mono text-molten text-[8.5px] tracking-[0.22em] uppercase">
          Owned
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <div className="mvfm-display text-warm text-[14px] leading-[0.95] truncate">
            {pack.title}
          </div>
          <div className="font-mono text-silver text-[9.5px] tracking-[0.14em] mt-1.5">
            {pack.sample_count}{" "}
            {pack.sample_count === 1 ? "sample" : "samples"}
          </div>
        </div>
      </div>
    </Link>
  );
}

function PurchaseCard({ item }: { item: LibraryItem }) {
  const plate = plateFor(item.pack_id);
  return (
    <Link
      to={`/p/${item.pack_id}`}
      data-testid={`library-pack-${item.pack_id}`}
      className={cn(
        "group block rounded-lg overflow-hidden",
        "border border-glass-soft hover:border-molten/40",
        "transition-colors duration-tune ease-tune",
      )}
    >
      <div
        className="aspect-square relative"
        style={{
          background: item.cover_art_url
            ? `center / cover no-repeat url('${item.cover_art_url}'), ${plate.background}`
            : plate.background,
        }}
      >
        <span
          aria-hidden
          className="absolute inset-0 mvfm-grain opacity-40 pointer-events-none"
        />
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 45%, rgba(10,10,12,0.88) 100%)",
          }}
        />
        <div className="absolute top-2 left-2 font-mono text-silver2 text-[9px] tracking-[0.24em] uppercase">
          {CATEGORY_SHORT[item.category] ?? item.category}
        </div>
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-pill bg-molten-tint border border-molten/40 font-mono text-molten text-[8.5px] tracking-[0.22em] uppercase">
          Owned
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <div className="mvfm-display text-warm text-[14px] leading-[0.95] truncate">
            {item.title}
          </div>
          <div className="font-mono text-silver text-[9.5px] tracking-[0.14em] mt-1.5">
            Paid {Math.round(item.price_paid_cents / 10)} ⚡
          </div>
        </div>
      </div>
    </Link>
  );
}

function VoiceCard({ voice }: { voice: MarketplaceVoice }) {
  const plate = plateFor(voice.id);
  return (
    <Link
      to={`/v/${voice.id}`}
      data-testid={`library-voice-${voice.id}`}
      className={cn(
        "group block rounded-lg overflow-hidden",
        "border border-glass-soft hover:border-molten/40",
        "transition-colors duration-tune ease-tune",
      )}
    >
      <div
        className="aspect-square relative"
        style={{
          background: voice.cover_art_url
            ? `center / cover no-repeat url('${voice.cover_art_url}'), ${plate.background}`
            : plate.background,
        }}
      >
        <span
          aria-hidden
          className="absolute inset-0 mvfm-grain opacity-40 pointer-events-none"
        />
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 45%, rgba(10,10,12,0.88) 100%)",
          }}
        />
        <div className="absolute top-2 left-2 font-mono text-silver2 text-[9px] tracking-[0.24em] uppercase">
          Voice
        </div>
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-pill bg-molten-tint border border-molten/40 font-mono text-molten text-[8.5px] tracking-[0.22em] uppercase">
          Owned
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <div className="mvfm-display text-warm text-[14px] leading-[0.95] truncate">
            {voice.title}
          </div>
          <div className="font-mono text-molten text-[9.5px] tracking-[0.14em] mt-1.5">
            Use in Studio →
          </div>
        </div>
      </div>
    </Link>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
