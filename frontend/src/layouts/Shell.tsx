import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";
import { CreditBadge } from "@/components/CreditBadge";
import { cn } from "@/lib/cn";
import { useMyCredits } from "@/lib/queries";
import { useCart } from "@/stores/cartStore";

// True only when a real Clerk publishable key is configured.
// When false, Clerk components are never rendered (avoids missing-provider errors in dev).
const HAS_CLERK = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export interface ShellProps {
  /** Main content area (route children plug in here). */
  children?: ReactNode;
  /** Optional right-panel content. When null, panel is *not mounted*. */
  rightPanel?: ReactNode | null;
  /** Optional bottom player. Lazy: not rendered until something plays. */
  bottomPlayer?: ReactNode | null;
}

const NAV_ITEMS = [
  { key: "discover", label: "Discover", to: "/browse" },
  { key: "voices", label: "Voices", to: "/voices" },
  { key: "studio", label: "Studio", to: "/studio" },
  { key: "library", label: "Library", to: "/library" },
  { key: "creator", label: "Creator", to: "/creator" },
  { key: "pricing", label: "Pricing", to: "/pricing" },
] as const;

const MOBILE_NAV = NAV_ITEMS.slice(0, 4);

export function Shell({ children, rightPanel = null, bottomPlayer = null }: ShellProps) {
  const cartCount = useCart((s) => s.items.length);

  return (
    <div
      data-testid="shell"
      className="mvfm-stage min-h-dvh w-full text-warm"
      style={{
        paddingBottom: bottomPlayer ? "var(--mvfm-bottomplayer-h)" : 0,
      }}
    >
      {/* Top bar */}
      <header
        data-testid="topbar"
        className="
          sticky top-0 z-30
          h-topbar flex items-center
          px-4 sm:px-6 lg:px-8
          bg-base/80 backdrop-blur-panel border-b border-glass-soft
          gap-4 lg:gap-6
        "
      >
        <NavLink
          to="/"
          className="flex items-center gap-3 flex-shrink-0"
          aria-label="Multiverse home"
        >
          <span className="size-2 rounded-full bg-molten shadow-bloom" aria-hidden />
          <span className="font-display text-[11px] tracking-[0.32em] text-warm">
            MULTIVERSE
          </span>
        </NavLink>

        <nav
          data-testid="topbar-nav"
          aria-label="Primary"
          className="hidden lg:flex items-center gap-1 ml-2"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              data-testid={`nav-${item.key}`}
              className={({ isActive }) =>
                cn(
                  "px-3 py-1.5 rounded-md",
                  "font-mono text-[10.5px] tracking-[0.22em] uppercase",
                  "transition-colors duration-fast ease-tune",
                  isActive
                    ? "text-molten bg-molten-tint"
                    : "text-silver hover:text-warm hover:bg-white/[0.03]",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Right cluster */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Cart — always visible; guests get prompted to sign in at checkout */}
          <NavLink
            to="/cart"
            data-testid="topbar-cart"
            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
            className="
              relative size-7 rounded-md grid place-items-center
              bg-elev-2/60 border border-glass-soft text-silver hover:text-warm hover:border-glass
              transition-colors duration-fast ease-tune
            "
          >
            <svg viewBox="0 0 12 12" fill="none" aria-hidden className="size-3">
              <path
                d="M1.5 2.5h1.5l1 6h6l1-4.5h-7"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="4.5" cy="10" r="0.6" fill="currentColor" />
              <circle cx="9" cy="10" r="0.6" fill="currentColor" />
            </svg>
            {cartCount > 0 && (
              <span
                data-testid="topbar-cart-count"
                aria-hidden
                className="
                  absolute -top-1 -right-1 min-w-3.5 h-3.5 px-1 rounded-pill
                  bg-molten font-mono text-[8px] font-semibold leading-[14px] text-center
                "
                style={{ color: "#1a0700" }}
              >
                {cartCount}
              </span>
            )}
          </NavLink>

          {/* Auth section */}
          {HAS_CLERK ? (
            <>
              <SignedIn>
                <SignedInCredits />
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      // Hide the secondary identifier (email) in the dropdown header
                      userPreviewSecondaryIdentifier: { display: "none" },
                    },
                  }}
                />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    data-testid="topbar-signin"
                    className="
                      h-7 px-3 rounded-md
                      bg-elev-2/60 border border-glass-soft
                      font-mono text-[10px] tracking-[0.18em] uppercase text-silver
                      hover:text-warm hover:border-glass
                      transition-colors duration-fast ease-tune
                    "
                  >
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    data-testid="topbar-join"
                    style={{ color: "#1a0700" }}
                    className="
                      h-7 px-3 rounded-pill
                      bg-molten hover:bg-molten-glow
                      font-mono text-[10px] tracking-[0.18em] uppercase font-semibold
                      shadow-bloom transition-colors duration-fast ease-tune
                    "
                  >
                    Join free
                  </button>
                </SignUpButton>
              </SignedOut>
            </>
          ) : (
            /* Dev fallback — Clerk not configured; same test IDs for test coverage */
            <>
              <button
                type="button"
                data-testid="topbar-signin"
                className="
                  h-7 px-3 rounded-md
                  bg-elev-2/60 border border-glass-soft
                  font-mono text-[10px] tracking-[0.18em] uppercase text-silver
                  hover:text-warm hover:border-glass
                  transition-colors duration-fast ease-tune
                "
              >
                Sign in
              </button>
              <button
                type="button"
                data-testid="topbar-join"
                style={{ color: "#1a0700" }}
                className="
                  h-7 px-3 rounded-pill
                  bg-molten hover:bg-molten-glow
                  font-mono text-[10px] tracking-[0.18em] uppercase font-semibold
                  shadow-bloom transition-colors duration-fast ease-tune
                "
              >
                Join free
              </button>
            </>
          )}
        </div>
      </header>

      {/* Body — 2-col (main + optional right panel) */}
      <div
        className="
          grid w-full min-h-[calc(100dvh-var(--mvfm-topbar-h))]
          grid-cols-1
          lg:[grid-template-columns:minmax(0,1fr)_auto]
        "
      >
        <main data-testid="main" className="min-w-0 px-3 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {rightPanel ? (
          <aside
            data-testid="right-panel"
            className="hidden lg:block w-rightpanel border-l border-glass-soft"
          >
            {rightPanel}
          </aside>
        ) : null}
      </div>

      {bottomPlayer ? (
        <footer
          data-testid="bottom-player"
          className="
            fixed bottom-0 inset-x-0 z-40 h-bottomplayer
            mvfm-glass border-t border-glass
            pb-[env(safe-area-inset-bottom)]
          "
        >
          {bottomPlayer}
        </footer>
      ) : null}

      {!bottomPlayer ? (
        <nav
          data-testid="mobile-tabs"
          aria-label="Primary mobile"
          className="
            lg:hidden fixed bottom-0 inset-x-0 z-40 h-16
            mvfm-glass border-t border-glass
            flex items-center justify-around px-2
            pb-[env(safe-area-inset-bottom)]
          "
        >
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              data-testid={`mobile-nav-${item.key}`}
              className={({ isActive }) =>
                cn(
                  "flex-1 h-full grid place-items-center",
                  "text-[10px] uppercase tracking-[0.22em]",
                  isActive ? "text-molten" : "text-silver",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

// Mounted only inside <SignedIn> — safe to call useAuth + useMyCredits here.
function SignedInCredits() {
  const { isSignedIn } = useAuth();
  const credits = useMyCredits({ enabled: !!isSignedIn });
  const balance = credits.data?.balance ?? 0;
  const tierGrant = credits.data?.tier_monthly_grant ?? 0;
  // Surface loading + error states in dev so we can spot wiring breakage.
  if (credits.isLoading) {
    return (
      <span
        data-testid="credit-badge-loading"
        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-elev-2/60 border border-glass-soft font-mono text-[10px] tracking-[0.22em] uppercase text-silver2"
      >
        ⚡ …
      </span>
    );
  }
  if (credits.isError) {
    return (
      <span
        data-testid="credit-badge-error"
        title={String(credits.error)}
        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-elev-2/60 border border-molten/50 font-mono text-[10px] tracking-[0.22em] uppercase text-molten"
      >
        ⚡ ?
      </span>
    );
  }
  return <CreditBadge balance={balance} tierGrant={tierGrant} />;
}

