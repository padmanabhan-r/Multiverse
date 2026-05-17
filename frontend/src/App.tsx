import { Route, Routes } from "react-router-dom";
import { Shell } from "@/layouts/Shell";
import { BottomPlayer } from "@/components/BottomPlayer";
import { RightPanel } from "@/components/RightPanel";
import { Home } from "@/pages/Home";
import { Studio } from "@/pages/Studio";
import { Stub } from "@/pages/Stub";
import { World } from "@/pages/World";
import { DUMMY_STATIONS } from "@/data/dummyStations";
import { usePlayer } from "@/stores/playerStore";

export function App() {
  const currentId = usePlayer((s) => s.currentStationId);
  const selectedId = usePlayer((s) => s.selectedStationId);
  const play = usePlayer((s) => s.play);

  const currentStation = currentId
    ? DUMMY_STATIONS.find((s) => s.id === currentId) ?? null
    : null;
  const selectedStation = selectedId
    ? DUMMY_STATIONS.find((s) => s.id === selectedId) ?? null
    : null;

  return (
    <Shell
      bottomPlayer={currentStation ? <BottomPlayer station={currentStation} /> : null}
      rightPanel={
        selectedStation ? (
          <RightPanel station={selectedStation} onPlay={play} />
        ) : null
      }
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/studio" element={<Studio />} />
        <Route
          path="/library"
          element={
            <Stub
              testId="page-library"
              title="Your library."
              subtitle="Purchased packs and download history will land here. Buy a pack from Discover to see it appear."
              shippingIn="Shipping in Si"
              backTo={{ label: "Browse the marketplace", to: "/" }}
            />
          }
        />
        <Route
          path="/creator"
          element={
            <Stub
              testId="page-creator"
              title="Your universe. Your prices. Your payouts."
              subtitle="Creator dashboard — published packs, sales, and Stripe Connect onboarding. Publish a pack from Studio to start."
              shippingIn="Shipping in Si"
              backTo={{ label: "Open Studio", to: "/studio" }}
            />
          }
        />
        <Route
          path="/pricing"
          element={
            <Stub
              testId="page-pricing"
              title="Two ways to listen. One way to ship."
              subtitle="Free preview · Listener $9 (20 download credits / mo) · Pro Buyer $29 (80 credits + commercial license). Creator payouts via Stripe Connect — coming soon."
              shippingIn="Shipping in Sj"
              backTo={{ label: "Back to Discover", to: "/" }}
            />
          }
        />
        <Route
          path="/cart"
          element={
            <Stub
              testId="page-cart"
              title="Your cart is empty."
              subtitle="Add a pack from Discover or a pack detail page to see it here."
              shippingIn="Shipping in Sf"
              backTo={{ label: "Browse the marketplace", to: "/" }}
            />
          }
        />
        <Route path="/w/:stationId" element={<World />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Shell>
  );
}
