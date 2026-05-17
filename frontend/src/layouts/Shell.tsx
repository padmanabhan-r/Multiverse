import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";

export interface ShellProps {
  /** Main content area (route children plug in here). */
  children?: ReactNode;
  /** Optional right-panel content. When null, panel is *not mounted* (elevenmusic.io rule). */
  rightPanel?: ReactNode | null;
  /** Optional bottom player. Lazy: not rendered until something plays. */
  bottomPlayer?: ReactNode | null;
}

const NAV_ITEMS = [
  { key: "discover", label: "Discover", to: "/" },
  { key: "studio", label: "Studio", to: "/studio" },
  { key: "library", label: "Library", to: "/library" },
  { key: "creator", label: "Creator", to: "/creator" },
  { key: "pricing", label: "Pricing", to: "/pricing" },
] as const;

const MOBILE_NAV = NAV_ITEMS.slice(0, 4); // drop Pricing on mobile bottom bar

export function Shell({ children, rightPanel = null, bottomPlayer = null }: ShellProps) {
  return (
    <div
      data-testid="shell"
      className="min-h-dvh w-full text-warm"
      style={{
        paddingBottom: bottomPlayer ? "var(--mvfm-bottomplayer-h)" : 0,
      }}
    >
      {/* Top bar */}
      <header
        data-testid="topbar"
        className="
          sticky top-0 z-30
          h-topbar flex items-center justify-between
          px-4 sm:px-6 lg:px-8
          bg-base/80 backdrop-blur-panel border-b border-glass-soft
        "
      >
        <NavLink to="/" className="flex items-center gap-3" aria-label="Multiverse home">
          <span className="size-2 rounded-full bg-molten shadow-bloom" aria-hidden />
          <span className="font-display text-[11px] tracking-[0.32em] text-warm">
            MULTIVERSE
          </span>
        </NavLink>

        {/* Cart + credits + new pack + profile */}
        <div className="flex items-center gap-2">
          <SignalMeter bars={4} />
          <span
            data-testid="topbar-credits"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-elev-2/60 border border-glass-soft text-[9px] tracking-[0.22em] uppercase text-silver"
          >
            <span className="size-1 rounded-full bg-silver2" aria-hidden />
            Free
          </span>
          <NavLink
            to="/cart"
            data-testid="topbar-cart"
            className="
              size-7 rounded-md grid place-items-center
              bg-elev-2/60 border border-glass-soft text-silver hover:text-warm hover:border-glass
              transition-colors duration-fast ease-tune
            "
            aria-label="Cart"
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
          </NavLink>
          <NavLink
            to="/studio"
            data-testid="topbar-new"
            style={{ color: "var(--mvfm-bg-base)" }}
            className="
              hidden sm:inline-flex items-center gap-1.5
              px-3 py-1.5 rounded-pill
              bg-molten hover:bg-molten-glow
              text-[10px] tracking-[0.22em] uppercase font-display font-semibold
              shadow-bloom transition-colors duration-fast ease-tune
            "
          >
            <span aria-hidden>+</span> New pack
          </NavLink>
          <button
            type="button"
            aria-label="Profile"
            className="size-7 rounded-pill mvfm-glass grid place-items-center text-[10px] text-silver"
          >
            P
          </button>
        </div>
      </header>

      {/* Body grid */}
      <div
        className="
          grid w-full min-h-[calc(100dvh-var(--mvfm-topbar-h))]
          grid-cols-1
          lg:[grid-template-columns:var(--mvfm-sidebar-w)_minmax(0,1fr)_auto]
        "
      >
        {/* Sidebar (desktop only) */}
        <aside
          data-testid="sidebar"
          className="hidden lg:flex flex-col py-4 border-r border-glass-soft"
        >
          <nav aria-label="Primary" className="flex flex-col gap-0.5 px-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.to === "/"}
                data-testid={`nav-${item.key}`}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-md",
                    "text-left text-[13.5px] font-medium tracking-[0.005em]",
                    "border-l-2 border-transparent",
                    "transition-all duration-fast ease-tune",
                    isActive
                      ? "border-l-molten bg-molten-tint text-warm"
                      : "text-silver hover:bg-white/[0.03] hover:text-warm",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden
                      className={cn(
                        "size-4 rounded-xs border border-glass",
                        isActive && "bg-molten/20 border-molten/40",
                      )}
                    />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

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

      {/* Mobile bottom tab bar — hidden when player mounted */}
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
              end={item.to === "/"}
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

function SignalMeter({ bars }: { bars: number }) {
  return (
    <div className="flex items-end gap-0.5" aria-label="Signal strength">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-xs ${i <= bars ? "bg-molten" : "bg-white/10"}`}
          style={{ height: 4 + i * 2 }}
        />
      ))}
    </div>
  );
}
