import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Shell } from "@/layouts/Shell";
import { BottomPlayer } from "@/components/BottomPlayer";
import { RightPanel } from "@/components/RightPanel";
import { Browse } from "@/pages/Browse";
import { Cart } from "@/pages/Cart";
import { Home } from "@/pages/Home";
import { Pack } from "@/pages/Pack";
import { Pricing } from "@/pages/Pricing";
import { Creator } from "@/pages/Creator";
import { Studio } from "@/pages/Studio";
import { StudioBundleNew } from "@/pages/StudioBundleNew";
import { StudioDraft } from "@/pages/StudioDraft";
import { StudioNew } from "@/pages/StudioNew";
import { StudioPublish } from "@/pages/StudioPublish";
import { Stub } from "@/pages/Stub";
import { World } from "@/pages/World";
import { DUMMY_STATIONS } from "@/data/dummyStations";
import { useAuth } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setTokenGetter } from "@/lib/api";
import { usePlayer } from "@/stores/playerStore";

const HAS_CLERK = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Mounted only inside ClerkProvider (when HAS_CLERK is true).
// 1. Wires Clerk's getToken into the api singleton so all requests carry the JWT.
// 2. On sign-in, calls GET /me which upserts the User row + grants 5 trial credits.
function AuthSync() {
  const { getToken, isSignedIn } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    setTokenGetter(() => getToken());
    if (isSignedIn) {
      // Bootstrap: create User row + grant trial credits, then invalidate credits query.
      api.me().then(() => {
        qc.invalidateQueries({ queryKey: ["me", "credits"] });
      }).catch(() => {/* ignore — token may not be ready yet */});
    }
  }, [getToken, isSignedIn, qc]);

  return null;
}

export function App() {
  const currentId = usePlayer((s) => s.currentStationId);
  const selectedStationId = usePlayer((s) => s.selectedStationId);
  const play = usePlayer((s) => s.play);

  const currentStation = currentId
    ? DUMMY_STATIONS.find((s) => s.id === currentId) ?? null
    : null;
  const selectedStation = selectedStationId
    ? DUMMY_STATIONS.find((s) => s.id === selectedStationId) ?? null
    : null;

  const rightPanel = selectedStation ? (
    <RightPanel station={selectedStation} onPlay={play} />
  ) : null;

  return (
    <Shell
      bottomPlayer={currentStation ? <BottomPlayer station={currentStation} /> : null}
      rightPanel={rightPanel}
    >
      {HAS_CLERK && <AuthSync />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/browse/:category" element={<Browse />} />
        <Route path="/p/:packId" element={<Pack />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/studio/new" element={<StudioNew />} />
        <Route path="/studio/draft/:packId" element={<StudioDraft />} />
        <Route path="/studio/publish" element={<StudioPublish />} />
        <Route path="/studio/bundle/new" element={<StudioBundleNew />} />
        <Route path="/cart" element={<Cart />} />
        <Route
          path="/library"
          element={
            <Stub
              testId="page-library"
              title="Your library."
              subtitle="Purchased packs and download history will land here. Buy a pack from Discover to see it appear."
              shippingIn="Shipping in Si"
              backTo={{ label: "Browse the marketplace", to: "/browse" }}
            />
          }
        />
        <Route path="/creator" element={<Creator />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route
          path="/u/:creatorId"
          element={
            <Stub
              testId="page-creator-storefront"
              title="Creator storefront."
              subtitle="Public profile + the creator's published packs. Lands in Si."
              shippingIn="Shipping in Si"
              backTo={{ label: "Back to marketplace", to: "/browse" }}
            />
          }
        />
        <Route path="/w/:stationId" element={<World />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Shell>
  );
}
