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
import { CreatorStorefront } from "@/pages/CreatorStorefront";
import { Credits } from "@/pages/Credits";
import { Library } from "@/pages/Library";
import { Studio } from "@/pages/Studio";
import { StudioBundleNew } from "@/pages/StudioBundleNew";
import { StudioDraft } from "@/pages/StudioDraft";
import { StudioNew } from "@/pages/StudioNew";
import { StudioPublish } from "@/pages/StudioPublish";
import { StudioTTS } from "@/pages/StudioTTS";
import { StudioVoiceNew } from "@/pages/StudioVoiceNew";
import { Voice } from "@/pages/Voice";
import { Voices } from "@/pages/Voices";
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
    if (!isSignedIn) return;

    // Race fix: useMyCredits (mounted by SignedInCredits) fires on the same
    // tick this effect runs, BEFORE setTokenGetter has been observed by the
    // api singleton. That first request goes unauthenticated → 401 →
    // retry=false → query stuck. Explicitly invalidate after the token is
    // wired so the retry carries the JWT.
    qc.invalidateQueries({ queryKey: ["me", "credits"] });
    api.me()
      .then(() => qc.invalidateQueries({ queryKey: ["me", "credits"] }))
      .catch(() => {/* token may still be settling */});
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
        <Route path="/library" element={<Library />} />
        <Route path="/creator" element={<Creator />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="/voices" element={<Voices />} />
        <Route path="/v/:voiceId" element={<Voice />} />
        <Route path="/studio/tts" element={<StudioTTS />} />
        <Route path="/studio/voices/new" element={<StudioVoiceNew />} />
        <Route path="/u/:creatorId" element={<CreatorStorefront />} />
        <Route path="/w/:stationId" element={<World />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Shell>
  );
}
